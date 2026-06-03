/**
 * database-query.ts — motor de FILTRO + ORDENAÇÃO dos databases (estilo Notion).
 *
 * Aplicado em TODAS as views (Tabela, Board, Calendário). A view guarda em
 * `config.filtros` / `config.ordenacoes` (Json livre) e a UI passa as rows por
 * `aplicarView(rows, view, props)` antes de renderizar.
 *
 *   filtros     = [{ id, propertyId, operador, valor }]
 *   ordenacoes  = [{ propertyId, direcao: "asc" | "desc" }]   (multi-nível)
 *
 * O COMPORTAMENTO por tipo (coerção do valor canônico) vem de database.ts —
 * aqui só decidimos operadores válidos por tipo e comparações coerentes.
 * NÃO contém JSX nem depende de React — roda no server e no client.
 */
import type { PropertyTipo } from "@prisma/client";
import { coerceValor, lerConfig, type CellValue } from "@/lib/database";

// ─────────────────────────────────────────────────────────────────────
// Tipos persistidos no config da view
// ─────────────────────────────────────────────────────────────────────
export type FiltroOperador =
  // texto / url
  | "contem"
  | "nao_contem"
  | "igual"
  | "diferente"
  // numero / data
  | "maior"
  | "menor"
  // select
  | "e"
  | "nao_e"
  // multiselect
  | "contem_opcao"
  | "nao_contem_opcao"
  // data
  | "antes"
  | "depois"
  | "e_data"
  // checkbox
  | "marcado"
  | "desmarcado"
  // presença (quase todos)
  | "vazio"
  | "preenchido";

export type Filtro = {
  id: string;
  propertyId: string;
  operador: FiltroOperador;
  /** Valor de comparação (formato cru; coerido pelo tipo da propriedade). */
  valor?: unknown;
};

export type Direcao = "asc" | "desc";
export type Ordenacao = { propertyId: string; direcao: Direcao };

/** Shape mínimo de propriedade que o motor precisa (compatível com DbProperty). */
export type PropriedadeLike = { id: string; tipo: PropertyTipo; config: unknown };
/** Shape mínimo de row que o motor precisa (compatível com DbRow). */
export type RowLike = { valores: Record<string, unknown> };

// ─────────────────────────────────────────────────────────────────────
// Catálogo de operadores por tipo (UI consome pra montar o seletor)
// ─────────────────────────────────────────────────────────────────────
export type OperadorMeta = {
  op: FiltroOperador;
  label: string;
  /** Se false, o filtro não tem campo de valor (ex.: vazio / marcado). */
  precisaValor: boolean;
};

const VAZIO: OperadorMeta = { op: "vazio", label: "está vazio", precisaValor: false };
const PREENCHIDO: OperadorMeta = { op: "preenchido", label: "está preenchido", precisaValor: false };

const OPS_TEXTO: OperadorMeta[] = [
  { op: "contem", label: "contém", precisaValor: true },
  { op: "nao_contem", label: "não contém", precisaValor: true },
  { op: "igual", label: "é igual a", precisaValor: true },
  { op: "diferente", label: "é diferente de", precisaValor: true },
  VAZIO,
  PREENCHIDO,
];

const OPS_NUMERO: OperadorMeta[] = [
  { op: "igual", label: "=", precisaValor: true },
  { op: "diferente", label: "≠", precisaValor: true },
  { op: "maior", label: ">", precisaValor: true },
  { op: "menor", label: "<", precisaValor: true },
  VAZIO,
  PREENCHIDO,
];

const OPS_SELECT: OperadorMeta[] = [
  { op: "e", label: "é", precisaValor: true },
  { op: "nao_e", label: "não é", precisaValor: true },
  VAZIO,
  PREENCHIDO,
];

const OPS_MULTISELECT: OperadorMeta[] = [
  { op: "contem_opcao", label: "contém", precisaValor: true },
  { op: "nao_contem_opcao", label: "não contém", precisaValor: true },
  VAZIO,
  PREENCHIDO,
];

const OPS_DATA: OperadorMeta[] = [
  { op: "e_data", label: "é", precisaValor: true },
  { op: "antes", label: "está antes de", precisaValor: true },
  { op: "depois", label: "está depois de", precisaValor: true },
  VAZIO,
  PREENCHIDO,
];

const OPS_CHECKBOX: OperadorMeta[] = [
  { op: "marcado", label: "marcado", precisaValor: false },
  { op: "desmarcado", label: "desmarcado", precisaValor: false },
];

const OPS_POR_TIPO: Record<PropertyTipo, OperadorMeta[]> = {
  TEXTO: OPS_TEXTO,
  URL: OPS_TEXTO,
  NUMERO: OPS_NUMERO,
  SELECT: OPS_SELECT,
  MULTISELECT: OPS_MULTISELECT,
  DATA: OPS_DATA,
  CHECKBOX: OPS_CHECKBOX,
  // RELACAO entra num bloco futuro — sem operadores por enquanto.
  RELACAO: [],
};

