/**
 * POST /api/propostas/[id]/aplicar-analise-ia
 *
 * Recebe a análise JSON colada do Claude, valida shape e grava em
 * Proposta.analiseIA + analiseIAEm. Sobrescreve análise anterior.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const analiseSchema = z.object({
  notaGeral: z.number().min(0).max(10),
  vereditoCurto: z.string().min(5).max(300),
  pontosFortes: z.array(z.string().max(200)).max(10),
  pontosFracos: z.array(z.string().max(200)).max(10),
  gapsInformacao: z.array(z.string().max(200)).max(10),
  sugestoesMelhoria: z.array(z.string().max(300)).max(10),
  riscoObjecoes: z.array(z.string().max(300)).max(10),
});

const inputSchema = z.object({
  resposta: z.string().min(20),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { resposta } = inputSchema.parse(await req.json());

    const json = extrairJson(resposta);
    const analise = analiseSchema.parse(json);

    await prisma.proposta.update({
      where: { id: params.id },
      data: {
        analiseIA: analise,
        analiseIAEm: new Date(),
      },
    });

    return { ok: true, analise };
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
