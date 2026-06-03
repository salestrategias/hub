/**
 * PATCH /api/databases/[id]/views/[viewId] — renomeia a view e/ou atualiza
 *   seu config (filtros/ordenação/groupBy — usados nos próximos blocos;
 *   por ora a view TABELA não precisa de config, mas o endpoint já existe).
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
