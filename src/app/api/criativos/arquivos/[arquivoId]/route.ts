/**
 * PATCH  /api/criativos/arquivos/[arquivoId] — atualiza legenda/nome
 * DELETE /api/criativos/arquivos/[arquivoId] — remove arquivo
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  legenda: z.string().max(500).optional().nullable(),
  nome: z.string().max(120).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { arquivoId: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = patchSchema.parse(await req.json());
    return prisma.criativoArquivo.update({
      where: { id: params.arquivoId },
      data: {
        ...(data.legenda !== undefined ? { legenda: data.legenda || null } : {}),
        ...(data.nome !== undefined ? { nome: data.nome || null } : {}),
      },
    });
  });
}

export async function DELETE(_: Request, { params }: { params: { arquivoId: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.criativoArquivo.delete({ where: { id: params.arquivoId } });
    return { ok: true };
  });
}
