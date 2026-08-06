/**
 * POST /api/quadros/[id]/mover-tarefa
 *
 * Move um card pra (coluna, posição). Reescreve a ordem da coluna de
 * destino inteira em transação — colunas de agência têm dezenas de
 * cards, não milhares, então rewrite integral é simples e à prova de
 * buracos/duplicatas de ordem.
 *
 * Body: { tarefaId, colunaId, ordem } — ordem é o índice de inserção.
 *
 * Sincronia: Tarefa.concluida assume Coluna.isConcluido do destino.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const moverSchema = z.object({
  tarefaId: z.string(),
  colunaId: z.string(),
  ordem: z.number().int().min(0),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = moverSchema.parse(await req.json());

    // Defesa: coluna precisa pertencer ao quadro da URL
    const coluna = await prisma.coluna.findUniqueOrThrow({
      where: { id: body.colunaId },
      select: { id: true, quadroId: true, isConcluido: true },
    });
    if (coluna.quadroId !== params.id) {
      throw new Error("Coluna não pertence a este quadro.");
    }

    // Cards do destino sem o que está sendo movido, em ordem atual
    const alvoAtual = await prisma.tarefa.findMany({
      where: { colunaId: body.colunaId, id: { not: body.tarefaId } },
      orderBy: { ordemColuna: "asc" },
      select: { id: true },
    });

    const novaOrdemIds = [...alvoAtual.map((t) => t.id)];
    const idx = Math.min(body.ordem, novaOrdemIds.length);
    novaOrdemIds.splice(idx, 0, body.tarefaId);

    await prisma.$transaction([
      // Card movido: coluna nova + concluida sincronizada
      prisma.tarefa.update({
        where: { id: body.tarefaId },
        data: { colunaId: body.colunaId, concluida: coluna.isConcluido },
      }),
      // Rewrite da ordem do destino inteiro
      ...novaOrdemIds.map((id, i) =>
        prisma.tarefa.update({ where: { id }, data: { ordemColuna: i } })
      ),
    ]);

    return { ok: true };
  });
}
