import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createEvent } from "@/lib/google-calendar";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const t = await prisma.tarefa.findUniqueOrThrow({ where: { id: params.id } });
    if (!t.dataEntrega) throw new Error("Tarefa sem data de entrega");
    const fim = new Date(t.dataEntrega);
    fim.setHours(fim.getHours() + 1);
    const evento = await createEvent({
      titulo: `[Tarefa] ${t.titulo}`,
      descricao: t.descricao ?? undefined,
      inicio: t.dataEntrega,
      fim,
    });
    await prisma.tarefa.update({ where: { id: t.id }, data: { googleEventId: evento.id } });
    return { ok: true, eventId: evento.id };
  });
}
