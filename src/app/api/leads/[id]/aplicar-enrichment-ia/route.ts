/**
 * POST /api/leads/[id]/aplicar-enrichment-ia
 *
 * Salva qualidade (0-100) + JSON estruturado de enrichment + timestamp.
 * qualidadeIA extraído pra coluna separada permite filtros no kanban.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const enrichmentSchema = z.object({
  qualidade: z.number().int().min(0).max(100),
  categoria: z.enum(["QUENTE", "MORNO", "FRIO", "DESQUALIFICADO"]),
  icpFit: z.string().min(5).max(400),
  segmentoSugerido: z.string().min(1).max(100),
  abordagemSugerida: z.string().min(10).max(800),
  perguntasQualificacao: z.array(z.string().max(150)).max(8),
  justificativa: z.string().min(10).max(700),
});

const inputSchema = z.object({
  resposta: z.string().min(20),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { resposta } = inputSchema.parse(await req.json());

    const json = extrairJson(resposta);
    const enrichment = enrichmentSchema.parse(json);

    await prisma.lead.update({
      where: { id: params.id },
      data: {
        qualidadeIA: enrichment.qualidade,
        enriquecimentoIA: enrichment,
        enriquecimentoIAEm: new Date(),
      },
    });

    return { ok: true, enrichment };
  });
}

function extrairJson(raw: string): unknown {
  const limpo = raw.trim();
  const matchBloco = limpo.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = matchBloco ? matchBloco[1] : limpo;
  const inicio = candidato.search(/[{[]/);
  const ultimoObj = candidato.lastIndexOf("}");
  const ultimoArr = candidato.lastIndexOf("]");
  const fim = Math.max(ultimoObj, ultimoArr);
  if (inicio < 0 || fim < 0 || fim < inicio) {
    throw new Error("Não encontrei JSON válido. Cola o JSON completo entre chaves.");
  }
  const json = candidato.slice(inicio, fim + 1);
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(
      `JSON inválido: ${e instanceof Error ? e.message : "erro de parsing"}.`
    );
  }
}
