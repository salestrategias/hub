import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { contratoSchema } from "@/lib/schemas";
import { tryDeleteEvent } from "@/lib/google-calendar";
import { syncMentionsFromValue, deleteMentionsOf } from "@/lib/mentions";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = contratoSchema.partial().parse(await req.json());
    const updated = await prisma.contrato.update({ where: { id: params.id }, data });
    if (data.observacoes !== undefined) {
      void syncMentionsFromValue({ sourceType: "CONTRATO", sourceId: params.id }, data.observacoes);
    }
    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const c = await prisma.contrato.findUnique({ where: { id: params.id } });
    if (c?.googleEventId) await tryDeleteEvent({ eventId: c.googleEventId });
    await prisma.contrato.delete({ where: { id: params.id } });
    void deleteMentionsOf({ sourceType: "CONTRATO", sourceId: params.id });
    return { ok: true };
  });
}
