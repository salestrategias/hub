import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { criativoSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.criativo.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true } },
        campanhaPaga: { select: { id: true, nome: true, ano: true, mes: true, plataforma: true } },
        arquivos: { orderBy: { ordem: "asc" } },
        comentarios: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = criativoSchema.partial().parse(body);
    return prisma.criativo.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.criativo.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
