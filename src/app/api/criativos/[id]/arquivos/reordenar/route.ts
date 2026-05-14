/**
 * POST /api/criativos/[id]/arquivos/reordenar
 * Body: { itens: [{ id, ordem }] }
 *
 * Persiste reordenação manual do carrossel/lista de arquivos. Front
 * recalcula `ordem` em múltiplos de 10 (10, 20, 30...) pra deixar espaço
 * pra inserções futuras sem rebalancear.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { criativoArquivosReordenarSchema } from "@/lib/schemas";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { itens } = criativoArquivosReordenarSchema.parse(await req.json());

    await prisma.$transaction(
      itens.map((i) =>
        prisma.criativoArquivo.updateMany({
          where: { id: i.id, criativoId: params.id },
          data: { ordem: i.ordem },
        })
      )
    );

    return { ok: true };
  });
}
