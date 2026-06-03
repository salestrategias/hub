/**
 * POST /api/databases/[id]/views — cria uma view nova.
 *   Aceita { tipo: TABELA|BOARD|CALENDARIO, nome?, config? }. Nome default
 *   por tipo se não vier. Ordem = depois da última view.
 *
 * Convenção de config (Json): { groupByPropertyId?, datePropertyId?,
 *   propsVisiveis?: string[] }. Espelha src/components/database-client.tsx.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { databaseViewCreateSchema } from "@/lib/schemas";
import type { Prisma, ViewTipo } from "@prisma/client";

const NOME_DEFAULT: Record<ViewTipo, string> = {
  TABELA: "Tabela",
  BOARD: "Board",
  CALENDARIO: "Calendário",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = databaseViewCreateSchema.parse(await req.json().catch(() => ({})));

    const max = await prisma.databaseView.aggregate({
      where: { databaseId: params.id },
      _max: { ordem: true },
    });
    const ordem = data.ordem ?? (max._max.ordem ?? -1) + 1;

    return prisma.databaseView.create({
      data: {
        databaseId: params.id,
        nome: data.nome?.trim() || NOME_DEFAULT[data.tipo],
        tipo: data.tipo,
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        ordem,
      },
    });
  });
}
