import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { reuniaoSchema } from "@/lib/schemas";

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
    return prisma.reuniao.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.reuniao.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
