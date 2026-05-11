import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { conteudoSalSchema } from "@/lib/schemas";
import { tryCreateEvent, tryDeleteEvent, tryUpdateEvent } from "@/lib/google-calendar";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.conteudoSAL.findUniqueOrThrow({ where: { id: params.id } });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = conteudoSalSchema.partial().parse(await req.json());

    const atual = await prisma.conteudoSAL.findUniqueOrThrow({ where: { id: params.id } });

    // Sync com Google Agenda baseado em transição de status
    let googleEventId = atual.googleEventId;
    const novoStatus = data.status ?? atual.status;
    const dataPub = data.dataPublicacao ?? atual.dataPublicacao;
    const titulo = data.titulo ?? atual.titulo;

    if (atual.status !== "AGENDADO" && novoStatus === "AGENDADO") {
      const fim = new Date(dataPub);
      fim.setHours(fim.getHours() + 1);
      const ev = await tryCreateEvent({
        titulo: `[SAL] ${titulo}`,
        descricao: (data.copy ?? atual.copy) ?? undefined,
        inicio: dataPub,
        fim,
      });
      googleEventId = ev?.id ?? null;
    } else if (atual.status === "AGENDADO" && novoStatus !== "AGENDADO" && atual.googleEventId) {
      await tryDeleteEvent({ eventId: atual.googleEventId });
      googleEventId = null;
    } else if (novoStatus === "AGENDADO" && atual.googleEventId) {
      const fim = new Date(dataPub);
      fim.setHours(fim.getHours() + 1);
      await tryUpdateEvent({ eventId: atual.googleEventId, titulo: `[SAL] ${titulo}`, inicio: dataPub, fim });
    }

    return prisma.conteudoSAL.update({
      where: { id: params.id },
      data: { ...data, googleEventId },
    });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const c = await prisma.conteudoSAL.findUnique({ where: { id: params.id } });
    if (c?.googleEventId) await tryDeleteEvent({ eventId: c.googleEventId });
    await prisma.conteudoSAL.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
