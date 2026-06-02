/**
 * Modelo unificado de BLOCOS da Proposta (Fase 1 do upgrade do Hub).
 *
 * A Proposta deixa de ser 8 colunas de texto fixas e passa a ser um ARRAY de
 * blocos ordenáveis/toggláveis (`proposta.secoes`), no mesmo espírito do
 * `diagnostico.secoes`. Os blocos ricos que já existiam em `proposta-blocos.ts`
 * (pacotes, cases, kpis, equipe, faq, timeline, garantias) viram blocos de
 * fluxo reordenáveis — não mais posições fixas hard-coded.
 *
 * NÃO mexe no diagnóstico ainda: ele tem semântica própria (tipos de seção +
 * `perguntasGuia` que alimentam o prompt de IA). O que se compartilha é a
 * biblioteca de blocos ricos e o render; o container do diagnóstico migra
 * depois, com cuidado.
 *
 * MIGRAÇÃO (aditiva e reversível): a coluna `proposta.secoes` é nullable.
 * Enquanto null, `deriveBlocosFromProposta()` deriva o array das 8 colunas +
 * `extras` (dual-read), mantendo a ordem que a pública já renderiza — migração
 * invisível. Quando o editor salvar, grava `secoes` e passa a ler de lá.
 */
import {
  type BlocoPacotes,
  type BlocoCases,
  type BlocoKpis,
  type BlocoEquipe,
  type BlocoFaq,
  type BlocoTimeline,
  type BlocoGarantias,
  normalizarExtras,
} from "@/lib/proposta-blocos";

export type BlocoTipo =
  | "texto" // rich text (Tiptap JSON em `conteudo`)
  | "capa" // hero: rich text + imagem de fundo
  | "pacotes"
  | "cases"
  | "kpis"
  | "equipe"
  | "faq"
  | "timeline"
  | "garantias";

/** Dados do bloco de capa (hero). O texto fica em `conteudo` (Tiptap). */
export type BlocoCapaDados = {
  imagemUrl?: string; // hero (dataURL ou URL externa)
};

/** Payload estruturado por tipo. Tipos "texto"/"capa" usam `conteudo`. */
export type BlocoDados =
  | BlocoCapaDados
  | BlocoPacotes
  | BlocoCases
  | BlocoKpis
  | BlocoEquipe
  | BlocoFaq
  | BlocoTimeline
  | BlocoGarantias;

export type Bloco = {
  id: string;
  tipo: BlocoTipo;
  titulo?: string; // rótulo da seção (ex.: "Diagnóstico", "Investimento")
  visivel: boolean;
  ordem: number;
  conteudo?: string | null; // Tiptap JSON — tipos "texto" e "capa"
  dados?: BlocoDados; // payload estruturado — tipos ricos
};

/** Tipos que editam corpo em rich text (vs. só dados estruturados). */
export function blocoTemRichText(tipo: BlocoTipo): boolean {
  return tipo === "texto" || tipo === "capa";
}

/** Rótulos pro navegador de blocos (ícones ficam no componente do editor). */
export const BLOCO_LABEL: Record<BlocoTipo, string> = {
  texto: "Texto",
  capa: "Capa",
  pacotes: "Tabela de pacotes",
  cases: "Cases / prova social",
  kpis: "KPIs / metas",
  equipe: "Equipe",
  faq: "FAQ",
  timeline: "Cronograma",
  garantias: "Garantias",
};

