/**
 * PATCH  /api/databases/[id]/rows/[rowId] — atualiza valores (MERGE no Json,
 *        por propertyId, coeridos por tipo) e/ou ordem. Só as chaves enviadas
 *        em `valores` mudam — o resto da linha é preservado.
 * DELETE /api/databases/[id]/rows/[rowId] — remove a linha.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { databaseRowSchema } from "@/lib/schemas";
import { coerceValor, lerConfig, type CellValue } from "@/lib/database";
import type { Prisma } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; rowId: string } }
) {
  return apiHandler(async () => {
    await requireAuth();
    const data = databaseRowSchema.parse(await req.json());

    const updateData: Prisma.DatabaseRowUpdateInput = {};
    if (data.ordem !== undefined) updateData.ordem = data.ordem;

    if (data.valores) {
      // Merge: lê valores atuais + props pra coerção, sobrescreve só as chaves
      // enviadas. Mantém órfãos (de colunas deletadas) intactos.
      const [row, props] = await Promise.all([
        prisma.databaseRow.findUniqueOrThrow({
          where: { id: params.rowId },
          select: { valores: true },
        }),
        prisma.databaseProperty.findMany({
          where: { databaseId: params.id },
          select: { id: true, tipo: true, config: true },
        }),
      ]);

      const atual = (row.valores ?? {}) as Record<string, CellValue>;
      const merged: Record<string, CellValue> = { ...atual };
      const propById = new Map(props.map((p) => [p.id, p]));

      for (const [propId, valor] of Object.entries(data.valores)) {
        const p = propById.get(propId);
        if (!p) continue; // ignora chaves que não são propriedades válidas
        merged[propId] = coerceValor(p.tipo, valor, lerConfig(p.config));
      }
      updateData.valores = merged as Prisma.InputJsonValue;
    }

    return prisma.databaseRow.update({
      where: { id: params.rowId },
      data: updateData,
    });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; rowId: string } }
) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.databaseRow.delete({ where: { id: params.rowId } });
    return { ok: true };
  });
}
