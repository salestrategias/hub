/**
 * GET  /api/posts/[id]/arquivos       — lista arquivos do post (ordenados)
 * POST /api/posts/[id]/arquivos       — cria novo arquivo
 *
 * Anexa imagens, vídeos, PDFs ou URLs externas a um Post. Ordem default
 * = última (max + 10).
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { postArquivoSchema } from "@/lib/schemas";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.postArquivo.findMany({
      where: { postId: params.id },
      orderBy: { ordem: "asc" },
    });
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = postArquivoSchema.parse(await req.json());

    let ordem = data.ordem;
    if (!ordem) {
      const max = await prisma.postArquivo.aggregate({
        where: { postId: params.id },
        _max: { ordem: true },
      });
      ordem = (max._max.ordem ?? 0) + 10;
    }

    return prisma.postArquivo.create({
      data: {
        postId: params.id,
        tipo: data.tipo,
        url: data.url,
        nome: data.nome || null,
        legenda: data.legenda || null,
        ordem,
      },
    });
  });
}
