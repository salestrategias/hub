import { randomBytes } from "node:crypto";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { briefingEnviarSchema } from "@/lib/schemas";

/**
 * Envio do briefing — gera o link público de preenchimento.
 * Mesma mecânica de Mapa/Proposta/Diagnóstico: token aleatório (16 bytes hex)
 * é o próprio acesso; a página pública /p/briefing/[token] não exige login.
 *
 * POST  → gera link (idempotente: reusa shareToken existente pra o link não
 *          "trocar" a cada clique). status=ENVIADO, enviadoEm=now (1ª vez).
 *          Body opcional { validadeDias?: number } define/estende expiração.
 *          Retorna { shareToken, url, shareExpiraEm }.
 * DELETE → revoga (shareToken=null, zera expiração). Não rebaixa o status.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = briefingEnviarSchema.parse(await req.json().catch(() => ({})));

    const briefing = await prisma.briefing.findUniqueOrThrow({ where: { id: params.id } });

    // Idempotente: mantém token existente (link estável). Senão gera um novo.
    const shareToken = briefing.shareToken ?? randomBytes(16).toString("hex");

    const shareExpiraEm =
      body.validadeDias != null
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() + body.validadeDias!);
            return d;
          })()
        : briefing.shareExpiraEm;

    const updated = await prisma.briefing.update({
      where: { id: params.id },
      data: {
        shareToken,
        shareExpiraEm,
        // Só "avança" pra ENVIADO se ainda for rascunho — não rebaixa RESPONDIDO.
        ...(briefing.status === "RASCUNHO" ? { status: "ENVIADO" as const } : {}),
        enviadoEm: briefing.enviadoEm ?? new Date(),
      },
      select: { shareToken: true, shareExpiraEm: true, status: true, enviadoEm: true },
    });

    return {
      shareToken: updated.shareToken,
      shareExpiraEm: updated.shareExpiraEm?.toISOString() ?? null,
      status: updated.status,
      enviadoEm: updated.enviadoEm?.toISOString() ?? null,
      url: `/p/briefing/${updated.shareToken}`,
    };
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const updated = await prisma.briefing.update({
      where: { id: params.id },
      data: { shareToken: null, shareExpiraEm: null },
      select: { status: true },
    });
    return { shareToken: null, url: null, shareExpiraEm: null, status: updated.status };
  });
}
