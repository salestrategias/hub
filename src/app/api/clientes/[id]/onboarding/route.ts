/**
 * POST /api/clientes/[id]/onboarding
 *
 * Re-execução manual do onboarding pelo botão "Rodar onboarding" no
 * sheet. Útil quando:
 *  - Cliente foi criado antes desta feature existir
 *  - Tentativa inicial falhou em criar a pasta Drive (sem auth, etc)
 *  - Marcelo quer recriar o projeto Onboarding do zero pra um cliente
 *
 * Body: { forcar?: boolean } — se true, ignora onboardingFeitoEm e
 * re-cria projeto + tarefas (NÃO deleta o anterior — Marcelo limpa
 * manualmente se quiser).
 *
 * Resposta: ResultadoOnboarding com flags de cada side effect.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { executarOnboardingCliente } from "@/lib/onboarding-cliente";
import { z } from "zod";

const schema = z.object({
  forcar: z.boolean().optional().default(false),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const { forcar } = schema.parse(body);
    return executarOnboardingCliente(params.id, user.id, { forcar });
  });
}
