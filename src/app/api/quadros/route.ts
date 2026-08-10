/**
 * GET  /api/quadros — lista quadros (com lazy seed do "Agência" + adoção
 *                     de tarefas órfãs). Retorna contagem de cards.
 * POST /api/quadros — cria quadro novo (com colunas-semente). Aceita
 *                     projetoId pra criar o board de um projeto.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { garantirQuadroAgencia, criarQuadroComSemente } from "@/lib/quadros";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    await garantirQuadroAgencia();

    const quadros = await prisma.quadro.findMany({
      orderBy: [{ tipo: "asc" }, { ordem: "asc" }, { createdAt: "asc" }],
      include: {
        projeto: { select: { id: true, nome: true } },
        colunas: {
          orderBy: { ordem: "asc" },
          select: { id: true, _count: { select: { tarefas: { where: { arquivadaEm: null } } } } },
        },
      },
    });

    return quadros.map((q) => ({
      id: q.id,
      nome: q.nome,
      icone: q.icone,
      tipo: q.tipo,
      projetoId: q.projetoId,
      projetoNome: q.projeto?.nome ?? null,
      totalCards: q.colunas.reduce((s, c) => s + c._count.tarefas, 0),
    }));
  });
}

const criarSchema = z.object({
  nome: z.string().min(1).max(80),
  icone: z.string().max(8).optional().nullable(),
  projetoId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const body = criarSchema.parse(await req.json());

    if (body.projetoId) {
      const existente = await prisma.quadro.findUnique({ where: { projetoId: body.projetoId } });
      if (existente) return existente; // idempotente — projeto já tem board
    }

    return criarQuadroComSemente({
      nome: body.nome.trim(),
      icone: body.icone ?? null,
      tipo: body.projetoId ? "PROJETO" : "AGENCIA",
      projetoId: body.projetoId ?? null,
    });
  });
}
