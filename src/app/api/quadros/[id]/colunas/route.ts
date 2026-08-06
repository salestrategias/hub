/**
 * POST /api/quadros/[id]/colunas — adiciona coluna ao final do quadro.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const criarSchema = z.object({
  nome: z.string().min(1).max(60),
  cor: z.string().max(9).optional().nullable(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = criarSchema.parse(await req.json());

    const max = await prisma.coluna.aggregate({
      where: { quadroId: params.id },
      _max: { ordem: true },
    });

    return prisma.coluna.create({
      data: {
        quadroId: params.id,
        nome: body.nome.trim(),
        cor: body.cor ?? null,
        ordem: (max._max.ordem ?? -1) + 1,
      },
    });
  });
}
