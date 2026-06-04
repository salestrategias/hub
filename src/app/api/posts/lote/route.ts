import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { postSchema } from "@/lib/schemas";
import { tryCreateEvent } from "@/lib/google-calendar";
import { syncMentionsFromValue } from "@/lib/mentions";
import { z } from "zod";

/**
 * Criação em LOTE de posts (recorrência / materialização de série).
 *
 * Recebe `{ posts: PostInput[] }` (cada item validado com o MESMO postSchema
 * das rotas singulares) e grava todos numa $transaction — ou cria tudo, ou
 * nada. Usado pelo bloco "Repetir" do NovoPostDialog, que calcula as datas no
 * cliente (date-fns) e manda o array já materializado.
 *
 * Sync com Google Agenda: posts AGENDADO criam evento ANTES da transação (a
 * chamada externa não pode viver dentro do $transaction). Na recorrência a UI
 * manda RASCUNHO, então normalmente nenhum evento é criado — mas o caminho
 * AGENDADO fica coberto por consistência com POST /api/posts.
 */
const loteSchema = z.object({
  posts: z.array(postSchema).min(1, "Envie pelo menos 1 post").max(366, "Limite de 366 posts por lote"),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { posts } = loteSchema.parse(await req.json());

    // Cache de nomes de cliente (pra título do evento) — evita N queries.
    const clienteIds = Array.from(new Set(posts.map((p) => p.clienteId)));
    const clientes = await prisma.cliente.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nome: true },
    });
    const nomePorCliente = new Map(clientes.map((c) => [c.id, c.nome]));

    // Pré-cria eventos no Google pros posts AGENDADO (fora da transação).
    const preparados = await Promise.all(
      posts.map(async (data) => {
        let googleEventId: string | null = null;
        if (data.status === "AGENDADO") {
          const fim = new Date(data.dataPublicacao);
          fim.setHours(fim.getHours() + 1);
          const ev = await tryCreateEvent({
            titulo: `[${nomePorCliente.get(data.clienteId) ?? "Post"}] ${data.titulo}`,
            descricao: data.legenda ?? undefined,
            inicio: data.dataPublicacao,
            fim,
          });
          googleEventId = ev?.id ?? null;
        }
        return { ...data, googleEventId };
      })
    );

    // Grava todos atomicamente.
    const criados = await prisma.$transaction(
      preparados.map((data) => prisma.post.create({ data }))
    );

    // Indexa menções da legenda de cada post (fire-and-forget, fora do crítico).
    for (const post of criados) {
      void syncMentionsFromValue({ sourceType: "POST", sourceId: post.id }, post.legenda);
    }

    return { count: criados.length, posts: criados };
  });
}
