import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patch = z.object({
  texto: z.string().optional(),
  responsavel: z.string().optional().nullable(),
  prazo: z.string().optional().nullable(),
  concluido: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { actionId: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = patch.parse(await req.json());
    return prisma.reuniaoAction.update({ where: { id: params.actionId }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { actionId: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.reuniaoAction.delete({ where: { id: params.actionId } });
    return { ok: true };
  });
}
