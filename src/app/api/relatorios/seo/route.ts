import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { metricaSeoSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId");
    if (!clienteId) return { metricas: [], keywords: [] };
    const [metricas, keywords] = await Promise.all([
      prisma.metricaSeo.findMany({ where: { clienteId }, orderBy: [{ ano: "asc" }, { mes: "asc" }] }),
      prisma.seoKeyword.findMany({ where: { clienteId }, orderBy: { posicaoAtual: "asc" } }),
    ]);
    return { metricas, keywords };
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = metricaSeoSchema.parse(await req.json());
    return prisma.metricaSeo.upsert({
      where: { clienteId_ano_mes: { clienteId: data.clienteId, ano: data.ano, mes: data.mes } },
      create: data,
      update: data,
    });
  });
}
