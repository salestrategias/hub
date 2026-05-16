/**
 * GET /api/manual/hub
 *
 * Retorna lista achatada de seções publicadas do Manual do Hub.
 * Usado pelo AjudaTrigger (modal global) pra montar o índice.
 *
 * Roda lazy seed se categoria estiver vazia.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { seedManualSeNecessario } from "@/lib/manual-seed";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    await seedManualSeNecessario("HUB");

    return prisma.docSecao.findMany({
      where: { tipo: "HUB", publicada: true },
      orderBy: [{ parentId: "asc" }, { ordem: "asc" }],
      select: {
        id: true,
        titulo: true,
        slug: true,
        icone: true,
        parentId: true,
        ordem: true,
      },
    });
  });
}
