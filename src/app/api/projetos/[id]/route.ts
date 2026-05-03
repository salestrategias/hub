import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { projetoSchema } from "@/lib/schemas";
import { tryDeleteEvent } from "@/lib/google-calendar";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = projetoSchema.partial().omit({ criarPastaDrive: true }).parse(body);
    return prisma.projeto.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const p = await prisma.projeto.findUnique({ where: { id: params.id } });
    if (p?.googleEventId) await tryDeleteEvent({ eventId: p.googleEventId });
    await prisma.projeto.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
