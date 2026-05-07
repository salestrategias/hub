import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { notaSchema } from "@/lib/schemas";
import { syncMentionsFromValue, deleteMentionsOf } from "@/lib/mentions";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.nota.findUniqueOrThrow({ where: { id: params.id } });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = notaSchema.partial().parse(await req.json());
    const updated = await prisma.nota.update({ where: { id: params.id }, data });
    if (data.conteudo !== undefined) {
      void syncMentionsFromValue({ sourceType: "NOTA", sourceId: params.id }, data.conteudo);
    }
    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.nota.delete({ where: { id: params.id } });
    void deleteMentionsOf({ sourceType: "NOTA", sourceId: params.id });
    return { ok: true };
  });
}
