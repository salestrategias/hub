import { randomBytes } from "node:crypto";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { mapaCompartilharSchema } from "@/lib/schemas";

/**
 * Compartilhamento público read-only do mapa mental.
 * Mesma mecânica de Proposta/Diagnóstico: token aleatório (16 bytes hex)
 * é o próprio acesso; a página pública /p/mapa/[token] não exige login.
 *
 * POST  → gera link (idempotente: reusa o shareToken existente se já houver,
 *          pra o link não "trocar" a cada clique). Body opcional:
 *            { validadeDias?: number }  define/estende expiração
 *            { ativo: false }           atalho pra revogar (= DELETE)
 *          Retorna { shareToken, url, shareExpiraEm }.
 * DELETE → revoga (shareToken = null, zera views/expiração).
 *
 * Auth = sessão do app (igual às demais rotas /api/mapas).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = mapaCompartilharSchema.parse(await req.json().catch(() => ({})));

    // Atalho: { ativo:false } no POST revoga (mesma semântica do DELETE).
    if (body.ativo === false) {
      return revogar(params.id);
    }

    const mapa = await prisma.mindMap.findUniqueOrThrow({ where: { id: params.id } });

    // Idempotente: se já existe token, mantém (link estável). Senão gera um novo.
    const shareToken = mapa.shareToken ?? randomBytes(16).toString("hex");

    // Expiração: só define se o caller pedir validadeDias. Sem isso, link permanente.
    const shareExpiraEm =
      body.validadeDias != null
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() + body.validadeDias!);
            return d;
          })()
        : mapa.shareExpiraEm;

    const updated = await prisma.mindMap.update({
      where: { id: params.id },
      data: { shareToken, shareExpiraEm },
      select: { shareToken: true, shareExpiraEm: true },
    });

    return {
      shareToken: updated.shareToken,
      shareExpiraEm: updated.shareExpiraEm?.toISOString() ?? null,
      url: `/p/mapa/${updated.shareToken}`,
    };
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return revogar(params.id);
  });
}

async function revogar(id: string) {
  await prisma.mindMap.update({
    where: { id },
    data: { shareToken: null, shareExpiraEm: null, shareViews: 0 },
  });
  return { shareToken: null, url: null, shareExpiraEm: null };
}
