/**
 * GET    /api/databases/[id]  — database completo: propriedades + views +
 *                               linhas, tudo ordenado. Payload da página.
 * PATCH  /api/databases/[id]  — partial: nome / icone / descricao.
 * DELETE /api/databases/[id]  — cascade (propriedades/linhas/views, schema).
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { databaseSchema } from "@/lib/schemas";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.database.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        propriedades: { orderBy: { ordem: "asc" } },
        views: { orderBy: { ordem: "asc" } },
        linhas: { orderBy: { ordem: "asc" } },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = databaseSchema.partial().parse(await req.json());
    return prisma.database.update({
      where: { id: params.id },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome.trim() || "Novo database" } : {}),
        ...(data.icone !== undefined ? { icone: data.icone || null } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao || null } : {}),
        ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
        ...(data.parentPageId !== undefined ? { parentPageId: data.parentPageId || null } : {}),
      },
      select: { id: true, nome: true, icone: true, descricao: true, parentPageId: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.database.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
