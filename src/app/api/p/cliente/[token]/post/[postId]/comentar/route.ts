/**
 * POST /api/p/cliente/[token]/post/[postId]/comentar
 *
 * Cliente pede ajuste num post. Body: { texto: string }
 *  - Cria PostComentario tipo PEDIU_AJUSTE com texto
 *  - NÃO muda status do post
 *  - Notifica admins do SAL com preview do pedido
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";
import { z } from "zod";

const schema = z.object({
  texto: z.string().min(3, "Comentário muito curto").max(2000),
});

export async function POST(
  req: Request,
  { params }: { params: { token: string; postId: string } }
) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeComentar) throw new Error("Sem permissão pra comentar");

    const { texto } = schema.parse(await req.json());

    const post = await prisma.post.findFirst({
      where: { id: params.postId, clienteId: r.cliente.id },
      select: { id: true, titulo: true },
    });
    if (!post) throw new Error("Post não encontrado");

    await prisma.postComentario.create({
      data: {
        postId: post.id,
        tipo: "PEDIU_AJUSTE",
        texto,
        clienteNome: r.cliente.nome,
      },
    });

    // Notifica admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    const preview = texto.length > 100 ? texto.slice(0, 97) + "..." : texto;
    await prisma.notificacao.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        tipo: "PORTAL_PEDIU_AJUSTE" as const,
        titulo: `💬 ${r.cliente.nome} pediu ajuste`,
        descricao: `"${post.titulo}" — ${preview}`,
        href: `/editorial?post=${post.id}`,
        entidadeTipo: "POST",
        entidadeId: post.id,
        chave: `PORTAL_AJUSTE:${post.id}:${Date.now()}`,
      })),
      skipDuplicates: true,
    });

    return { ok: true };
  });
}
