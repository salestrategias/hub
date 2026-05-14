/**
 * POST /api/criativos/[id]/vincular-campanha
 * Body: { campanhaPagaId: string | null }
 *
 * Vincula (ou desvincula passando null) um criativo a uma CampanhaPaga
 * existente. Validamos que a campanha pertence ao mesmo cliente do
 * criativo — sem isso, daria pra "linkar" peça de cliente A com
 * campanha de cliente B.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { criativoVincularCampanhaSchema } from "@/lib/schemas";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = criativoVincularCampanhaSchema.parse(await req.json());

    const criativo = await prisma.criativo.findUniqueOrThrow({ where: { id: params.id } });

    if (data.campanhaPagaId) {
      const camp = await prisma.campanhaPaga.findUnique({ where: { id: data.campanhaPagaId } });
      if (!camp) throw new Error("Campanha não encontrada");
      if (camp.clienteId !== criativo.clienteId) {
        throw new Error("Campanha pertence a outro cliente");
      }
    }

    return prisma.criativo.update({
      where: { id: params.id },
      data: { campanhaPagaId: data.campanhaPagaId },
    });
  });
}
