import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { leadSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.lead.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true, status: true } },
        propostas: {
          select: { id: true, numero: true, titulo: true, status: true, valorMensal: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        },
        user: { select: { id: true, name: true } },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = leadSchema.partial().parse(await req.json());
    return prisma.lead.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.lead.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
