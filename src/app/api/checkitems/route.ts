import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  tarefaId: z.string(),
  texto: z.string().min(1),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = schema.parse(await req.json());
    const max = await prisma.checkItem.aggregate({
      where: { tarefaId: data.tarefaId },
      _max: { ordem: true },
    });
    return prisma.checkItem.create({ data: { ...data, ordem: (max._max.ordem ?? 0) + 1 } });
  });
}
