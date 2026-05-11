import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { clienteSchema } from "@/lib/schemas";
import { syncMentionsFromValue, deleteMentionsOf } from "@/lib/mentions";
import { executarOnboardingSilencioso } from "@/lib/onboarding-cliente";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.cliente.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        tags: true,
        posts: {
          orderBy: { dataPublicacao: "desc" },
          take: 20,
          select: { id: true, titulo: true, status: true, dataPublicacao: true },
        },
        tarefas: {
          orderBy: [{ concluida: "asc" }, { dataEntrega: "asc" }],
          take: 20,
          select: { id: true, titulo: true, concluida: true, prioridade: true, dataEntrega: true },
        },
        contratos: {
          orderBy: { dataInicio: "desc" },
          take: 5,
          select: { id: true, status: true, dataInicio: true, dataFim: true, valor: true },
        },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = await req.json();
    const { tagIds, ...data } = clienteSchema.partial().parse(body);

    // Snapshot ANTES de atualizar — pra detectar transição pra ATIVO
    const anterior = await prisma.cliente.findUnique({
      where: { id: params.id },
      select: { status: true, onboardingFeitoEm: true },
    });

    const updated = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        ...data,
        tags: tagIds !== undefined ? { set: tagIds.map((id) => ({ id })) } : undefined,
      },
      include: { tags: true },
    });
    if (data.notas !== undefined) {
      void syncMentionsFromValue({ sourceType: "CLIENTE", sourceId: params.id }, data.notas);
    }

    // Dispara onboarding se cliente acabou de virar ATIVO e ainda não
    // foi onboardado. Trigger comum: PROSPECT promovido manualmente
    // (sem passar pelo pipeline de leads).
    const virouAtivo = anterior?.status !== "ATIVO" && updated.status === "ATIVO";
    if (virouAtivo && !anterior?.onboardingFeitoEm) {
      void executarOnboardingSilencioso(params.id, user.id);
    }

    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.cliente.delete({ where: { id: params.id } });
    void deleteMentionsOf({ sourceType: "CLIENTE", sourceId: params.id });
    return { ok: true };
  });
}
