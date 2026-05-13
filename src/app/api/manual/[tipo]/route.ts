/**
 * GET  /api/manual/[tipo]            — lista todas as seções da categoria
 * POST /api/manual/[tipo]            — cria nova seção
 *
 * `tipo` = PLAYBOOK | MARCA (validado).
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { docSecaoSchema } from "@/lib/schemas";
import { slugify, slugUnico } from "@/lib/manual-helpers";

function parseTipo(t: string): "PLAYBOOK" | "MARCA" {
  const up = t.toUpperCase();
  if (up !== "PLAYBOOK" && up !== "MARCA") {
    throw new Error("Tipo inválido — use PLAYBOOK ou MARCA");
  }
  return up;
}

export async function GET(_req: Request, { params }: { params: { tipo: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const tipo = parseTipo(params.tipo);
    return prisma.docSecao.findMany({
      where: { tipo },
      orderBy: [{ parentId: "asc" }, { ordem: "asc" }, { titulo: "asc" }],
      select: {
        id: true, tipo: true, titulo: true, slug: true, icone: true,
        ordem: true, publicada: true, parentId: true, updatedAt: true,
      },
    });
  });
}

export async function POST(req: Request, { params }: { params: { tipo: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const tipo = parseTipo(params.tipo);

    const body = await req.json();
    const data = docSecaoSchema.parse({ ...body, tipo });

    // Garante slug único
    const slugBase = data.slug || slugify(data.titulo);
    const slug = await slugUnico(prisma, tipo, slugBase);

    // Ordem default: depois da última
    let ordem = data.ordem;
    if (!ordem) {
      const max = await prisma.docSecao.aggregate({
        where: { tipo, parentId: data.parentId ?? null },
        _max: { ordem: true },
      });
      ordem = (max._max.ordem ?? 0) + 10;
    }

    return prisma.docSecao.create({
      data: {
        tipo,
        titulo: data.titulo,
        slug,
        conteudo: data.conteudo,
        icone: data.icone || null,
        ordem,
        publicada: data.publicada,
        parentId: data.parentId || null,
        criadoPor: user.id,
      },
    });
  });
}
