/**
 * POST /api/financeiro/processar-faturamento
 *
 * Trigger manual do faturamento recorrente. Usado pelo botão "Gerar
 * faturamento do mês" no /financeiro.
 *
 * Body opcional: { ano?: number; mes?: number } — default mês corrente.
 *
 * Resposta: ResultadoFaturamento com criados/jaExistiam/ignorados +
 * detalhes por cliente pra UI mostrar "X mensalidades criadas".
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { processarFaturamentoMensal } from "@/lib/faturamento-recorrente";
import { z } from "zod";

const schema = z.object({
  ano: z.coerce.number().int().min(2020).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json().catch(() => ({}));
    const { ano, mes } = schema.parse(body);
    return processarFaturamentoMensal({ ano, mes });
  });
}
