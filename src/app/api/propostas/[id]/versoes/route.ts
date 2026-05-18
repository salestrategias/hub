/**
 * GET /api/propostas/[id]/versoes
 *
 * Lista todas as versões da thread da proposta (a raiz + todas as revisões).
 *
 * Algoritmo:
 *  1. Carrega proposta atual e descobre raizId = versaoRaizId ?? id
 *  2. Busca todas com (id=raizId OR versaoRaizId=raizId)
 *  3. Retorna ordenado por versao ASC
 *
 * Retorno: VersaoMini[] — compatível com o componente PropostaVersoesHeader.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const atual = await prisma.proposta.findUniqueOrThrow({
      where: { id: params.id },
      select: { id: true, versaoRaizId: true },
    });
    const raizId = atual.versaoRaizId ?? atual.id;

    const versoes = await prisma.proposta.findMany({
      where: { OR: [{ id: raizId }, { versaoRaizId: raizId }] },
      select: {
        id: true,
        numero: true,
        versao: true,
        versaoAtual: true,
        status: true,
        createdAt: true,
        motivoRevisao: true,
      },
      orderBy: { versao: "asc" },
    });

    return versoes;
  });
}
