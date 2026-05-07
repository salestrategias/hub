import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { reuniaoSchema } from "@/lib/schemas";
import { extractMentionsFromValue, syncMentions, deleteMentionsOf } from "@/lib/mentions";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.reuniao.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: true,
        blocks: { orderBy: { ordem: "asc" } },
        actionItems: { orderBy: { ordem: "asc" } },
        capitulos: { orderBy: { ordem: "asc" } },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = reuniaoSchema.partial().parse(await req.json());
    const updated = await prisma.reuniao.update({ where: { id: params.id }, data });
    // Mentions de Reuniao: união entre notasLivres + resumoIA (mesmo source)
    if (data.notasLivres !== undefined || data.resumoIA !== undefined) {
      const fresh = await prisma.reuniao.findUnique({
        where: { id: params.id },
        select: { notasLivres: true, resumoIA: true },
      });
      const mentions = [
        ...extractMentionsFromValue(fresh?.notasLivres),
        ...extractMentionsFromValue(fresh?.resumoIA),
      ];
      // Dedup por target (mesma reunião pode mencionar a mesma entidade em ambos campos)
      const dedup = new Map(mentions.map((m) => [`${m.targetType}:${m.targetId}`, m]));
      void syncMentions({ sourceType: "REUNIAO", sourceId: params.id }, Array.from(dedup.values()));
    }
    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.reuniao.delete({ where: { id: params.id } });
    void deleteMentionsOf({ sourceType: "REUNIAO", sourceId: params.id });
    return { ok: true };
  });
}
