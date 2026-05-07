import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { templateSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.template.findUniqueOrThrow({ where: { id: params.id } });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = templateSchema.partial().parse(await req.json());
    return prisma.template.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    // Built-ins (criadoPor null) só podem ser deletados por ADMIN.
    // Demais templates: dono ou admin.
    const t = await prisma.template.findUniqueOrThrow({ where: { id: params.id } });
    const isOwner = t.criadoPor === user.id;
    const isAdmin = (user as { role?: string }).role === "ADMIN";
    if (!isOwner && !isAdmin) {
      throw new Error("Sem permissão para excluir este template");
    }
    await prisma.template.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
