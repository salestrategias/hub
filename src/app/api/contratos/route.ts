import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { contratoSchema } from "@/lib/schemas";
import { tryCreateEvent } from "@/lib/google-calendar";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.contrato.findMany({
      include: { cliente: true },
      orderBy: { dataFim: "asc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = contratoSchema.parse(await req.json());

    // Aviso de vencimento: criar evento 30 dias antes da dataFim
    const aviso = new Date(data.dataFim);
    aviso.setDate(aviso.getDate() - 30);
    let googleEventId: string | null = null;
    if (aviso > new Date()) {
      const fim = new Date(aviso); fim.setHours(fim.getHours() + 1);
      const cliente = await prisma.cliente.findUnique({ where: { id: data.clienteId } });
      const ev = await tryCreateEvent({
        titulo: `[Contrato] Vencimento próximo — ${cliente?.nome ?? ""}`,
        descricao: `Contrato vence em ${data.dataFim.toLocaleDateString("pt-BR")}.\n${data.observacoes ?? ""}`,
        inicio: aviso,
        fim,
      });
      googleEventId = ev?.id ?? null;
    }

    return prisma.contrato.create({ data: { ...data, googleEventId } });
  });
}
