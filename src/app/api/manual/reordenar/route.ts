/**
 * POST /api/manual/reordenar
 *
 * Atualiza ordem e/ou parentId de múltiplas seções em batch — usado
 * pelo drag-drop da sidebar. Body:
 *   { itens: [{ id, ordem, parentId? }, ...] }
 *
 * Transação garante consistência. Falha de qualquer item reverte tudo.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { docReordenarSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { itens } = docReordenarSchema.parse(await req.json());

    await prisma.$transaction(
      itens.map((i) =>
        prisma.docSecao.update({
          where: { id: i.id },
          data: {
            ordem: i.ordem,
            ...(i.parentId !== undefined ? { parentId: i.parentId || null } : {}),
          },
        })
      )
    );

    return { ok: true, atualizadas: itens.length };
  });
}
