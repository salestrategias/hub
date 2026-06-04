import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Reordena/move projetos no kanban (drag-drop estilo Trello).
 *
 * Body: { status: ProjetoStatus, ids: string[] }
 *   - `ids` = projetos da coluna de DESTINO, já na nova ordem.
 *   - Para cada id, seta `ordem = index` e `status = status`.
 *
 * Cobre os dois casos num só endpoint:
 *   - Reordenar dentro da coluna (status não muda; só a ordem).
 *   - Mover entre colunas (id veio de outra coluna → ganha o novo status).
 *
 * Validação INLINE (sem zod compartilhado, pra não colidir com schemas.ts):
 *   - status ∈ ProjetoStatus.
 *   - ids: array de strings.
 *
 * Numa transação pra ficar atômico — ou aplica tudo ou nada.
 */
const STATUS_VALIDOS = ["BRIEFING", "PRODUCAO", "REVISAO", "APROVACAO", "ENTREGUE"] as const;
type ProjetoStatus = (typeof STATUS_VALIDOS)[number];

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const body = (await req.json()) as { status?: unknown; ids?: unknown };

    const status = body.status;
    const ids = body.ids;
    if (typeof status !== "string" || !STATUS_VALIDOS.includes(status as ProjetoStatus)) {
      throw new Error("status inválido");
    }
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      throw new Error("ids inválidos");
    }

    if (ids.length === 0) return { ok: true };

    await prisma.$transaction(
      (ids as string[]).map((id, index) =>
        prisma.projeto.update({
          where: { id },
          data: { ordem: index, status: status as ProjetoStatus },
        })
      )
    );

    return { ok: true };
  });
}
