/**
 * POST /api/posts/[id]/arquivos/reordenar
 *
 * Atualiza `ordem` em batch (usado por drag-drop). Body:
 *   { itens: [{ id, ordem }, ...] }
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { postArquivosReordenarSchema } from "@/lib/schemas";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { itens } = postArquivosReordenarSchema.parse(await req.json());

    await prisma.$transaction(
      itens.map((i) =>
        prisma.postArquivo.update({
          where: { id: i.id },
          data: { ordem: i.ordem },
        })
      )
    );
    return { ok: true, atualizadas: itens.length, postId: params.id };
  });
}
