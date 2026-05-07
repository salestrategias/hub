import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { tarefaSchema } from "@/lib/schemas";
import { syncMentionsFromValue } from "@/lib/mentions";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const filtro = searchParams.get("filtro");
    const clienteId = searchParams.get("clienteId");

    const where: Record<string, unknown> = {};
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const fim = new Date(hoje); fim.setDate(fim.getDate() + 1);
    const fimSemana = new Date(hoje); fimSemana.setDate(fimSemana.getDate() + 7);

    if (filtro === "hoje") where.dataEntrega = { gte: hoje, lt: fim };
    if (filtro === "semana") where.dataEntrega = { gte: hoje, lt: fimSemana };
    if (clienteId) where.clienteId = clienteId;

    return prisma.tarefa.findMany({
      where,
      include: { cliente: true, projeto: true, checklist: { orderBy: { ordem: "asc" } } },
      orderBy: [{ concluida: "asc" }, { dataEntrega: "asc" }],
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = tarefaSchema.parse(body);
    const tarefa = await prisma.tarefa.create({ data });
    void syncMentionsFromValue({ sourceType: "TAREFA", sourceId: tarefa.id }, tarefa.descricao);
    return tarefa;
  });
}
