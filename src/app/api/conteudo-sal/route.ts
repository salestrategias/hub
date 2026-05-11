import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { conteudoSalSchema } from "@/lib/schemas";
import { tryCreateEvent } from "@/lib/google-calendar";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const formato = searchParams.get("formato");
    const status = searchParams.get("status");
    const pilar = searchParams.get("pilar");

    return prisma.conteudoSAL.findMany({
      where: {
        ...(formato ? { formato: formato as never } : {}),
        ...(status ? { status: status as never } : {}),
        ...(pilar ? { pilar } : {}),
      },
      orderBy: { dataPublicacao: "asc" },
      take: 500,
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = conteudoSalSchema.parse(await req.json());

    // Sync com Google Agenda se já vier agendado
    let googleEventId: string | null = null;
    if (data.status === "AGENDADO") {
      const fim = new Date(data.dataPublicacao);
      fim.setHours(fim.getHours() + 1);
      const ev = await tryCreateEvent({
        titulo: `[SAL] ${data.titulo}`,
        descricao: data.copy ?? undefined,
        inicio: data.dataPublicacao,
        fim,
      });
      googleEventId = ev?.id ?? null;
    }

    return prisma.conteudoSAL.create({ data: { ...data, googleEventId } });
  });
}
