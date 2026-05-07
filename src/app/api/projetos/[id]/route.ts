import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { projetoSchema } from "@/lib/schemas";
import { tryDeleteEvent } from "@/lib/google-calendar";
import { syncMentionsFromValue, deleteMentionsOf } from "@/lib/mentions";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.projeto.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true } },
        tarefas: {
          orderBy: [{ concluida: "asc" }, { dataEntrega: "asc" }],
          select: { id: true, titulo: true, concluida: true, prioridade: true, dataEntrega: true },
        },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = projetoSchema.partial().omit({ criarPastaDrive: true }).parse(body);
    const updated = await prisma.projeto.update({ where: { id: params.id }, data });
    if (data.descricao !== undefined) {
      void syncMentionsFromValue({ sourceType: "PROJETO", sourceId: params.id }, data.descricao);
    }
    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const p = await prisma.projeto.findUnique({ where: { id: params.id } });
    if (p?.googleEventId) await tryDeleteEvent({ eventId: p.googleEventId });
    await prisma.projeto.delete({ where: { id: params.id } });
    void deleteMentionsOf({ sourceType: "PROJETO", sourceId: params.id });
    return { ok: true };
  });
}
