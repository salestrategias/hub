/**
 * Configurações globais (singleton no DB) — `/admin/configuracoes`.
 *
 * GET    — lê config atual (cria com defaults se não existir ainda)
 * PATCH  — atualiza campos do onboarding e invalida cache do resolver
 *
 * Restrito a usuários ADMIN. Sem isso, qualquer membro poderia
 * redirecionar onde clientes futuros são criados — risco operacional.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { resetOnboardingParentCache } from "@/lib/google-drive";
import { z } from "zod";

async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new Error("Apenas administradores");
  return user;
}

async function getOrCreateConfig() {
  return prisma.configuracao.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

export async function GET() {
  return apiHandler(async () => {
    await requireAdmin();
    return getOrCreateConfig();
  });
}

const patchSchema = z.object({
  onboardingDestinoTipo: z.enum(["meu_drive", "shared_drive", "pasta"]).optional(),
  onboardingDriveId: z.string().nullable().optional(),
  onboardingDriveNome: z.string().nullable().optional(),
  onboardingParentId: z.string().nullable().optional(),
  onboardingParentNome: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  return apiHandler(async () => {
    const user = await requireAdmin();
    const data = patchSchema.parse(await req.json());

    // Garante linha existente
    await getOrCreateConfig();

    const updated = await prisma.configuracao.update({
      where: { id: "default" },
      data: {
        ...data,
        atualizadoPor: user.id,
      },
    });

    // Invalida cache em memória — próximo onboarding lê novo valor
    resetOnboardingParentCache();

    return updated;
  });
}
