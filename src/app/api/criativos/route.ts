import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { criativoSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId");
    const status = searchParams.get("status");

    return prisma.criativo.findMany({
      where: {
        ...(clienteId ? { clienteId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        campanhaPaga: { select: { id: true, nome: true, ano: true, mes: true } },
        _count: { select: { arquivos: true, comentarios: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = criativoSchema.parse(await req.json());
    // `ordem` é computada no servidor (estilo Trello): joga o novo criativo no
    // fim da coluna de destino. Nunca confia no body pra isso.
    const ultimo = await prisma.criativo.findFirst({
      where: { status: data.status },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    const ordem = (ultimo?.ordem ?? -1) + 1;
    return prisma.criativo.create({ data: { ...data, ordem } });
  });
}
