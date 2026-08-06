/**
 * PATCH  /api/colunas/[id] — renomear / cor / flag "conta como concluído"
 * DELETE /api/colunas/[id] — apaga a coluna movendo os cards pra coluna
 *        vizinha (anterior, ou próxima se era a primeira). Recusa apagar
 *        a última coluna do quadro.
 *
 * Regra de sincronia: mudar isConcluido de uma coluna atualiza
 * Tarefa.concluida de todos os cards que estão nela.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  nome: z.string().min(1).max(60).optional(),
  cor: z.string().max(9).nullable().optional(),
  isConcluido: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = patchSchema.parse(await req.json());

    const coluna = await prisma.coluna.update({
      where: { id: params.id },
      data: {
        ...(body.nome !== undefined ? { nome: body.nome.trim() } : {}),
        ...(body.cor !== undefined ? { cor: body.cor } : {}),
        ...(body.isConcluido !== undefined ? { isConcluido: body.isConcluido } : {}),
      },
    });

    // Sincroniza o bool das tarefas que já moram nesta coluna
    if (body.isConcluido !== undefined) {
      await prisma.tarefa.updateMany({
        where: { colunaId: params.id },
        data: { concluida: body.isConcluido },
      });
    }

    return coluna;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const coluna = await prisma.coluna.findUniqueOrThrow({ where: { id: params.id } });

    const irmas = await prisma.coluna.findMany({
      where: { quadroId: coluna.quadroId, id: { not: coluna.id } },
      orderBy: { ordem: "asc" },
    });
    if (irmas.length === 0) {
      throw new Error("O quadro precisa de pelo menos uma coluna.");
    }

    // Destino: vizinha anterior; se era a primeira, a próxima
    const destino =
      [...irmas].reverse().find((c) => c.ordem < coluna.ordem) ?? irmas[0];

    const maxOrdem = await prisma.tarefa.aggregate({
      where: { colunaId: destino.id },
      _max: { ordemColuna: true },
    });
    let proxima = (maxOrdem._max.ordemColuna ?? -1) + 1;

    const movidas = await prisma.tarefa.findMany({
      where: { colunaId: coluna.id },
      orderBy: { ordemColuna: "asc" },
      select: { id: true },
    });
    await prisma.$transaction([
      ...movidas.map((t) =>
        prisma.tarefa.update({
          where: { id: t.id },
          data: {
            colunaId: destino.id,
            ordemColuna: proxima++,
            concluida: destino.isConcluido,
          },
        })
      ),
      prisma.coluna.delete({ where: { id: coluna.id } }),
    ]);

    return { ok: true, movidasPara: destino.id, total: movidas.length };
  });
}
