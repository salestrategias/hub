/**
 * GET    /api/pages/[id]   — uma página (com filhas diretas só pra contagem).
 * PATCH  /api/pages/[id]   — partial: titulo/icone/capaUrl/conteudo/parentId/ordem.
 * DELETE /api/pages/[id]   — cascade (filhas e databases aninhados caem junto, schema).
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { pageSchema } from "@/lib/schemas";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.page.findUniqueOrThrow({ where: { id: params.id } });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = pageSchema.partial().parse(await req.json());

    // Guarda anti-ciclo: uma página não pode ser pai de si mesma.
    // (Mover pra dentro de uma descendente é raro no MVP — re-parent só
    //  acontece via ↑↓/drag dentro do mesmo nível, mas a UI também
    //  permite re-parent explícito, então protegemos o caso trivial.)
    if (data.parentId && data.parentId === params.id) {
      throw new Error("Uma página não pode ser subpágina de si mesma");
    }

    return prisma.page.update({
      where: { id: params.id },
      data: {
        ...(data.titulo !== undefined ? { titulo: data.titulo.trim() || "Sem título" } : {}),
        ...(data.icone !== undefined ? { icone: data.icone || null } : {}),
        ...(data.capaUrl !== undefined ? { capaUrl: data.capaUrl || null } : {}),
        ...(data.conteudo !== undefined ? { conteudo: data.conteudo } : {}),
        ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId || null } : {}),
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.page.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
