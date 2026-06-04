import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

/**
 * Reordena/move criativos no kanban (drag-drop estilo Trello).
 *
 * Body: { status: CriativoStatus, ids: string[] }
 *   - `ids` = criativos da coluna de DESTINO, já na nova ordem.
 *   - Para cada id, seta `ordem = index` e `status = status`.
 *
 * Cobre os dois casos num só endpoint:
 *   - Reordenar dentro da coluna (status não muda; só a ordem).
 *   - Mover entre colunas (id veio de outra coluna → ganha o novo status).
 *
 * Validação inline (sem tocar em schemas.ts pra não colidir em paralelo).
 * Numa transação pra ficar atômico — ou aplica tudo ou nada.
 */
const reordenarSchema = z.object({
  status: z.enum(["RASCUNHO", "EM_APROVACAO", "APROVADO", "RECUSADO", "NO_AR", "PAUSADO", "ENCERRADO"]),
  ids: z.array(z.string()).max(500),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { status, ids } = reordenarSchema.parse(await req.json());

    if (ids.length === 0) return { ok: true };

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.criativo.update({
          where: { id },
          data: { ordem: index, status },
        })
      )
    );

    return { ok: true };
  });
}