export function gerarBlocoId(tipo: BlocoTipo): string {
  return `blk-${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type PropostaColunas = {
  capa?: string | null;
  diagnostico?: string | null;
  objetivo?: string | null;
  escopo?: string | null;
  cronograma?: string | null;
  investimento?: string | null;
  proximosPassos?: string | null;
  termos?: string | null;
  capaImagemUrl?: string | null;
  extras?: unknown;
};

/**
 * Dual-read: deriva o array de blocos das 8 colunas + `extras` de uma proposta
 * ainda não migrada (quando `secoes` é null), preservando a ordem fixa que a
 * pública renderiza hoje — pra que a transição seja invisível.
 */
export function deriveBlocosFromProposta(p: PropostaColunas): Bloco[] {
  const blocos: Bloco[] = [];
  let ordem = 0;
  const ex = normalizarExtras(p.extras);

  const add = (b: Omit<Bloco, "ordem">) => {
    blocos.push({ ...b, ordem: ordem++ });
  };
  const texto = (titulo: string, conteudo?: string | null) =>
    add({ id: gerarBlocoId("texto"), tipo: "texto", titulo, visivel: true, conteudo: conteudo ?? null });

  add({
    id: gerarBlocoId("capa"),
    tipo: "capa",
    titulo: "Capa",
    visivel: true,
    conteudo: p.capa ?? null,
    dados: { imagemUrl: p.capaImagemUrl ?? undefined },
  });
  // A ORDEM abaixo espelha EXATAMENTE a sequência que `renderizarSequencia`
  // produzia na pública/print antes da Fase 1 (path B) — pra que a proposta
  // legada (secoes null) renderize pixel-idêntica. Não reordene sem ajustar o
  // render: capa → diagnóstico → cases → objetivo → kpis → escopo →
  // (cronograma|timeline) → investimento → pacotes → garantias →
  // próximos passos → termos → equipe → faq.
  texto("Diagnóstico", p.diagnostico);
  if (ex.cases) add({ id: gerarBlocoId("cases"), tipo: "cases", titulo: ex.cases.titulo, visivel: ex.cases.visivel, dados: ex.cases });
  texto("Objetivo", p.objetivo);
  if (ex.kpis) add({ id: gerarBlocoId("kpis"), tipo: "kpis", titulo: ex.kpis.titulo, visivel: ex.kpis.visivel, dados: ex.kpis });
  texto("Estratégia & escopo", p.escopo);
  // Cronograma texto e timeline ocupam o MESMO slot: o render mostra a timeline
  // quando ela está ativa e suprime o texto (mutuamente exclusivos, como antes).
  texto("Cronograma", p.cronograma);
  if (ex.timeline) add({ id: gerarBlocoId("timeline"), tipo: "timeline", titulo: ex.timeline.titulo, visivel: ex.timeline.visivel, dados: ex.timeline });
  texto("Investimento", p.investimento);
  if (ex.pacotes) add({ id: gerarBlocoId("pacotes"), tipo: "pacotes", titulo: ex.pacotes.titulo, visivel: ex.pacotes.visivel, dados: ex.pacotes });
  if (ex.garantias) add({ id: gerarBlocoId("garantias"), tipo: "garantias", titulo: ex.garantias.titulo, visivel: ex.garantias.visivel, dados: ex.garantias });
  texto("Próximos passos", p.proximosPassos);
  texto("Termos & condições", p.termos);
  if (ex.equipe) add({ id: gerarBlocoId("equipe"), tipo: "equipe", titulo: ex.equipe.titulo, visivel: ex.equipe.visivel, dados: ex.equipe });
  if (ex.faq) add({ id: gerarBlocoId("faq"), tipo: "faq", titulo: ex.faq.titulo, visivel: ex.faq.visivel, dados: ex.faq });

  return blocos;
}

/** Normaliza o array vindo do DB (defensivo contra shape antigo/parcial/null). */
export function normalizarBlocos(raw: unknown): Bloco[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Bloco[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const b = item as Record<string, unknown>;
    if (typeof b.id !== "string" || typeof b.tipo !== "string") return;
    out.push({
      id: b.id,
      tipo: b.tipo as BlocoTipo,
      titulo: typeof b.titulo === "string" ? b.titulo : undefined,
      visivel: b.visivel !== false,
      ordem: typeof b.ordem === "number" ? b.ordem : i,
      conteudo: typeof b.conteudo === "string" ? b.conteudo : null,
      dados: (b.dados as BlocoDados | undefined) ?? undefined,
    });
  });
  out.sort((a, b) => a.ordem - b.ordem);
  return out;
}

/** Resolve os blocos de uma proposta: usa `secoes` se já migrada, senão deriva. */
export function blocosDaProposta(p: PropostaColunas & { secoes?: unknown }): Bloco[] {
  const norm = normalizarBlocos(p.secoes);
  if (norm && norm.length > 0) return norm;
  return deriveBlocosFromProposta(p);
}
