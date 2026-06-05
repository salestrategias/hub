/**
 * GET /api/p/cliente/[token]/briefings/[briefingId]
 *
 * Detalhe de UM briefing pra preencher EMBUTIDO no Portal do Cliente
 * (a aba "Briefing" reusa o componente <BriefingPublico/> sem mandar o
 * cliente pra fora do portal).
 *
 * Auth: exige sessão válida do cliente (cookie de portal) E que o briefing
 * pertença ao cliente do portal — defesa contra acessar briefing alheio
 * adivinhando o id. Só ENVIADO/RESPONDIDO (nada de rascunho/arquivado).
 *
 * Devolve o `shareToken` (o submit continua indo pro endpoint público já
 * existente POST /api/p/briefing/{shareToken}) + as perguntas normalizadas
 * + respostas anteriores (pra pré-preencher na revisão).
 *
 * Retorno: { id, titulo, shareToken, status, respondidoEm, perguntas, respostas }
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { normalizarPerguntas } from "@/lib/briefing";
import { cookies } from "next/headers";

export async function GET(
  _req: Request,
  { params }: { params: { token: string; briefingId: string } }
) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);

    const briefing = await prisma.briefing.findFirst({
      where: {
        id: params.briefingId,
        clienteId: r.cliente.id,
        status: { in: ["ENVIADO", "RESPONDIDO"] },
        shareToken: { not: null },
      },
      select: {
        id: true,
        titulo: true,
        shareToken: true,
        status: true,
        perguntas: true,
        respostas: true,
        respondidoEm: true,
        shareExpiraEm: true,
      },
    });

    if (!briefing) throw new Error("Briefing não encontrado");
    if (briefing.shareExpiraEm && briefing.shareExpiraEm < new Date()) {
      throw new Error("O preenchimento deste briefing não está mais disponível.");
    }

    const respostas =
      briefing.respostas && typeof briefing.respostas === "object" && !Array.isArray(briefing.respostas)
        ? (briefing.respostas as Record<string, string | string[]>)
        : null;

    return {
      id: briefing.id,
      titulo: briefing.titulo,
      shareToken: briefing.shareToken,
      status: briefing.status,
      respondidoEm: briefing.respondidoEm ? briefing.respondidoEm.toISOString() : null,
      perguntas: normalizarPerguntas(briefing.perguntas),
      respostas,
    };
  });
}
