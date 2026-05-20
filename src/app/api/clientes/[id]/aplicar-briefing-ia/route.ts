/**
 * POST /api/clientes/[id]/aplicar-briefing-ia
 *
 * Recebe a resposta JSON do Claude colada pelo Marcelo, valida o shape e
 * grava em `Cliente.briefingIA` + timestamp em `briefingIAEm`.
 *
 * Tolerante a markdown wrapping (```json...```) e prefácio em texto —
 * usa extrairJsonDaResposta do ia-wizard.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const briefingSchema = z.object({
  resumo: z.string().min(20).max(4000),
  pontosAtencao: z.array(z.string().max(200)).max(10),
  proximasAcoes: z.array(z.string().max(250)).max(10),
  riscoChurn: z.string().min(5).max(300),
});

const inputSchema = z.object({
  resposta: z.string().min(20),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { resposta } = inputSchema.parse(await req.json());

    // Extração tolerante de JSON (markdown wrapping, prefácio, etc)
    const json = extrairJson(resposta);
    const briefing = briefingSchema.parse(json);

    await prisma.cliente.update({
      where: { id: params.id },
      data: {
        briefingIA: briefing,
        briefingIAEm: new Date(),
      },
    });

    return {
      ok: true,
      briefing,
    };
  });
}

/**
 * Mesma lógica do extrairJsonDaResposta de ia-wizard.tsx, duplicada aqui
 * pra não acoplar cliente-side a server-side (o ia-wizard é "use client").
 */
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
      `JSON inválido: ${e instanceof Error ? e.message : "erro de parsing"}. Verifique se a resposta termina com }.`
    );
  }
}
