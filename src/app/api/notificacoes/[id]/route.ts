import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Marca uma notificação como lida (ou não-lida via `{ lida: false }`).
 * Dono = usuário logado, evita user mexer em notificação alheia.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = (await req.json().catch(() => ({}))) as { lida?: boolean };
    const lida = body.lida ?? true;

    return prisma.notificacao.update({
      where: { id: params.id, userId: user.id },
      data: { lida, lidaEm: lida ? new Date() : null },
    });
  });
}

/**
 * Deleta uma notificação (cleanup manual).
 */
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    await prisma.notificacao.delete({
      where: { id: params.id, userId: user.id },
    });
    return { ok: true };
  });
}
