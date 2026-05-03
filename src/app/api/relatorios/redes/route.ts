import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { metricaRedeSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId");
    if (!clienteId) return [];
    return prisma.metricaRede.findMany({
      where: { clienteId },
      orderBy: [{ ano: "asc" }, { mes: "asc" }],
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = metricaRedeSchema.parse(await req.json());
    return prisma.metricaRede.upsert({
      where: { clienteId_rede_ano_mes: { clienteId: data.clienteId, rede: data.rede, ano: data.ano, mes: data.mes } },
      create: data,
      update: data,
    });
  });
}
