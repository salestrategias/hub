/**
 * GET /api/p/cliente/[token]/briefings
 *
 * Lista os briefings DESTE cliente que estão disponíveis pra ele no portal.
 * Alimenta a aba "Briefing" do Portal do Cliente.
 *
 * Auth: exige sessão válida do cliente (cookie de portal). Read-only.
 *
 * Só expõe briefings com status ENVIADO (pendente de resposta) ou RESPONDIDO
 * (já respondeu — pode revisar). NUNCA expõe RASCUNHO nem ARQUIVADO, e nunca
 * vaza briefings de outro cliente (filtra por clienteId do portal).
 *
 * Retorno: { briefings: [{ id, titulo, status, shareToken, respondidoEm }] }
 * Briefings sem shareToken são descartados (sem ele o cliente não tem como
 * preencher pelo formulário público).
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);

    const briefings = await prisma.briefing.findMany({
      where: {
        clienteId: r.cliente.id,
        status: { in: ["ENVIADO", "RESPONDIDO"] },
        shareToken: { not: null },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        titulo: true,
        status: true,
        shareToken: true,
        respondidoEm: true,
      },
    });

    return {
      briefings: briefings.map((b) => ({
        id: b.id,
        titulo: b.titulo,
        status: b.status,
        shareToken: b.shareToken,
        respondidoEm: b.respondidoEm ? b.respondidoEm.toISOString() : null,
      })),
    };
  });
}
