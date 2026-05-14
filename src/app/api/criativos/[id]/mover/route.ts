/**
 * POST /api/criativos/[id]/mover
 * Body: { status: CriativoStatus }
 *
 * Endpoint dedicado pro drag-drop do kanban. Atualiza só o status,
 * pra evitar passar o schema completo de criativo em cada drop.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const moverSchema = z.object({
  status: z.enum(["RASCUNHO", "EM_APROVACAO", "APROVADO", "RECUSADO", "NO_AR", "PAUSADO", "ENCERRADO"]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = moverSchema.parse(await req.json());
    return prisma.criativo.update({
      where: { id: params.id },
      data: { status: data.status },
    });
  });
}
