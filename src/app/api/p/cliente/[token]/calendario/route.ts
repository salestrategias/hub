/**
 * GET /api/p/cliente/[token]/calendario?desde=ISO&ate=ISO
 *
 * Posts editoriais visíveis pro cliente. Filtra por janela (default:
 * 30 dias atrás → 60 dias à frente). Não mostra RASCUNHO — só os
 * estágios em que cliente faz sentido enxergar (COPY_PRONTA em
 * diante).
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.verCalendario) throw new Error("Sem permissão pra calendário");

    const { searchParams } = new URL(req.url);
    const desdeRaw = searchParams.get("desde");
    const ateRaw = searchParams.get("ate");

    const hoje = new Date();
    const desde = desdeRaw ? new Date(desdeRaw) : new Date(hoje.getTime() - 30 * 24 * 3600_000);
    const ate = ateRaw ? new Date(ateRaw) : new Date(hoje.getTime() + 60 * 24 * 3600_000);

    const posts = await prisma.post.findMany({
      where: {
        clienteId: r.cliente.id,
        dataPublicacao: { gte: desde, lte: ate },
        // Cliente vê de COPY_PRONTA em diante (não vê rascunhos crus)
        status: { in: ["COPY_PRONTA", "DESIGN_PRONTO", "AGENDADO", "PUBLICADO"] },
      },
      include: {
        comentarios: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, tipo: true, texto: true, createdAt: true },
        },
        arquivos: {
          orderBy: { ordem: "asc" },
          select: { id: true, tipo: true, url: true, nome: true, legenda: true, ordem: true },
        },
      },
      orderBy: { dataPublicacao: "asc" },
    });

    return posts.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      legenda: p.legenda,
      pilar: p.pilar,
      formato: p.formato,
      status: p.status,
      dataPublicacao: p.dataPublicacao.toISOString(),
      hashtags: p.hashtags,
      cta: p.cta,
      // observacoesProducao é interno — NÃO expõe pro cliente
      arquivos: p.arquivos,
      comentarios: p.comentarios.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    }));
  });
}
