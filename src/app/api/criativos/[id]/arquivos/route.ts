/**
 * GET  /api/criativos/[id]/arquivos   — lista arquivos do criativo
 * POST /api/criativos/[id]/arquivos   — cria novo arquivo
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { criativoArquivoSchema } from "@/lib/schemas";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.criativoArquivo.findMany({
      where: { criativoId: params.id },
      orderBy: { ordem: "asc" },
    });
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = criativoArquivoSchema.parse(await req.json());

    let ordem = data.ordem;
    if (!ordem) {
      const max = await prisma.criativoArquivo.aggregate({
        where: { criativoId: params.id },
        _max: { ordem: true },
      });
      ordem = (max._max.ordem ?? 0) + 10;
    }

    return prisma.criativoArquivo.create({
      data: {
        criativoId: params.id,
        tipo: data.tipo,
        url: data.url,
        nome: data.nome || null,
        legenda: data.legenda || null,
        ordem,
      },
    });
  });
}
