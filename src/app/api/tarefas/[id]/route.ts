import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { tarefaSchema } from "@/lib/schemas";
import { tryDeleteEvent } from "@/lib/google-calendar";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = tarefaSchema.partial().parse(body);
    return prisma.tarefa.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const t = await prisma.tarefa.findUnique({ where: { id: params.id } });
    if (t?.googleEventId) await tryDeleteEvent({ eventId: t.googleEventId });
    await prisma.tarefa.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
