import { z } from "zod";
import { Prisma } from "@prisma/client";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { textToBlocks } from "@/components/editor/text-to-blocks";
import { normalizarSecoes, type DiagnosticoSecao } from "@/lib/diagnostico-secoes";
import { extrairTextoDeBlocos } from "@/lib/proposta-helpers";

/**
 * Recebe o JSON que o Claude (Max/Desktop/Web) gerou e aplica nas seções
 * do diagnóstico. Diferente da proposta (colunas fixas), aqui as chaves do
 * JSON são os `id` das seções do array `secoes`. Cada valor chega em
 * markdown — convertemos pra JSON BlockNote via textToBlocks.
 *
 * Por padrão NÃO sobrescreve seções já preenchidas (só completa as vazias).
 * `sobrescrever: true` força reset.
 *
 * Tolerância: se o Claude não devolver o id exato, tentamos casar por
 * `tipo` ou por `titulo` normalizado — o fluxo copy-paste é imperfeito.
 */

const inputSchema = z.object({
  resposta: z.string().min(20, "Cole o JSON gerado pelo Claude"),
  sobrescrever: z.boolean().default(false),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = inputSchema.parse(await req.json());

    const jsonStr = extrairJson(body.resposta);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error(
        "Não consegui ler o JSON. Verifica se você colou o bloco { ... } que o Claude retornou."
      );
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Formato inválido. A resposta deve ser um objeto JSON { \"sec-...\": \"...\" }.");
    }
    const respostaIA = parsed as Record<string, unknown>;

    const diagnostico = await prisma.diagnostico.findUniqueOrThrow({
      where: { id: params.id },
      select: { secoes: true },
    });
    const secoes = normalizarSecoes(diagnostico.secoes);

    // Index pra casar chaves do JSON com seções (id → tipo → titulo).
    const porId = new Map(secoes.map((s) => [s.id, s]));
    const porTipo = new Map<string, DiagnosticoSecao>();
    const porTitulo = new Map<string, DiagnosticoSecao>();
    for (const s of secoes) {
      // primeira ocorrência ganha (tipos podem repetir se Marcelo duplicou)
      if (!porTipo.has(s.tipo)) porTipo.set(s.tipo, s);
      const tn = normalizarChave(s.titulo);
      if (tn && !porTitulo.has(tn)) porTitulo.set(tn, s);
    }

    const resolver = (chave: string): DiagnosticoSecao | undefined => {
      if (porId.has(chave)) return porId.get(chave);
      if (porTipo.has(chave)) return porTipo.get(chave);
      const cn = normalizarChave(chave);
      if (porTitulo.has(cn)) return porTitulo.get(cn);
      return undefined;
    };

    const atualizadas: string[] = [];
    const ignoradas: string[] = [];
    const jaAplicadas = new Set<string>(); // evita 2 chaves caírem na mesma seção
    let mudou = false;

    for (const [chave, valor] of Object.entries(respostaIA)) {
      if (typeof valor !== "string" || !valor.trim()) continue;
      const secao = resolver(chave);
      if (!secao || jaAplicadas.has(secao.id)) continue;
      jaAplicadas.add(secao.id);

      const blocosJson = JSON.stringify(textToBlocks(valor));

      if (body.sobrescrever || isVazio(secao.conteudo)) {
        secao.conteudo = blocosJson;
        atualizadas.push(secao.titulo);
        mudou = true;
      } else {
        ignoradas.push(secao.titulo);
      }
    }

    if (atualizadas.length === 0 && ignoradas.length === 0) {
      throw new Error(
        "Nenhuma seção reconhecida no JSON. Confira se as chaves batem com os ids das seções (ex.: \"sec-sumarioExecutivo-...\")."
      );
    }

    if (mudou) {
      await prisma.diagnostico.update({
        where: { id: params.id },
        data: { secoes: secoes as unknown as Prisma.InputJsonValue },
      });
    }

    return { ok: true, secoesAtualizadas: atualizadas, secoesIgnoradas: ignoradas };
  });
}

function extrairJson(texto: string): string {
  const fenced = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = texto.indexOf("{");
  const end = texto.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return texto.slice(start, end + 1).trim();
  }
  return texto.trim();
}

/** Normaliza pra casar título: minúsculas, sem acento, sem pontuação. */
function normalizarChave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Uma seção está vazia se o BlockNote não tem texto renderizável. */
function isVazio(conteudo: string): boolean {
  const t = (conteudo ?? "").trim();
  if (!t) return true;
  return extrairTextoDeBlocos(t).trim().length === 0;
}
