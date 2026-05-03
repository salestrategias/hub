import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { campanhaPagaSchema } from "@/lib/schemas";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = campanhaPagaSchema.partial().parse(await req.json());
    return prisma.campanhaPaga.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.campanhaPaga.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