/** Operadores disponíveis pra um tipo (a propriedade dita os operadores). */
export function operadoresDoTipo(tipo: PropertyTipo): OperadorMeta[] {
  return OPS_POR_TIPO[tipo] ?? [];
}

/** Operador default ao criar um filtro novo pra uma propriedade. */
export function operadorPadraoDe(tipo: PropertyTipo): FiltroOperador {
  return (operadoresDoTipo(tipo)[0]?.op ?? "preenchido") as FiltroOperador;
}

/** Metadados de um operador específico (pra UI saber se precisa de valor). */
export function metaDoOperador(tipo: PropertyTipo, op: FiltroOperador): OperadorMeta | undefined {
  return operadoresDoTipo(tipo).find((m) => m.op === op);
}

// ─────────────────────────────────────────────────────────────────────
// Avaliação de UM filtro contra UMA row
// ─────────────────────────────────────────────────────────────────────
function ehVazio(tipo: PropertyTipo, v: CellValue): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (tipo === "CHECKBOX") return false; // checkbox nunca conta como "vazio"
  return String(v).trim() === "";
}

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

/** Aplica UM filtro a UMA row. Operador incompatível com o tipo → ignora (true). */
export function avaliarFiltro(
  filtro: Filtro,
  row: RowLike,
  prop: PropriedadeLike
): boolean {
  const cfg = lerConfig(prop.config);
  const cell = coerceValor(prop.tipo, row.valores[prop.id], cfg);
  const op = filtro.operador;

  // Operadores de presença valem pra qualquer tipo.
  if (op === "vazio") return ehVazio(prop.tipo, cell);
  if (op === "preenchido") return !ehVazio(prop.tipo, cell);

  switch (prop.tipo) {
    case "TEXTO":
    case "URL": {
      const alvo = norm(filtro.valor);
      const atual = norm(cell);
      switch (op) {
        case "contem":
          return atual.includes(alvo);
        case "nao_contem":
          return !atual.includes(alvo);
        case "igual":
          return atual === alvo;
        case "diferente":
          return atual !== alvo;
        default:
          return true;
      }
    }

    case "NUMERO": {
      const atual = typeof cell === "number" ? cell : null;
      const alvoRaw = coerceValor("NUMERO", filtro.valor, cfg);
      const alvo = typeof alvoRaw === "number" ? alvoRaw : null;
      if (atual == null || alvo == null) return false;
      switch (op) {
        case "igual":
          return atual === alvo;
        case "diferente":
          return atual !== alvo;
        case "maior":
          return atual > alvo;
        case "menor":
          return atual < alvo;
        default:
          return true;
      }
    }

    case "SELECT": {
      const atual = typeof cell === "string" ? cell : null;
      const alvo = typeof filtro.valor === "string" ? filtro.valor : null;
      switch (op) {
        case "e":
          return atual === alvo;
        case "nao_e":
          return atual !== alvo;
        default:
          return true;
      }
    }

    case "MULTISELECT": {
      const atual = Array.isArray(cell) ? (cell as string[]) : [];
      const alvo = typeof filtro.valor === "string" ? filtro.valor : null;
      if (!alvo) return true;
      switch (op) {
        case "contem_opcao":
          return atual.includes(alvo);
        case "nao_contem_opcao":
          return !atual.includes(alvo);
        default:
          return true;
      }
    }

    case "DATA": {
      const atual = typeof cell === "string" ? cell : null; // "YYYY-MM-DD"
      const alvoRaw = coerceValor("DATA", filtro.valor, cfg);
      const alvo = typeof alvoRaw === "string" ? alvoRaw : null;
      if (atual == null || alvo == null) return false;
      // Comparação lexicográfica funciona pra ISO "YYYY-MM-DD".
      switch (op) {
        case "e_data":
          return atual === alvo;
        case "antes":
          return atual < alvo;
        case "depois":
          return atual > alvo;
        default:
          return true;
      }
    }

    case "CHECKBOX": {
      const atual = cell === true;
      switch (op) {
        case "marcado":
          return atual;
        case "desmarcado":
          return !atual;
        default:
          return true;
      }
    }

    default:
      return true;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Filtrar — AND de todos os filtros válidos
// ─────────────────────────────────────────────────────────────────────
export function filtrarRows<R extends RowLike>(
  rows: R[],
  filtros: Filtro[] | undefined,
  propriedades: PropriedadeLike[]
): R[] {
  if (!filtros || filtros.length === 0) return rows;
  const byId = new Map(propriedades.map((p) => [p.id, p]));
  // Só considera filtros cuja propriedade ainda existe.
  const ativos = filtros.filter((f) => byId.has(f.propertyId));
  if (ativos.length === 0) return rows;
  return rows.filter((row) =>
    ativos.every((f) => {
      const prop = byId.get(f.propertyId);
      return prop ? avaliarFiltro(f, row, prop) : true;
    })
  );
}

// ─────────────────────────────────────────────────────────────────────
// Ordenar — multi-nível, comparação coerente por tipo
// ─────────────────────────────────────────────────────────────────────
/** Chave comparável por tipo: number p/ NUMERO, string p/ resto, null = vazio. */
function chaveComparavel(prop: PropriedadeLike, row: RowLike): number | string | boolean | null {
  const cfg = lerConfig(prop.config);
  const v = coerceValor(prop.tipo, row.valores[prop.id], cfg);
  switch (prop.tipo) {
    case "NUMERO":
      return typeof v === "number" ? v : null;
    case "CHECKBOX":
      return v === true; // false < true
    case "DATA":
      return typeof v === "string" && v ? v : null; // ISO ordenável lexicograficamente
    case "SELECT": {
      // Ordena pelo NOME da opção (não pelo id) — alfabético previsível.
      if (typeof v !== "string") return null;
      const op = (cfg.opcoes ?? []).find((o) => o.id === v);
      return op ? op.nome.toLowerCase() : v.toLowerCase();
    }
    case "MULTISELECT": {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      if (arr.length === 0) return null;
      const nomes = arr
        .map((id) => (cfg.opcoes ?? []).find((o) => o.id === id)?.nome ?? id)
        .map((s) => s.toLowerCase());
      return nomes.sort().join(", ");
    }
    default: {
      // TEXTO / URL
      const s = typeof v === "string" ? v.trim().toLowerCase() : "";
      return s === "" ? null : s;
    }
  }
}

/** Compara duas chaves do mesmo tipo. Vazios (null) sempre por último. */
function compararChaves(
  a: number | string | boolean | null,
  b: number | string | boolean | null
): number {
  const aVazio = a == null;
  const bVazio = b == null;
  if (aVazio && bVazio) return 0;
  if (aVazio) return 1; // vazio depois
  if (bVazio) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

export function ordenarRows<R extends RowLike>(
  rows: R[],
  ordenacoes: Ordenacao[] | undefined,
  propriedades: PropriedadeLike[]
): R[] {
  if (!ordenacoes || ordenacoes.length === 0) return rows;
  const byId = new Map(propriedades.map((p) => [p.id, p]));
  const regras = ordenacoes.filter((o) => byId.has(o.propertyId));
  if (regras.length === 0) return rows;

  // Cópia estável (Array.prototype.sort é estável no V8/Node 12+).
  return [...rows].sort((ra, rb) => {
    for (const regra of regras) {
      const prop = byId.get(regra.propertyId);
      if (!prop) continue;
      const cmp = compararChaves(chaveComparavel(prop, ra), chaveComparavel(prop, rb));
      if (cmp !== 0) return regra.direcao === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

// ─────────────────────────────────────────────────────────────────────
// Pipeline público: filtrar → ordenar
// ─────────────────────────────────────────────────────────────────────
export type ViewQuery = { filtros?: Filtro[]; ordenacoes?: Ordenacao[] };

export function aplicarView<R extends RowLike>(
  rows: R[],
  view: ViewQuery | undefined,
  propriedades: PropriedadeLike[]
): R[] {
  const filtradas = filtrarRows(rows, view?.filtros, propriedades);
  return ordenarRows(filtradas, view?.ordenacoes, propriedades);
}

// ─────────────────────────────────────────────────────────────────────
// Leitura defensiva de filtros/ordenacoes do Json livre da view
// ─────────────────────────────────────────────────────────────────────
const OPERADORES_VALIDOS = new Set<string>([
  "contem", "nao_contem", "igual", "diferente",
  "maior", "menor", "e", "nao_e",
  "contem_opcao", "nao_contem_opcao",
  "antes", "depois", "e_data",
  "marcado", "desmarcado", "vazio", "preenchido",
]);

export function lerFiltros(raw: unknown): Filtro[] {
  if (!Array.isArray(raw)) return [];
  const out: Filtro[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.propertyId !== "string") continue;
    if (typeof o.operador !== "string" || !OPERADORES_VALIDOS.has(o.operador)) continue;
    out.push({
      id: typeof o.id === "string" ? o.id : `${o.propertyId}-${out.length}`,
      propertyId: o.propertyId,
      operador: o.operador as FiltroOperador,
      valor: "valor" in o ? o.valor : undefined,
    });
  }
  return out;
}

export function lerOrdenacoes(raw: unknown): Ordenacao[] {
  if (!Array.isArray(raw)) return [];
  const out: Ordenacao[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.propertyId !== "string") continue;
    out.push({
      propertyId: o.propertyId,
      direcao: o.direcao === "desc" ? "desc" : "asc",
    });
  }
  return out;
}
