import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { leadReordenarSchema } from "@/lib/schemas";

/**
 * Reordena/move leads no kanban (drag-drop estilo Trello).
 *
 * Body: { status: LeadStatus, ids: string[] }
 *   - `ids` = leads da coluna de DESTINO, já na nova ordem.
 *   - Para cada id, seta `ordem = index` e `status = status`.
 *
 * Cobre os dois casos num só endpoint:
 *   - Reordenar dentro da coluna (status não muda; só a ordem).
 *   - Mover entre colunas (id veio de outra coluna → ganha o novo status).
 *
 * Numa transação pra ficar atômico — ou aplica tudo ou nada.
 */
export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { status, ids } = leadReordenarSchema.parse(await req.json());

    if (ids.length === 0) return { ok: true };

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.lead.update({
          where: { id },
          data: { ordem: index, status },
        })
      )
    );

    return { ok: true };
  });
}
