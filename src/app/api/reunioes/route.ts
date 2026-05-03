import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { reuniaoSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId");
    return prisma.reuniao.findMany({
      where: clienteId ? { clienteId } : undefined,
      include: {
        cliente: { select: { id: true, nome: true } },
        _count: { select: { actionItems: true, blocks: true, capitulos: true } },
      },
      orderBy: { data: "desc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = reuniaoSchema.parse(await req.json());
    return prisma.reuniao.create({ data });
  });
}
