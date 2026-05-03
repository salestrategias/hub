import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { lancamentoSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const entidade = searchParams.get("entidade");
    const where = entidade ? { entidade: entidade as "PJ" | "PF" } : {};
    return prisma.lancamento.findMany({
      where,
      include: { cliente: { select: { nome: true } } },
      orderBy: { data: "desc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = lancamentoSchema.parse(await req.json());
    return prisma.lancamento.create({ data });
  });
}
