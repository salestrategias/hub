import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { propostaEnviarSchema } from "@/lib/schemas";

/**
 * Gera link público pra proposta:
 *   - shareToken aleatório (32 chars hex)
 *   - shareExpiraEm = agora + validadeDias
 *   - opcionalmente: senha bcrypt
 *   - status vira ENVIADA + enviadaEm = agora (se ainda for RASCUNHO)
 *
 * Idempotente: chamar de novo regenera token (revoga o anterior) e
 * estende validade. Útil pra "reenviar" depois de uma revisão.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = propostaEnviarSchema.parse(await req.json().catch(() => ({})));

    const proposta = await prisma.proposta.findUniqueOrThrow({ where: { id: params.id } });

    const validadeDias = body.validadeDias ?? proposta.validadeDias;
    const shareExpiraEm = new Date();
    shareExpiraEm.setDate(shareExpiraEm.getDate() + validadeDias);

    const shareToken = randomBytes(16).toString("hex");
    const shareSenha = body.senha ? await bcrypt.hash(body.senha, 10) : null;

    // Reset de status — proposta que foi recusada/aceita pode ser re-enviada
    // como uma nova rodada. Se foi ACEITA, manter (revogar não faz sentido).
    const novoStatus =
      proposta.status === "ACEITA" || proposta.status === "RECUSADA"
        ? proposta.status
        : "ENVIADA";

    const updated = await prisma.proposta.update({
      where: { id: params.id },
      data: {
        shareToken,
        shareExpiraEm,
        shareSenha,
        shareViews: 0, // zera contagem ao re-enviar
        validadeDias,
        status: novoStatus,
        enviadaEm: proposta.enviadaEm ?? new Date(),
        // Limpa vistaEm se for nova rodada (não foi vista ainda na nova versão)
        vistaEm: proposta.status === "ACEITA" || proposta.status === "RECUSADA" ? proposta.vistaEm : null,
      },
    });

    return {
      ...updated,
      // URL pública pronta pra copiar
      url: `/p/proposta/${shareToken}`,
    };
  });
}
