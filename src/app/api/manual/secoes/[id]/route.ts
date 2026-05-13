/**
 * GET    /api/manual/secoes/[id]
 * PATCH  /api/manual/secoes/[id]
 * DELETE /api/manual/secoes/[id]
 *
 * Operações por ID — usado pelo editor inline e drag-drop.
 * Filhas (`onDelete: SetNull` no schema) ficam como órfãs (parentId=null
 * vira root) quando o pai é apagado.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { docSecaoSchema } from "@/lib/schemas";
import { slugUnico } from "@/lib/manual-helpers";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.docSecao.findUniqueOrThrow({ where: { id: params.id } });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = docSecaoSchema.partial().parse(body);

    // Carrega atual pra usar tipo na re-slugificação
    const atual = await prisma.docSecao.findUniqueOrThrow({ where: { id: params.id } });

    // Se mudou título mas slug não veio explícito, regenera
    let slug: string | undefined;
    if (data.slug) {
      slug = await slugUnico(prisma, atual.tipo, data.slug, params.id);
    } else if (data.titulo && data.titulo !== atual.titulo && !data.slug) {
      // Mantém slug atual — não regerar automaticamente porque pode quebrar
      // links/shares já distribuídos. Marcelo edita manualmente se quiser.
    }

    return prisma.docSecao.update({
      where: { id: params.id },
      data: {
        ...(data.titulo !== undefined ? { titulo: data.titulo } : {}),
        ...(slug ? { slug } : {}),
        ...(data.conteudo !== undefined ? { conteudo: data.conteudo } : {}),
        ...(data.icone !== undefined ? { icone: data.icone || null } : {}),
        ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
        ...(data.publicada !== undefined ? { publicada: data.publicada } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId || null } : {}),
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.docSecao.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
