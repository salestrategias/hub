import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { diagnosticoEnviarSchema } from "@/lib/schemas";

/**
 * Gera link público pro diagnóstico:
 *   - shareToken aleatório (32 chars hex)
 *   - shareExpiraEm = agora + validadeDias (default 60)
 *   - opcionalmente: senha bcrypt
 *   - status RASCUNHO/PRONTO → ENVIADO + enviadoEm = agora
 *
 * Idempotente: chamar de novo regenera o token (revoga o anterior),
 * estende a validade e zera a contagem de views — útil pra "re-compartilhar"
 * depois de uma revisão. Diagnóstico não tem aceite (não é contrato).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = diagnosticoEnviarSchema.parse(await req.json().catch(() => ({})));

    const diagnostico = await prisma.diagnostico.findUniqueOrThrow({ where: { id: params.id } });

    const validadeDias = body.validadeDias ?? 60;
    const shareExpiraEm = new Date();
    shareExpiraEm.setDate(shareExpiraEm.getDate() + validadeDias);

    const shareToken = randomBytes(16).toString("hex");
    const shareSenha = body.senha ? await bcrypt.hash(body.senha, 10) : null;

    // Arquivado fica arquivado; qualquer outro vira ENVIADO ao compartilhar.
    const novoStatus = diagnostico.status === "ARQUIVADO" ? "ARQUIVADO" : "ENVIADO";

    const updated = await prisma.diagnostico.update({
      where: { id: params.id },
      data: {
        shareToken,
        shareExpiraEm,
        shareSenha,
        shareViews: 0, // zera contagem ao re-compartilhar
        status: novoStatus,
        enviadoEm: diagnostico.enviadoEm ?? new Date(),
        vistoEm: null, // nova rodada — ainda não visto
      },
    });

    return {
      ...updated,
      shareExpiraEm: updated.shareExpiraEm?.toISOString() ?? null,
      enviadoEm: updated.enviadoEm?.toISOString() ?? null,
      vistoEm: updated.vistoEm?.toISOString() ?? null,
      url: `/p/diagnostico/${shareToken}`,
    };
  });
}
