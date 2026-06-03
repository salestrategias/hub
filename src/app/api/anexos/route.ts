/**
 * GET  /api/anexos?entidadeTipo=REUNIAO&entidadeId=xxx  — lista anexos da entidade
 * POST /api/anexos                                       — cria anexo
 *
 * Anexo polimórfico: arquivo (dataURL até ~5MB) ou link externo/Drive,
 * pendurado em qualquer entidade via (entidadeTipo, entidadeId).
 * Mesmo padrão de upload dos arquivos de post/criativo.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { anexoSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const entidadeTipo = searchParams.get("entidadeTipo");
    const entidadeId = searchParams.get("entidadeId");
    if (!entidadeTipo || !entidadeId) {
      throw new Error("entidadeTipo e entidadeId obrigatórios");
    }
    return prisma.anexo.findMany({
      where: { entidadeTipo, entidadeId },
      orderBy: { ordem: "asc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = anexoSchema.parse(await req.json());

    let ordem = data.ordem;
    if (!ordem) {
      const max = await prisma.anexo.aggregate({
        where: { entidadeTipo: data.entidadeTipo, entidadeId: data.entidadeId },
        _max: { ordem: true },
      });
      ordem = (max._max.ordem ?? 0) + 10;
    }

    return prisma.anexo.create({
      data: {
        nome: data.nome,
        url: data.url,
        tipo: data.tipo,
        tamanhoBytes: data.tamanhoBytes ?? null,
        entidadeTipo: data.entidadeTipo,
        entidadeId: data.entidadeId,
        ordem,
        criadoPor: user.id,
      },
    });
  });
}
