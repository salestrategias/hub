import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const limite = Math.min(Number(searchParams.get("limite") ?? 50), 200);
    const tipo = searchParams.get("tipo");

    return prisma.atividadeConta.findMany({
      where: {
        userId: user.id,
        ...(tipo ? { tipo: tipo as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limite,
      select: {
        id: true, tipo: true, ip: true, userAgent: true, meta: true, createdAt: true,
      },
    });
  });
}
