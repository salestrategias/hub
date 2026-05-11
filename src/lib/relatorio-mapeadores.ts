/**
 * Mapeadores — convertem rows CSV/Sheets em entidades Prisma.
 *
 * Cada fonte de relatório (REDES, SEO, TRAFEGO) tem um mapeador que:
 *  1. Tenta encontrar colunas por aliases (fuzzy match)
 *  2. Parseia valores BR/US (números, datas, percentuais)
 *  3. Determina chave de upsert (composta natural pra evitar dup)
 *  4. Retorna `{ ok, dados, erros }`
 *
 * Aliases foram colhidos de exports reais:
 *  - Meta Ads: "Quantidade gasta (BRL)", "Impressões", "Cliques (todos)"
 *  - Google Ads: "Custo", "Impr.", "Cliques"
 *  - Search Console: "Cliques", "Impressões", "CTR", "Posição"
 *  - Instagram Insights: "Mês", "Seguidores", "Alcance"
 *  - Looker Studio: nomes customizáveis, mas Marcelo costuma padronizar
 *
 * Filosofia: ser EXTREMAMENTE tolerante. Se uma coluna faltar, default
 * pra 0 (não erra a linha inteira). Só erra se as colunas-chave
 * (cliente+ano+mes ou cliente+keyword) faltarem.
 */

import { parseBRNumber } from "@/lib/number-br";
import { pegarValor, normalizarHeader } from "@/lib/csv-parser";

// ─────────────────────────────────────────────────────────────────────
// Tipos de retorno
// ─────────────────────────────────────────────────────────────────────

export type RowParseResult<T> =
  | { ok: true; dados: T; raw: Record<string, string> }
  | { ok: false; erro: string; raw: Record<string, string>; linha: number };

export type MapeamentoResult<T> = {
  sucessos: { dados: T; raw: Record<string, string> }[];
  erros: { erro: string; raw: Record<string, string>; linha: number }[];
  totalLinhas: number;
};

// ─────────────────────────────────────────────────────────────────────
// REDES SOCIAIS — destino: MetricaRede
// Chave natural: clienteId + rede + ano + mes
// ─────────────────────────────────────────────────────────────────────

export type MetricaRedeRow = {
  rede: "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "TIKTOK" | "YOUTUBE";
  ano: number;
  mes: number;
  seguidores: number;
  alcance: number;
  impressoes: number;
  engajamento: number;
  posts: number;
  stories: number;
  reels: number;
};

const ALIASES_REDE = {
  rede: ["rede", "plataforma", "canal", "social", "network"],
  ano: ["ano", "year"],
  mes: ["mes", "month"],
  // periodo combinado tipo "01/2026" ou "2026-01" ou "Janeiro/2026"
  periodo: ["periodo", "data", "date", "mes_ano", "competencia", "mes/ano"],
  seguidores: ["seguidores", "followers", "fans", "inscritos", "subscribers"],
  alcance: ["alcance", "reach", "contas_alcancadas", "accounts_reached"],
  impressoes: ["impressoes", "impressions", "impr", "visualizacoes_impressao"],
  engajamento: ["engajamento", "engagement", "interacoes", "interactions", "engajamentos"],
  posts: ["posts", "publicacoes", "feed", "posts_feed"],
  stories: ["stories", "historias"],
  reels: ["reels", "videos", "shorts"],
};

export function mapearRedes(rows: Record<string, string>[]): MapeamentoResult<MetricaRedeRow> {
  const sucessos: MapeamentoResult<MetricaRedeRow>["sucessos"] = [];
  const erros: MapeamentoResult<MetricaRedeRow>["erros"] = [];

  rows.forEach((row, idx) => {
    const linha = idx + 2; // +1 do header, +1 pra ser 1-indexed (humanos contam de 1)

    const rede = inferirRede(pegarValor(row, ALIASES_REDE.rede));
    if (!rede) {
      erros.push({ erro: "Rede não identificada (use INSTAGRAM/FACEBOOK/LINKEDIN/TIKTOK/YOUTUBE)", raw: row, linha });
      return;
    }

    const { ano, mes } = extrairAnoMes(row, ALIASES_REDE.ano, ALIASES_REDE.mes, ALIASES_REDE.periodo);
    if (!ano || !mes) {
      erros.push({ erro: "Ano/mês obrigatórios", raw: row, linha });
      return;
    }

    sucessos.push({
      dados: {
        rede,
        ano,
        mes,
        seguidores: numero(row, ALIASES_REDE.seguidores),
        alcance: numero(row, ALIASES_REDE.alcance),
        impressoes: numero(row, ALIASES_REDE.impressoes),
        engajamento: numero(row, ALIASES_REDE.engajamento),
        posts: numero(row, ALIASES_REDE.posts),
        stories: numero(row, ALIASES_REDE.stories),
        reels: numero(row, ALIASES_REDE.reels),
      },
      raw: row,
    });
  });

  return { sucessos, erros, totalLinhas: rows.length };
}

