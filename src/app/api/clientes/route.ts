import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { clienteSchema } from "@/lib/schemas";
import { syncMentionsFromValue } from "@/lib/mentions";
import { executarOnboardingSilencioso } from "@/lib/onboarding-cliente";

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
    const user = await requireAuth();
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
    // Onboarding automático só pra cliente que já nasce ATIVO. PROSPECT
    // não dispara — espera promoção via PATCH.
    if (cliente.status === "ATIVO") {
      void executarOnboardingSilencioso(cliente.id, user.id);
    }
    return cliente;
  });
}
