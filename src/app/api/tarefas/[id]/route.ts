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

    // Hub 2.0 F1 — sincronia inversa com o kanban: marcar concluída fora
    // do board (sheet, lista, checkbox) move o card pra coluna certa do
    // quadro em que ele mora. Fire-and-forget: falha aqui não pode
    // derrubar o PATCH principal.
    if (data.concluida !== undefined && updated.colunaId) {
      void (async () => {
        const atual = await prisma.coluna.findUnique({
          where: { id: updated.colunaId! },
          select: { quadroId: true, isConcluido: true },
        });
        if (!atual || atual.isConcluido === data.concluida) return;
        // Destino: coluna isConcluido do mesmo quadro (concluiu) ou a
        // primeira coluna aberta (reabriu)
        const destino = await prisma.coluna.findFirst({
          where: { quadroId: atual.quadroId, isConcluido: data.concluida },
          orderBy: { ordem: data.concluida ? "desc" : "asc" },
        });
        if (!destino) return;
        const max = await prisma.tarefa.aggregate({
          where: { colunaId: destino.id },
          _max: { ordemColuna: true },
        });
        await prisma.tarefa.update({
          where: { id: params.id },
          data: { colunaId: destino.id, ordemColuna: (max._max.ordemColuna ?? -1) + 1 },
        });
      })().catch(() => undefined);
    }

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
