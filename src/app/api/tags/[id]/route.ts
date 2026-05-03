import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  nome: z.string().min(1).max(40).optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = patchSchema.parse(await req.json());
    return prisma.tag.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.tag.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
