/**
 * PATCH  /api/anexos/[id]   — renomear / reordenar / recategorizar
 * DELETE /api/anexos/[id]   — remove
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { anexoPatchSchema } from "@/lib/schemas";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = anexoPatchSchema.parse(await req.json());
    return prisma.anexo.update({
      where: { id: params.id },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome } : {}),
        ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
        ...(data.tipo !== undefined ? { tipo: data.tipo } : {}),
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.anexo.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
