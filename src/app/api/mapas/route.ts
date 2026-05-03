import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { mindMapSchema } from "@/lib/schemas";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.mindMap.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, titulo: true, descricao: true, thumbnail: true, updatedAt: true },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = mindMapSchema.parse(await req.json());
    return prisma.mindMap.create({ data });
  });
}
