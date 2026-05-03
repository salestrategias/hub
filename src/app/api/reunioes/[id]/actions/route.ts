import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { reuniaoActionSchema } from "@/lib/schemas";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = reuniaoActionSchema.parse({ ...body, reuniaoId: params.id });
    const max = await prisma.reuniaoAction.aggregate({
      where: { reuniaoId: params.id },
      _max: { ordem: true },
    });
    return prisma.reuniaoAction.create({
      data: { ...data, ordem: (max._max.ordem ?? 0) + 1 },
    });
  });
}
