import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { campanhaPagaSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId");
    if (!clienteId) return [];
    return prisma.campanhaPaga.findMany({
      where: { clienteId },
      orderBy: [{ ano: "asc" }, { mes: "asc" }],
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = campanhaPagaSchema.parse(await req.json());
    return prisma.campanhaPaga.create({ data });
  });
}
