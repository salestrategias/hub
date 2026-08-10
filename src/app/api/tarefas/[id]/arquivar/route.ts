/**
 * POST /api/tarefas/[id]/arquivar — { arquivar: boolean }
 *
 * Arquivada: some do quadro/listas/calendário sem apagar nada.
 * Mantém colunaId — desarquivar devolve o card pro mesmo lugar.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({ arquivar: z.boolean() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { arquivar } = schema.parse(await req.json());
    await prisma.tarefa.update({
      where: { id: params.id },
      data: { arquivadaEm: arquivar ? new Date() : null },
    });
    return { ok: true, arquivada: arquivar };
  });
}
