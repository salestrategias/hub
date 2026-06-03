/**
 * POST /api/reunioes/[id]/actions/[actionId]/virar-tarefa
 *
 * Promove um action item da reunião a uma Tarefa real:
 *  - cria Tarefa { titulo: texto do action, reuniaoId, clienteId herdado }
 *  - liga ReuniaoAction.tarefaId à tarefa criada (1-1 "AcaoVirouTarefa")
 *
 * Idempotente: se o action já virou tarefa (tarefaId setado e a tarefa
 * ainda existe), retorna a tarefa existente sem duplicar.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: { id: string; actionId: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const action = await prisma.reuniaoAction.findUniqueOrThrow({
      where: { id: params.actionId },
      include: { reuniao: { select: { id: true, clienteId: true } } },
    });

    // Idempotência — já existe tarefa ligada?
    if (action.tarefaId) {
      const existente = await prisma.tarefa.findUnique({ where: { id: action.tarefaId } });
      if (existente) {
        return { ok: true, jaExistia: true, tarefaId: existente.id };
      }
    }

    const tarefa = await prisma.tarefa.create({
      data: {
        titulo: action.texto.slice(0, 200),
        descricao: action.responsavel ? `Responsável sugerido: ${action.responsavel}` : null,
        prioridade: "NORMAL",
        concluida: action.concluido,
        // Herda cliente da reunião; vincula origem
        clienteId: action.reuniao.clienteId ?? null,
        reuniaoId: action.reuniao.id,
      },
    });

    // Liga o action item à tarefa (relação 1-1)
    await prisma.reuniaoAction.update({
      where: { id: action.id },
      data: { tarefaId: tarefa.id },
    });

    return { ok: true, tarefaId: tarefa.id };
  });
}
