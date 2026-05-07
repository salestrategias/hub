import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { clienteSchema } from "@/lib/schemas";
import { syncMentionsFromValue } from "@/lib/mentions";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.cliente.findMany({
      orderBy: { nome: "asc" },
      include: { tags: true },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const { tagIds, ...data } = clienteSchema.parse(body);
    const cliente = await prisma.cliente.create({
      data: {
        ...data,
        tags: tagIds?.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      },
      include: { tags: true },
    });
    void syncMentionsFromValue({ sourceType: "CLIENTE", sourceId: cliente.id }, cliente.notas);
    return cliente;
  });
}
