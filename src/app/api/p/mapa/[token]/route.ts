import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Endpoint público que serve o mapa mental pro link compartilhado.
 *
 * Segurança:
 *   - Não requer auth (o token de 16 bytes hex É o acesso)
 *   - Respeita shareExpiraEm (se setado)
 *
 * Side-effects:
 *   - Incrementa shareViews (fire-and-forget)
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const mapa = await prisma.mindMap.findUnique({
      where: { shareToken: params.token },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        data: true,
        shareExpiraEm: true,
      },
    });

    if (!mapa) {
      throw new Error("Mapa não encontrado");
    }
    if (mapa.shareExpiraEm && mapa.shareExpiraEm < new Date()) {
      throw new Error("Este link expirou.");
    }

    // Registra a visualização sem bloquear a resposta.
    void prisma.mindMap
      .update({ where: { id: mapa.id }, data: { shareViews: { increment: 1 } } })
      .catch(() => undefined);

    const data = (mapa.data as { nodes?: unknown[]; edges?: unknown[] }) ?? {};
    return {
      id: mapa.id,
      titulo: mapa.titulo,
      descricao: mapa.descricao,
      data: { nodes: data.nodes ?? [], edges: data.edges ?? [] },
    };
  });
}