// ─────────────────────────────────────────────────────────────────────
// SEO — destino: MetricaSeo
// Chave natural: clienteId + ano + mes
// ─────────────────────────────────────────────────────────────────────

export type MetricaSeoRow = {
  ano: number;
  mes: number;
  posicaoMedia: number;
  cliquesOrganicos: number;
  impressoes: number;
  ctr: number;             // 0..1
  keywordsRanqueadas: number;
};

const ALIASES_SEO = {
  ano: ["ano", "year"],
  mes: ["mes", "month"],
  periodo: ["periodo", "data", "date", "mes_ano", "competencia", "mes/ano"],
  posicao: ["posicao_media", "average_position", "posicao", "position", "pos_media"],
  cliques: ["cliques", "clicks", "cliques_organicos", "organic_clicks"],
  impressoes: ["impressoes", "impressions", "impr"],
  ctr: ["ctr", "click_through_rate"],
  keywords: ["keywords", "palavras_chave", "keywords_ranqueadas", "termos_ranqueados", "queries"],
};

export function mapearSeo(rows: Record<string, string>[]): MapeamentoResult<MetricaSeoRow> {
  const sucessos: MapeamentoResult<MetricaSeoRow>["sucessos"] = [];
  const erros: MapeamentoResult<MetricaSeoRow>["erros"] = [];

  rows.forEach((row, idx) => {
    const linha = idx + 2;

    const { ano, mes } = extrairAnoMes(row, ALIASES_SEO.ano, ALIASES_SEO.mes, ALIASES_SEO.periodo);
    if (!ano || !mes) {
      erros.push({ erro: "Ano/mês obrigatórios", raw: row, linha });
      return;
    }

    sucessos.push({
      dados: {
        ano,
        mes,
        posicaoMedia: numero(row, ALIASES_SEO.posicao, { decimal: true }),
        cliquesOrganicos: numero(row, ALIASES_SEO.cliques),
        impressoes: numero(row, ALIASES_SEO.impressoes),
        ctr: parsearCtr(pegarValor(row, ALIASES_SEO.ctr)),
        keywordsRanqueadas: numero(row, ALIASES_SEO.keywords),
      },
      raw: row,
    });
  });

  return { sucessos, erros, totalLinhas: rows.length };
}

// ─────────────────────────────────────────────────────────────────────
// TRÁFEGO PAGO — destino: CampanhaPaga
// Chave natural: clienteId + ano + mes + plataforma + nome
// (campanhas com mesmo nome em meses diferentes são tratadas como
// registros distintos, o que faz sentido pra histórico mensal)
// ─────────────────────────────────────────────────────────────────────

export type CampanhaPagaRow = {
  ano: number;
  mes: number;
  plataforma: "META_ADS" | "GOOGLE_ADS" | "TIKTOK_ADS" | "YOUTUBE_ADS" | "LINKEDIN_ADS";
  nome: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  conversoes: number;
  cpa: number;
  roas: number;
  cpm: number;
  cpcMedio: number;
  insights: string | null;
};

