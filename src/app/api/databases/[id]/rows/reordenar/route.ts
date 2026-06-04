/**
 * POST /api/databases/[id]/rows/reordenar — reordena/move cards do BOARD
 *   (drag-drop estilo Trello), adaptado ao modelo de rows agrupadas por uma
 *   propriedade SELECT.
 *
 * Body: { groupByPropertyId: string, optionId: string | null, ids: string[] }
 *   - `ids` = rows da coluna de DESTINO, já na nova ordem.
 *   - Para cada id: seta `ordem = index` E `valores[groupByPropertyId] = optionId`
 *     (merge no Json — preserva as demais chaves da linha).
 *   - `optionId = null` → limpa o SELECT (coluna "Sem valor").
 *
 * Cobre num só endpoint:
 *   - Reordenar dentro da coluna (o valor do select não muda; só a ordem).
 *   - Mover entre colunas (a row ganha o novo valor do select).
 *
 * Validação INLINE (sem schemas.ts). O optionId é validado contra as opções
 * da propriedade groupBy via `coerceValor` (id inexistente vira null). Numa
 * transação pra ficar atômico.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { coerceValor, lerConfig, type CellValue } from "@/lib/database";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    // ── Validação inline do payload ──────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const groupByPropertyId =
      typeof body.groupByPropertyId === "string" ? body.groupByPropertyId : null;
    const optionIdRaw =
      typeof body.optionId === "string" && body.optionId.length > 0 ? body.optionId : null;
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string")
      : [];

    if (!groupByPropertyId) throw new Error("groupByPropertyId obrigatório");
    if (ids.length === 0) return { ok: true };

    // A propriedade groupBy precisa existir, ser deste database e ser SELECT.
    const groupProp = await prisma.databaseProperty.findFirst({
      where: { id: groupByPropertyId, databaseId: params.id },
      select: { id: true, tipo: true, config: true },
    });
    if (!groupProp) throw new Error("Propriedade de agrupamento inválida");
    if (groupProp.tipo !== "SELECT") throw new Error("Agrupamento precisa ser SELECT");

    // Normaliza o valor do select (id inexistente → null = "Sem valor").
    const valorSelect = coerceValor(
      "SELECT",
      optionIdRaw,
      lerConfig(groupProp.config)
    ) as string | null;

    // Carrega as rows alvo (restritas a este database) pra fazer o merge do Json.
    const rows = await prisma.databaseRow.findMany({
      where: { id: { in: ids }, databaseId: params.id },
      select: { id: true, valores: true },
    });
    const valoresById = new Map(
      rows.map((r) => [r.id, (r.valores ?? {}) as Record<string, CellValue>])
    );

    await prisma.$transaction(
      ids
        .filter((id) => valoresById.has(id))
        .map((id, index) => {
          const merged: Record<string, CellValue> = {
            ...valoresById.get(id),
            [groupByPropertyId]: valorSelect,
          };
          return prisma.databaseRow.update({
            where: { id },
            data: {
              ordem: index,
              valores: merged as Prisma.InputJsonValue,
            },
          });
        })
    );

    return { ok: true };
  });
}
