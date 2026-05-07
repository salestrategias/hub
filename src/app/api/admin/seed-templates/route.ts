import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { seedTemplates } from "@/lib/templates-builtin";

/**
 * Endpoint manual pra popular/atualizar os templates built-in do sistema.
 *
 * Chamado uma vez após o primeiro deploy (ou sempre que built-ins mudarem).
 * Idempotente: roda quantas vezes quiser, atualiza pelo nome.
 *
 * Restrito a usuários ADMIN.
 *
 * Uso:
 *   curl -X POST https://hub.salestrategias.com.br/api/admin/seed-templates \
 *        -H "Cookie: <cookie de sessão>"
 */
export async function POST() {
  return apiHandler(async () => {
    const user = await requireAuth();
    if ((user as { role?: string }).role !== "ADMIN") {
      throw new Error("Apenas ADMIN pode executar o seed de templates");
    }

    await seedTemplates(prisma);

    const total = await prisma.template.count({ where: { criadoPor: null } });
    return { ok: true, builtins: total };
  });
}