const ALIASES_TRAFEGO = {
  ano: ["ano", "year"],
  mes: ["mes", "month"],
  periodo: ["periodo", "data", "date", "mes_ano", "competencia", "mes/ano"],
  plataforma: ["plataforma", "platform", "rede", "canal", "ad_platform", "fonte"],
  nome: ["nome", "campanha", "campaign", "campaign_name", "nome_da_campanha"],
  investimento: ["investimento", "spend", "custo", "cost", "valor_gasto", "quantidade_gasta_brl", "investido", "spent"],
  impressoes: ["impressoes", "impressions", "impr"],
  cliques: ["cliques", "clicks", "cliques_todos"],
  conversoes: ["conversoes", "conversions", "resultados", "results", "leads"],
  cpa: ["cpa", "custo_por_resultado", "custo_por_conversao", "cost_per_conversion"],
  roas: ["roas", "retorno_sobre_investimento", "return_on_ad_spend"],
  cpm: ["cpm", "custo_por_mil_impressoes"],
  cpc: ["cpc", "cpc_medio", "cost_per_click", "custo_por_clique"],
  insights: ["insights", "observacoes", "notas", "notes"],
};

export function mapearTrafego(rows: Record<string, string>[]): MapeamentoResult<CampanhaPagaRow> {
  const sucessos: MapeamentoResult<CampanhaPagaRow>["sucessos"] = [];
  const erros: MapeamentoResult<CampanhaPagaRow>["erros"] = [];

  rows.forEach((row, idx) => {
    const linha = idx + 2;

    const { ano, mes } = extrairAnoMes(row, ALIASES_TRAFEGO.ano, ALIASES_TRAFEGO.mes, ALIASES_TRAFEGO.periodo);
    if (!ano || !mes) {
      erros.push({ erro: "Ano/mês obrigatórios", raw: row, linha });
      return;
    }

    const plataforma = inferirPlataforma(pegarValor(row, ALIASES_TRAFEGO.plataforma));
    if (!plataforma) {
      erros.push({ erro: "Plataforma não identificada (Meta/Google/TikTok/YouTube/LinkedIn Ads)", raw: row, linha });
      return;
    }

    const nome = pegarValor(row, ALIASES_TRAFEGO.nome);
    if (!nome) {
      erros.push({ erro: "Nome da campanha obrigatório", raw: row, linha });
      return;
    }

    sucessos.push({
      dados: {
        ano,
        mes,
        plataforma,
        nome,
        investimento: numero(row, ALIASES_TRAFEGO.investimento, { decimal: true }),
        impressoes: numero(row, ALIASES_TRAFEGO.impressoes),
        cliques: numero(row, ALIASES_TRAFEGO.cliques),
        conversoes: numero(row, ALIASES_TRAFEGO.conversoes),
        cpa: numero(row, ALIASES_TRAFEGO.cpa, { decimal: true }),
        roas: numero(row, ALIASES_TRAFEGO.roas, { decimal: true }),
        cpm: numero(row, ALIASES_TRAFEGO.cpm, { decimal: true }),
        cpcMedio: numero(row, ALIASES_TRAFEGO.cpc, { decimal: true }),
        insights: pegarValor(row, ALIASES_TRAFEGO.insights),
      },
      raw: row,
    });
  });

  return { sucessos, erros, totalLinhas: rows.length };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────

/**
 * Tenta extrair ano + mês de uma row. Aceita formato dividido (ano em
 * uma coluna, mês em outra) OU formato combinado ("01/2026",
 * "Janeiro/2026", "2026-01").
 */
function extrairAnoMes(
  row: Record<string, string>,
  aliasesAno: string[],
  aliasesMes: string[],
  aliasesPeriodo: string[]
): { ano: number | null; mes: number | null } {
  const ano = parseInt(pegarValor(row, aliasesAno) ?? "");
  const mesRaw = pegarValor(row, aliasesMes);
  const mes = mesRaw ? parsearMes(mesRaw) : null;

  if (Number.isFinite(ano) && mes !== null) return { ano, mes };

  // Tentar formato combinado
  const periodo = pegarValor(row, aliasesPeriodo);
  if (periodo) return parsearPeriodo(periodo);

  return { ano: null, mes: null };
}

/**
 * Parseia mês — aceita número (1..12), nome ("Janeiro", "January", "Jan")
 * ou abreviação ("jan", "ene"). Retorna null se inválido.
 */
function parsearMes(raw: string): number | null {
  const trim = raw.trim().toLowerCase();
  if (!trim) return null;
  const n = parseInt(trim);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return n;

  const mapaMeses: Record<string, number> = {
    janeiro: 1, jan: 1, january: 1,
    fevereiro: 2, fev: 2, february: 2, feb: 2,
    marco: 3, mar: 3, march: 3,
    abril: 4, abr: 4, april: 4, apr: 4,
    maio: 5, mai: 5, may: 5,
    junho: 6, jun: 6, june: 6,
    julho: 7, jul: 7, july: 7,
    agosto: 8, ago: 8, august: 8, aug: 8,
    setembro: 9, set: 9, september: 9, sep: 9, sept: 9,
    outubro: 10, out: 10, october: 10, oct: 10,
    novembro: 11, nov: 11, november: 11,
    dezembro: 12, dez: 12, december: 12, dec: 12,
  };
  // Normaliza removendo acentos
  const norm = trim.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return mapaMeses[norm] ?? null;
}

/**
 * Parseia "01/2026", "2026-01", "Jan/2026", "Janeiro/2026".
 */
function parsearPeriodo(raw: string): { ano: number | null; mes: number | null } {
  const limpo = raw.trim();

  // YYYY-MM ou YYYY/MM
  let m = limpo.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return { ano: parseInt(m[1]), mes: parseInt(m[2]) };

  // MM-YYYY ou MM/YYYY
  m = limpo.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return { ano: parseInt(m[2]), mes: parseInt(m[1]) };

  // NomeMes/YYYY ou NomeMes-YYYY ou "NomeMes de YYYY"
  m = limpo.match(/^([a-zA-ZçÇãÃáÁéÉíÍóÓôÔ]+)\s*(?:[-/]|de\s+)\s*(\d{4})$/);
  if (m) {
    const mes = parsearMes(m[1]);
    return { ano: parseInt(m[2]), mes };
  }

  return { ano: null, mes: null };
}

/**
 * Inferência tolerante de rede social: aceita "Instagram", "IG",
 * "instagram_feed" → INSTAGRAM. Maiúscula direta funciona.
 */
function inferirRede(raw: string | null): MetricaRedeRow["rede"] | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("instagram") || t === "ig") return "INSTAGRAM";
  if (t.includes("facebook") || t === "fb") return "FACEBOOK";
  if (t.includes("linkedin") || t === "li") return "LINKEDIN";
  if (t.includes("tiktok") || t === "tt") return "TIKTOK";
  if (t.includes("youtube") || t === "yt") return "YOUTUBE";
  return null;
}

