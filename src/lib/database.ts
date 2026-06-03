/**
 * database.ts — "engine" dos databases configuráveis (estilo Notion).
 *
 * Fonte da verdade do COMPORTAMENTO de cada tipo de propriedade:
 *  - tipo de valor TS por PropertyTipo
 *  - shape do `config` por tipo (opções de SELECT, formato de NUMERO, …)
 *  - `defaultConfigDe(tipo)` — config inicial ao criar/converter coluna
 *  - coerção + validação de valor (entra Json livre, sai valor são)
 *  - helpers de label/ícone/formatação pra UI
 *
 * Os valores de uma linha ficam em `DatabaseRow.valores` (Json), keyed por
 * `propertyId`. Cada tipo guarda um formato canônico:
 *   TEXTO/URL        → string
 *   NUMERO           → number
 *   SELECT           → string (id da opção) | null
 *   MULTISELECT      → string[] (ids de opções)
 *   DATA             → string ISO "YYYY-MM-DD" | null
 *   CHECKBOX         → boolean
 *   RELACAO          → string[] (ids de linhas alvo) — bloco futuro
 *
 * NÃO contém JSX nem depende de React — pode rodar no server (API) e client.
 */
import type { PropertyTipo } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────
// Opção de SELECT/MULTISELECT
// ─────────────────────────────────────────────────────────────────────
export type SelectOption = { id: string; nome: string; cor: SelectCor };

/** Paleta de cores das opções (chaves estáveis — guardadas no config). */
export const SELECT_CORES = [
  "cinza",
  "vermelho",
  "laranja",
  "amarelo",
  "verde",
  "azul",
  "roxo",
  "rosa",
] as const;
export type SelectCor = (typeof SELECT_CORES)[number];

/**
 * Classes Tailwind por cor (bg suave + texto + borda). Estáticas pra não
 * quebrar o purge do Tailwind (nada de template-string dinâmica de classe).
 */
