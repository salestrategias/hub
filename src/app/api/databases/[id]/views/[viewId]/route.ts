/**
 * PATCH  /api/databases/[id]/views/[viewId] — renomeia a view e/ou atualiza
 *   seu config ({ groupByPropertyId?, datePropertyId?, propsVisiveis?[] }).
 * DELETE /api/databases/[id]/views/[viewId] — remove a view. Bloqueia a
 *   exclusão da ÚLTIMA view do database (todo database precisa de ≥1).
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { databaseViewSchema } from "@/lib/schemas";
import type { Prisma } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; viewId: string } }
) {
  return apiHandler(async () => {
    await requireAuth();
    const data = databaseViewSchema.parse(await req.json());
    return prisma.databaseView.update({
      where: { id: params.viewId },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome.trim() || "Tabela" } : {}),
        ...(data.config !== undefined
          ? { config: (data.config ?? undefined) as Prisma.InputJsonValue | undefined }
          : {}),
      },
    });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; viewId: string } }
) {
  return apiHandler(async () => {
    await requireAuth();
    const total = await prisma.databaseView.count({
      where: { databaseId: params.id },
    });
    if (total <= 1) {
      throw new Error("Não dá pra excluir a última view do database.");
    }
    await prisma.databaseView.delete({ where: { id: params.viewId } });
    return { ok: true };
  });
}
