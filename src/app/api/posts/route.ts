import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { postSchema } from "@/lib/schemas";
import { tryCreateEvent } from "@/lib/google-calendar";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.post.findMany({
      include: { cliente: true },
      orderBy: { dataPublicacao: "asc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = postSchema.parse(await req.json());

    let googleEventId: string | null = null;
    if (data.status === "AGENDADO") {
      const fim = new Date(data.dataPublicacao);
      fim.setHours(fim.getHours() + 1);
      const cliente = await prisma.cliente.findUnique({ where: { id: data.clienteId } });
      const ev = await tryCreateEvent({
        titulo: `[${cliente?.nome ?? "Post"}] ${data.titulo}`,
        descricao: data.legenda ?? undefined,
        inicio: data.dataPublicacao,
        fim,
      });
      googleEventId = ev?.id ?? null;
    }

    return prisma.post.create({ data: { ...data, googleEventId } });
  });
}
