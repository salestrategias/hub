import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  texto: z.string().optional(),
  concluido: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = schema.parse(await req.json());
    return prisma.checkItem.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.checkItem.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
