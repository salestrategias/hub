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

    const where: Record<string, unknown> = { arquivadaEm: null };
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

    // Hub 2.0 F1 — criação direto numa coluna do kanban (add inline do
    // board). colunaId chega fora do tarefaSchema; validamos na mão e o
    // card entra no fim da coluna, com concluida sincronizada.
    let colunaExtra: { colunaId: string; ordemColuna: number; concluida: boolean } | null = null;
    if (typeof body.colunaId === "string" && body.colunaId) {
      const coluna = await prisma.coluna.findUnique({
        where: { id: body.colunaId },
        select: { id: true, isConcluido: true },
      });
      if (coluna) {
        const max = await prisma.tarefa.aggregate({
          where: { colunaId: coluna.id },
          _max: { ordemColuna: true },
        });
        colunaExtra = {
          colunaId: coluna.id,
          ordemColuna: (max._max.ordemColuna ?? -1) + 1,
          concluida: coluna.isConcluido,
        };
      }
    }

    const tarefa = await prisma.tarefa.create({
      data: { ...data, ...(colunaExtra ?? {}) },
    });
    void syncMentionsFromValue({ sourceType: "TAREFA", sourceId: tarefa.id }, tarefa.descricao);
    return tarefa;
  });
}
