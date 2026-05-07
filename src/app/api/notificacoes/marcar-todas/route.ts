import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Marca todas as notificações não lidas do usuário como lidas.
 */
export async function POST() {
  return apiHandler(async () => {
    const user = await requireAuth();
    const result = await prisma.notificacao.updateMany({
      where: { userId: user.id, lida: false },
      data: { lida: true, lidaEm: new Date() },
    });
    return { atualizadas: result.count };
  });
}
