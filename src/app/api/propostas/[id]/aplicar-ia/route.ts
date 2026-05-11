import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { textToBlocks } from "@/components/editor/text-to-blocks";

/**
 * Recebe o JSON que o Claude (Max/Desktop/Web) gerou e aplica nas
 * 8 seções da proposta. Cada secao chega em markdown — convertemos
 * pra JSON BlockNote via textToBlocks.
 *
 * Por padrão NÃO sobrescreve seções já preenchidas (só completa as
 * vazias). Toggle `sobrescrever: true` força reset.
 */

const inputSchema = z.object({
  resposta: z.string().min(20, "Cole o JSON gerado pelo Claude"),
  sobrescrever: z.boolean().default(false),
});

const SECOES_VALIDAS = [
  "capa",
  "diagnostico",
  "objetivo",
  "escopo",
  "cronograma",
  "investimento",
  "proximosPassos",
  "termos",
] as const;
type SecaoKey = (typeof SECOES_VALIDAS)[number];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = inputSchema.parse(await req.json());

    // Extrai JSON. Claude às vezes embala em ```json...```
    const jsonStr = extrairJson(body.resposta);
    let secoes: Record<string, unknown>;
    try {
      secoes = JSON.parse(jsonStr);
    } catch {
      throw new Error(
        "Não consegui ler o JSON. Verifica se você colou só o bloco { ... } que o Claude retornou."
      );
    }

    if (typeof secoes !== "object" || secoes === null) {
      throw new Error("Formato inválido. Deve ser um objeto JSON.");
    }

    const proposta = await prisma.proposta.findUniqueOrThrow({ where: { id: params.id } });

    // Converte cada markdown em JSON BlockNote
    const updates: Partial<Record<SecaoKey, string>> = {};
    for (const key of SECOES_VALIDAS) {
      const markdown = secoes[key];
      if (typeof markdown !== "string" || !markdown.trim()) continue;
      const blocks = textToBlocks(markdown);
      updates[key] = JSON.stringify(blocks);
    }

    if (Object.keys(updates).length === 0) {
      throw new Error(
        "Nenhuma seção válida encontrada no JSON. Confira se as chaves estão certas (capa, diagnostico, objetivo, escopo, cronograma, investimento, proximosPassos, termos)."
      );
    }

    // Aplica: se sobrescrever, troca tudo. Senão, só preenche seções vazias.
    const data: Record<string, string> = {};
    for (const [key, json] of Object.entries(updates)) {
      const atual = (proposta as unknown as Record<string, string | null>)[key];
      if (body.sobrescrever || isVazio(atual)) {
        data[key] = json!;
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.proposta.update({
        where: { id: params.id },
        data,
      });
    }

    return {
      ok: true,
      secoesAtualizadas: Object.keys(data),
      secoesIgnoradas: SECOES_VALIDAS.filter(
        (k) => updates[k] !== undefined && !data[k]
      ),
    };
  });
}

function extrairJson(texto: string): string {
  // Remove cercas markdown se houver
  const fenced = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Tenta achar o primeiro { e o último } pra ser tolerante a texto extra
  const start = texto.indexOf("{");
  const end = texto.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return texto.slice(start, end + 1).trim();
  }
  return texto.trim();
}

function isVazio(valor: unknown): boolean {
  if (!valor || typeof valor !== "string") return true;
  const trimmed = valor.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("[")) {
    try {
      const blocks = JSON.parse(trimmed) as Array<{ content?: unknown }>;
      return !blocks.some((b) => {
        const c = b.content;
        if (typeof c === "string") return c.trim().length > 0;
        if (Array.isArray(c) && c.length > 0) return true;
        return false;
      });
    } catch {
      return false;
    }
  }
  return false;
}
