import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { notaSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const pasta = searchParams.get("pasta");
    const q = searchParams.get("q");
    return prisma.nota.findMany({
      where: {
        ...(pasta ? { pasta } : {}),
        ...(q
          ? {
              OR: [
                { titulo: { contains: q, mode: "insensitive" } },
                { conteudo: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = notaSchema.parse(await req.json());
    return prisma.nota.create({ data });
  });
}
