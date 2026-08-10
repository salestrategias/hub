/**
 * POST   /api/lixeira/[id] — restaura o item (recria a entidade do snapshot)
 * DELETE /api/lixeira/[id] — exclui de vez (remove o snapshot; irreversível)
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { restaurarDaLixeira } from "@/lib/lixeira";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return restaurarDaLixeira(params.id);
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.lixeiraItem.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
