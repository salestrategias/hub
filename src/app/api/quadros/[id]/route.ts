/**
 * GET    /api/quadros/[id] — quadro completo (colunas + cards enriquecidos)
 * PATCH  /api/quadros/[id] — renomear / ícone / reordenar colunas
 * DELETE /api/quadros/[id] — apaga o quadro. Cards sobrevivem (colunaId
 *        vira null via SetNull em cascata) e são re-adotados pelo Agência
 *        no próximo GET /api/quadros. Recusa apagar o último AGENCIA.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const quadro = await prisma.quadro.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        projeto: { select: { id: true, nome: true } },
        colunas: {
          orderBy: { ordem: "asc" },
          include: {
            tarefas: {
              orderBy: { ordemColuna: "asc" },
              include: {
                cliente: { select: { id: true, nome: true } },
                projeto: { select: { id: true, nome: true } },
                checklist: { select: { concluido: true } },
              },
            },
          },
        },
      },
    });

    return {
      id: quadro.id,
      nome: quadro.nome,
      icone: quadro.icone,
      tipo: quadro.tipo,
      projeto: quadro.projeto,
      colunas: quadro.colunas.map((c) => ({
        id: c.id,
        nome: c.nome,
        cor: c.cor,
        ordem: c.ordem,
        isConcluido: c.isConcluido,
        tarefas: c.tarefas.map((t) => ({
          id: t.id,
          titulo: t.titulo,
          prioridade: t.prioridade,
          dataEntrega: t.dataEntrega?.toISOString() ?? null,
          concluida: t.concluida,
          tipoDemanda: t.tipoDemanda,
          cliente: t.cliente,
          projeto: t.projeto,
          checklistTotal: t.checklist.length,
          checklistFeitos: t.checklist.filter((i) => i.concluido).length,
        })),
      })),
    };
  });
}

const patchSchema = z.object({
  nome: z.string().min(1).max(80).optional(),
  icone: z.string().max(8).nullable().optional(),
  // Reordenação de colunas: array completo de IDs na nova ordem
  colunasOrdem: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = patchSchema.parse(await req.json());

    if (body.nome !== undefined || body.icone !== undefined) {
      await prisma.quadro.update({
        where: { id: params.id },
        data: {
          ...(body.nome !== undefined ? { nome: body.nome.trim() } : {}),
          ...(body.icone !== undefined ? { icone: body.icone } : {}),
        },
      });
    }

    if (body.colunasOrdem) {
      // Só reordena colunas que pertencem a este quadro (defesa)
      const proprias = await prisma.coluna.findMany({
        where: { quadroId: params.id },
        select: { id: true },
      });
      const validas = new Set(proprias.map((c) => c.id));
      await prisma.$transaction(
        body.colunasOrdem
          .filter((id) => validas.has(id))
          .map((id, idx) =>
            prisma.coluna.update({ where: { id }, data: { ordem: idx } })
          )
      );
    }

    return { ok: true };
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const quadro = await prisma.quadro.findUniqueOrThrow({ where: { id: params.id } });

    if (quadro.tipo === "AGENCIA") {
      const outros = await prisma.quadro.count({
        where: { tipo: "AGENCIA", id: { not: params.id } },
      });
      if (outros === 0) {
        throw new Error("Não dá pra apagar o último quadro da agência.");
      }
    }

    await prisma.quadro.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
