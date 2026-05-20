/**
 * Catálogo de widgets do dashboard.
 *
 * Cada widget tem ID estável (não mude depois de publicar — quebra layouts
 * salvos no DB), título visível e descrição curta pra usuário entender o que
 * é antes de ligar/desligar.
 *
 * Pra adicionar um widget novo:
 *  1. Adiciona ID + meta aqui
 *  2. Mapeia o ID → React component no dashboard renderer (page.tsx)
 *  3. Layout default abaixo precisa ser atualizado pra incluir o ID
 *     OU usuários só veem o widget novo depois de personalizar (ok também)
 */

export type WidgetId =
  | "saudacao"
  | "kpis"
  | "hoje"
  | "atencao"
  | "pulse"
  | "comercial"
  | "charts";

export type WidgetMeta = {
  id: WidgetId;
  titulo: string;
  descricao: string;
  /** "full" ocupa a largura toda, "split" são 2 widgets lado a lado em desktop */
  largura: "full" | "split";
};

export const WIDGETS: WidgetMeta[] = [
  {
    id: "saudacao",
    titulo: "Saudação contextual",
    descricao: "Cumprimento + data + 1ª frase pulse (tarefas / posts pra hoje).",
    largura: "full",
  },
  {
    id: "kpis",
    titulo: "KPIs do negócio",
    descricao: "MRR, receita do mês, clientes ativos, pulse de pipeline.",
    largura: "full",
  },
  {
    id: "hoje",
    titulo: "Hoje × Atenção",
    descricao: "Agenda do dia ao lado de itens que precisam de atenção urgente.",
    largura: "full",
  },
  {
    id: "atencao",
    titulo: "Itens de atenção",
    descricao: "Tarefas atrasadas + contratos vencendo + propostas expirando.",
    largura: "full",
  },
  {
    id: "pulse",
    titulo: "Pulse de produção",
    descricao: "3 cards: posts publicados, tarefas concluídas, atividade recente.",
    largura: "full",
  },
  {
    id: "comercial",
    titulo: "Pipeline comercial",
    descricao: "Leads ativos + ganhos do trimestre + breakdown por status.",
    largura: "full",
  },
  {
    id: "charts",
    titulo: "Charts financeiros",
    descricao: "Receita 12 meses + receita por cliente.",
    largura: "full",
  },
];

export type LayoutItem = { id: WidgetId; visivel: boolean };
export type Layout = { widgets: LayoutItem[] };

/**
 * Layout default (idêntico ao que era hard-coded antes da feature). Usado
 * quando o user ainda não personalizou OU quando o JSON salvo tá corrompido.
 */
export const LAYOUT_DEFAULT: Layout = {
  widgets: [
    { id: "saudacao", visivel: true },
    { id: "kpis", visivel: true },
    { id: "hoje", visivel: true },
    { id: "atencao", visivel: false }, // já vem em "hoje", default off pra evitar duplicação
    { id: "pulse", visivel: true },
    { id: "comercial", visivel: true },
    { id: "charts", visivel: true },
  ],
};

/**
 * Normaliza JSON vindo do DB. Garante shape + reconcilia com WIDGETS
 * (adiciona widgets novos como visíveis no fim, descarta IDs deletados).
 */
export function normalizarLayout(raw: unknown): Layout {
  if (!raw || typeof raw !== "object") return LAYOUT_DEFAULT;
  const r = raw as { widgets?: unknown };
  if (!Array.isArray(r.widgets)) return LAYOUT_DEFAULT;

  const ids = new Set(WIDGETS.map((w) => w.id));
  const validos: LayoutItem[] = [];
  const jaVistos = new Set<string>();

  for (const item of r.widgets) {
    if (!item || typeof item !== "object") continue;
    const it = item as { id?: unknown; visivel?: unknown };
    if (typeof it.id !== "string" || !ids.has(it.id as WidgetId)) continue;
    if (jaVistos.has(it.id)) continue;
    jaVistos.add(it.id);
    validos.push({
      id: it.id as WidgetId,
      visivel: it.visivel === undefined ? true : Boolean(it.visivel),
    });
  }

  // Widgets novos (adicionados ao código depois do save) entram no fim
  for (const w of WIDGETS) {
    if (!jaVistos.has(w.id)) {
      validos.push({ id: w.id, visivel: true });
    }
  }

  return { widgets: validos };
}
