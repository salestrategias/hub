/**
 * PATCH  /api/posts/arquivos/[arquivoId]   — atualiza nome/legenda
 * DELETE /api/posts/arquivos/[arquivoId]   — remove
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { postArquivoSchema } from "@/lib/schemas";

export async function PATCH(req: Request, { params }: { params: { arquivoId: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = postArquivoSchema.partial().parse(await req.json());
    return prisma.postArquivo.update({
      where: { id: params.arquivoId },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome || null } : {}),
        ...(data.legenda !== undefined ? { legenda: data.legenda || null } : {}),
        ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
        ...(data.tipo !== undefined ? { tipo: data.tipo } : {}),
        ...(data.url !== undefined ? { url: data.url } : {}),
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: { params: { arquivoId: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.postArquivo.delete({ where: { id: params.arquivoId } });
    return { ok: true };
  });
}
