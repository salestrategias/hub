/**
 * GET  /api/databases  — lista todos os databases (flat, leve). O front
 *                        encaixa na árvore do workspace por parentPageId.
 * POST /api/databases  — cria database. Aceita { nome?, parentPageId? }.
 *                        Semeia 1 propriedade TEXTO "Nome" + 1 view TABELA.
 *
 * Motor de databases configuráveis (estilo Notion). Comportamento por tipo
 * de propriedade vive em src/lib/database.ts.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { databaseSchema } from "@/lib/schemas";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.database.findMany({
      orderBy: [{ parentPageId: "asc" }, { ordem: "asc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        icone: true,
        ordem: true,
        parentPageId: true,
        updatedAt: true,
      },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = databaseSchema.partial().parse(await req.json().catch(() => ({})));

    // Ordem default: depois do último irmão (mesmo parentPageId).
    let ordem = data.ordem;
    if (ordem === undefined) {
      const max = await prisma.database.aggregate({
        where: { parentPageId: data.parentPageId ?? null },
        _max: { ordem: true },
      });
      ordem = (max._max.ordem ?? 0) + 10;
    }

    return prisma.database.create({
      data: {
        nome: data.nome?.trim() || "Novo database",
        icone: data.icone || null,
        descricao: data.descricao || null,
        parentPageId: data.parentPageId || null,
        ordem,
        criadoPor: user.id,
        // Semente: 1 coluna-título "Nome" (TEXTO) + 1 view "Tabela".
        propriedades: {
          create: [{ nome: "Nome", tipo: "TEXTO", ordem: 0 }],
        },
        views: {
          create: [{ nome: "Tabela", tipo: "TABELA", ordem: 0 }],
        },
      },
      select: { id: true, nome: true, icone: true, parentPageId: true },
    });
  });
}