export const SELECT_COR_CLASSES: Record<SelectCor, string> = {
  cinza: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  vermelho: "bg-red-500/15 text-red-300 border-red-500/30",
  laranja: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  amarelo: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  verde: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  azul: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  roxo: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  rosa: "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

/** Swatch sólido (bolinha/preview no editor de opções). */
export const SELECT_COR_SWATCH: Record<SelectCor, string> = {
  cinza: "bg-zinc-400",
  vermelho: "bg-red-400",
  laranja: "bg-orange-400",
  amarelo: "bg-amber-400",
  verde: "bg-emerald-400",
  azul: "bg-sky-400",
  roxo: "bg-violet-400",
  rosa: "bg-pink-400",
};

export function corDaOpcao(cor: string | undefined): SelectCor {
  return (SELECT_CORES as readonly string[]).includes(cor ?? "")
    ? (cor as SelectCor)
    : "cinza";
}

// ─────────────────────────────────────────────────────────────────────
// Config por tipo de propriedade
// ─────────────────────────────────────────────────────────────────────
export type NumeroFormato = "PLAIN" | "INTEIRO" | "MOEDA" | "PORCENTAGEM";

export type PropertyConfig = {
  /** SELECT / MULTISELECT */
  opcoes?: SelectOption[];
  /** NUMERO */
  formato?: NumeroFormato;
  casas?: number;
  /** RELACAO (bloco futuro) — database alvo */
  databaseAlvoId?: string;
};

/** Config inicial ao criar uma coluna de cada tipo. */
export function defaultConfigDe(tipo: PropertyTipo): PropertyConfig {
  switch (tipo) {
    case "SELECT":
    case "MULTISELECT":
      return { opcoes: [] };
    case "NUMERO":
      return { formato: "PLAIN", casas: 0 };
    case "RELACAO":
      return { databaseAlvoId: undefined };
    default:
      return {};
  }
}

/** Lê config (Json livre do banco) de forma defensiva e tipada. */
export function lerConfig(config: unknown): PropertyConfig {
  if (!config || typeof config !== "object") return {};
  const c = config as Record<string, unknown>;
  const out: PropertyConfig = {};
  if (Array.isArray(c.opcoes)) {
    out.opcoes = c.opcoes
      .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
      .map((o) => ({
        id: String(o.id ?? cryptoId()),
        nome: String(o.nome ?? ""),
        cor: corDaOpcao(typeof o.cor === "string" ? o.cor : undefined),
      }));
  }
  if (typeof c.formato === "string") out.formato = c.formato as NumeroFormato;
  if (typeof c.casas === "number") out.casas = c.casas;
  if (typeof c.databaseAlvoId === "string") out.databaseAlvoId = c.databaseAlvoId;
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Metadados de tipo (label + ícone lucide por nome) — UI consome
// ─────────────────────────────────────────────────────────────────────
/** Nome do ícone lucide-react por tipo (o componente mapeia pra <Icon/>). */
export type TipoMeta = { tipo: PropertyTipo; label: string; icone: string; descricao: string };

export const TIPOS_META: TipoMeta[] = [
  { tipo: "TEXTO", label: "Texto", icone: "Type", descricao: "Texto livre" },
  { tipo: "NUMERO", label: "Número", icone: "Hash", descricao: "Valor numérico (moeda, %, inteiro)" },
  { tipo: "SELECT", label: "Seleção", icone: "ChevronDownCircle", descricao: "Uma opção de uma lista" },
  { tipo: "MULTISELECT", label: "Multi-seleção", icone: "Tags", descricao: "Várias opções de uma lista" },
  { tipo: "DATA", label: "Data", icone: "Calendar", descricao: "Uma data" },
  { tipo: "CHECKBOX", label: "Checkbox", icone: "CheckSquare", descricao: "Verdadeiro / falso" },
  { tipo: "URL", label: "URL", icone: "Link", descricao: "Link clicável" },
  { tipo: "RELACAO", label: "Relação", icone: "Database", descricao: "Link pra outro database" },
];

/** Tipos oferecidos ao usuário neste bloco (RELACAO fica pro próximo). */
export const TIPOS_DISPONIVEIS: PropertyTipo[] = [
  "TEXTO",
  "NUMERO",
  "SELECT",
  "MULTISELECT",
  "DATA",
  "CHECKBOX",
  "URL",
];

const _metaByTipo = new Map(TIPOS_META.map((m) => [m.tipo, m]));
export function metaDe(tipo: PropertyTipo): TipoMeta {
  return _metaByTipo.get(tipo) ?? TIPOS_META[0];
}
export function labelDoTipo(tipo: PropertyTipo): string {
  return metaDe(tipo).label;
}
export function iconeDoTipo(tipo: PropertyTipo): string {
  return metaDe(tipo).icone;
}

// ─────────────────────────────────────────────────────────────────────
// Coerção / validação de valor por tipo
// ─────────────────────────────────────────────────────────────────────
export type CellValue = string | number | boolean | string[] | null;

/**
 * Coage um valor cru (vindo do front / banco) ao formato canônico do tipo.
 * Sempre retorna algo gravável — nunca lança. Usado tanto na API (PATCH de
 * `valores`) quanto na leitura defensiva na UI.
 */
export function coerceValor(tipo: PropertyTipo, valor: unknown, config?: PropertyConfig): CellValue {
  switch (tipo) {
    case "TEXTO":
    case "URL":
      return valor == null ? "" : String(valor);

    case "NUMERO": {
      if (valor === "" || valor == null) return null;
      const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }

    case "CHECKBOX":
      return valor === true || valor === "true" || valor === 1 || valor === "1";

    case "DATA": {
      if (!valor) return null;
      const s = String(valor);
      // Aceita "YYYY-MM-DD" direto; normaliza ISO completo pra data simples.
      const m = s.match(/^\d{4}-\d{2}-\d{2}/);
      return m ? m[0] : null;
    }

    case "SELECT": {
      if (!valor) return null;
      const id = String(valor);
      const opcoes = config?.opcoes ?? [];
      // Se há opções definidas, só aceita id existente; senão deixa passar.
      if (opcoes.length && !opcoes.some((o) => o.id === id)) return null;
      return id;
    }

    case "MULTISELECT": {
      const arr = Array.isArray(valor) ? valor : valor ? [valor] : [];
      const ids = arr.map((v) => String(v));
      const opcoes = config?.opcoes ?? [];
      const filtrado = opcoes.length ? ids.filter((id) => opcoes.some((o) => o.id === id)) : ids;
      // dedup preservando ordem
      return Array.from(new Set(filtrado));
    }

    case "RELACAO": {
      const arr = Array.isArray(valor) ? valor : valor ? [valor] : [];
      return Array.from(new Set(arr.map((v) => String(v))));
    }

    default:
      return valor == null ? "" : String(valor);
  }
}

/** Valor "vazio" canônico do tipo — usado em defaults/limpeza. */
export function valorVazioDe(tipo: PropertyTipo): CellValue {
  switch (tipo) {
    case "CHECKBOX":
      return false;
    case "MULTISELECT":
    case "RELACAO":
      return [];
    case "NUMERO":
    case "SELECT":
    case "DATA":
      return null;
    default:
      return "";
  }
}

/** True se a célula está "vazia" (pra placeholders/contagem). */
export function valorVazio(tipo: PropertyTipo, valor: CellValue): boolean {
  if (valor == null) return true;
  if (tipo === "CHECKBOX") return false; // false ainda é um valor exibível
  if (Array.isArray(valor)) return valor.length === 0;
  return String(valor).trim() === "";
}

// ─────────────────────────────────────────────────────────────────────
// Formatação de exibição (texto puro — UI rica fica nos componentes)
// ─────────────────────────────────────────────────────────────────────
export function formatarNumero(n: number, config?: PropertyConfig): string {
  const formato = config?.formato ?? "PLAIN";
  const casas = config?.casas ?? (formato === "MOEDA" ? 2 : 0);
  switch (formato) {
    case "MOEDA":
      return n.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      });
    case "PORCENTAGEM":
      return `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
    case "INTEIRO":
      return Math.round(n).toLocaleString("pt-BR");
    default:
      return n.toLocaleString("pt-BR", { maximumFractionDigits: 10 });
  }
}

export function formatarData(iso: string): string {
  // iso = "YYYY-MM-DD" — evita timezone shift instanciando UTC.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ─────────────────────────────────────────────────────────────────────
// Util — id curto pra opções (não precisa de cuid no client)
// ─────────────────────────────────────────────────────────────────────
export function cryptoId(): string {
  // Funciona no browser e no node 18+. Fallback simples se faltar.
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch {
    /* ignore */
  }
  return Math.random().toString(36).slice(2, 10);
}

/** Cria uma opção nova com a próxima cor "girando" pela paleta. */
export function novaOpcao(nome: string, existentes: SelectOption[]): SelectOption {
  const cor = SELECT_CORES[existentes.length % SELECT_CORES.length];
  return { id: cryptoId(), nome: nome.trim() || "Opção", cor };
}
