import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { postSchema } from "@/lib/schemas";
import { tryCreateEvent, tryDeleteEvent, tryUpdateEvent } from "@/lib/google-calendar";
import { syncMentionsFromValue, deleteMentionsOf } from "@/lib/mentions";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.post.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true } },
        arquivos: { orderBy: { ordem: "asc" } },
        comentarios: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = postSchema.partial().parse(body);

    const atual = await prisma.post.findUniqueOrThrow({ where: { id: params.id } });

    // Sync com Google Agenda baseado em transição de status
    let googleEventId = atual.googleEventId;
    const novoStatus = data.status ?? atual.status;
    const dataPub = data.dataPublicacao ?? atual.dataPublicacao;
    const titulo = data.titulo ?? atual.titulo;

    if (atual.status !== "AGENDADO" && novoStatus === "AGENDADO") {
      const fim = new Date(dataPub); fim.setHours(fim.getHours() + 1);
      const ev = await tryCreateEvent({
        titulo: `[Post] ${titulo}`,
        descricao: (data.legenda ?? atual.legenda) ?? undefined,
        inicio: dataPub,
        fim,
      });
      googleEventId = ev?.id ?? null;
    } else if (atual.status === "AGENDADO" && novoStatus !== "AGENDADO" && atual.googleEventId) {
      await tryDeleteEvent({ eventId: atual.googleEventId });
      googleEventId = null;
    } else if (novoStatus === "AGENDADO" && atual.googleEventId) {
      const fim = new Date(dataPub); fim.setHours(fim.getHours() + 1);
      await tryUpdateEvent({ eventId: atual.googleEventId, titulo: `[Post] ${titulo}`, inicio: dataPub, fim });
    }

    const updated = await prisma.post.update({ where: { id: params.id }, data: { ...data, googleEventId } });
    if (data.legenda !== undefined) {
      void syncMentionsFromValue({ sourceType: "POST", sourceId: params.id }, data.legenda);
    }
    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const p = await prisma.post.findUnique({ where: { id: params.id } });
    if (p?.googleEventId) await tryDeleteEvent({ eventId: p.googleEventId });
    await prisma.post.delete({ where: { id: params.id } });
    void deleteMentionsOf({ sourceType: "POST", sourceId: params.id });
    return { ok: true };
  });
}
