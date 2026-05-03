import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { mindMapSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.mindMap.findUniqueOrThrow({ where: { id: params.id } });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = mindMapSchema.partial().parse(await req.json());
    return prisma.mindMap.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.mindMap.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
