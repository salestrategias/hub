import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { contratoSchema } from "@/lib/schemas";
import { tryDeleteEvent } from "@/lib/google-calendar";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = contratoSchema.partial().parse(await req.json());
    return prisma.contrato.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const c = await prisma.contrato.findUnique({ where: { id: params.id } });
    if (c?.googleEventId) await tryDeleteEvent({ eventId: c.googleEventId });
    await prisma.contrato.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
