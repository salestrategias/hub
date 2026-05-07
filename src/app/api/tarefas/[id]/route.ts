import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { tarefaSchema } from "@/lib/schemas";
import { tryDeleteEvent } from "@/lib/google-calendar";
import { syncMentionsFromValue, deleteMentionsOf } from "@/lib/mentions";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.tarefa.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true } },
        projeto: { select: { id: true, nome: true } },
        checklist: { orderBy: { ordem: "asc" } },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = tarefaSchema.partial().parse(body);
    const updated = await prisma.tarefa.update({ where: { id: params.id }, data });
    if (data.descricao !== undefined) {
      void syncMentionsFromValue({ sourceType: "TAREFA", sourceId: params.id }, data.descricao);
    }
    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const t = await prisma.tarefa.findUnique({ where: { id: params.id } });
    if (t?.googleEventId) await tryDeleteEvent({ eventId: t.googleEventId });
    await prisma.tarefa.delete({ where: { id: params.id } });
    void deleteMentionsOf({ sourceType: "TAREFA", sourceId: params.id });
    return { ok: true };
  });
}
