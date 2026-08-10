/**
 * POST /api/pages/[id]/arquivar — { arquivar: boolean }
 *
 * Página arquivada some da árvore do workspace e das fixadas da sidebar.
 * Recuperável em /lixeira → aba Arquivados.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({ arquivar: z.boolean() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { arquivar } = schema.parse(await req.json());
    await prisma.page.update({
      where: { id: params.id },
      data: { arquivadaEm: arquivar ? new Date() : null },
    });
    return { ok: true, arquivada: arquivar };
  });
}
