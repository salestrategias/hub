/**
 * GET  /api/pages   — lista TODAS as páginas do sistema (flat).
 *                     O front monta a hierarquia por parentId.
 * POST /api/pages   — cria nova página. Aceita { titulo?, parentId?, icone? }.
 *                     Default titulo "Sem título". Ordem = depois da última
 *                     irmã (mesmo parentId).
 *
 * Workspace estilo Notion — árvore livre de páginas com editor BlockNote.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { pageSchema } from "@/lib/schemas";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.page.findMany({
      orderBy: [{ parentId: "asc" }, { ordem: "asc" }, { titulo: "asc" }],
      select: {
        id: true,
        titulo: true,
        icone: true,
        ordem: true,
        parentId: true,
        updatedAt: true,
      },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = pageSchema.partial().parse(await req.json().catch(() => ({})));

    // Ordem default: depois da última irmã no mesmo nível.
    let ordem = data.ordem;
    if (ordem === undefined) {
      const max = await prisma.page.aggregate({
        where: { parentId: data.parentId ?? null },
        _max: { ordem: true },
      });
      ordem = (max._max.ordem ?? 0) + 10;
    }

    return prisma.page.create({
      data: {
        titulo: data.titulo?.trim() || "Sem título",
        icone: data.icone || null,
        capaUrl: data.capaUrl || null,
        conteudo: data.conteudo ?? "",
        parentId: data.parentId || null,
        ordem,
        criadoPor: user.id,
      },
    });
  });
}