/**
 * Inferência de plataforma de ads. Aceita "Meta Ads", "Facebook Ads",
 * "META_ADS", "google", "Google Ads", etc.
 */
function inferirPlataforma(raw: string | null): CampanhaPagaRow["plataforma"] | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("meta") || t.includes("facebook") || t.includes("instagram")) return "META_ADS";
  if (t.includes("google")) return "GOOGLE_ADS";
  if (t.includes("tiktok")) return "TIKTOK_ADS";
  if (t.includes("youtube")) return "YOUTUBE_ADS";
  if (t.includes("linkedin")) return "LINKEDIN_ADS";
  return null;
}

/**
 * Lê número de uma row. `decimal=true` preserva casas decimais.
 * Sem decimal, faz Math.round (pra campos que são Int no Prisma).
 * Retorna 0 se vazio/inválido (default seguro pra agregações).
 */
function numero(
  row: Record<string, string>,
  aliases: string[],
  opts: { decimal?: boolean } = {}
): number {
  const v = pegarValor(row, aliases);
  if (!v) return 0;
  const n = parseBRNumber(v);
  if (n === null) return 0;
  return opts.decimal ? n : Math.round(n);
}

/**
 * Parseia CTR. Aceita "0.045", "4.5%", "4,5%", "0,045", "4.5".
 * Retorna sempre em formato decimal (0..1).
 */
function parsearCtr(raw: string | null): number {
  if (!raw) return 0;
  const temPercent = raw.includes("%");
  const n = parseBRNumber(raw);
  if (n === null) return 0;
  // Heurística: se tinha "%" OU número > 1, dividir por 100
  if (temPercent || n > 1) return n / 100;
  return n;
}

// Re-exportar pra quem usa
export { normalizarHeader };
