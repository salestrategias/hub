import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    await prisma.publicShare.deleteMany({
      where: { id: params.id, criadoPor: user.id },
    });
    return { ok: true };
  });
}
