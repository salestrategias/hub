/**
 * Expansão de variáveis em templates, no formato Mustache leve `{{nome}}`.
 *
 * Suporta acesso por "ponto" (`{{user.nome}}`, `{{cliente.nome}}`).
 * Variáveis ausentes/desconhecidas são deixadas como estão (`{{xpto}}`)
 * para que o usuário perceba e preencha manualmente.
 *
 * Uso: aplicar sobre o JSON serializado do BlockNote ANTES de salvar a
 * nota/reunião. Como blocos podem conter `{{var}}` em strings de content,
 * o regex global trata o JSON inteiro como string — não precisa parsear/
 * walk-tree, é mais leve.
 */

export type TemplateContext = {
  user?: { nome?: string | null; email?: string | null };
  cliente?: { nome?: string | null };
  /** Permite injetar variáveis arbitrárias (ex: futuro `{{projeto.nome}}`). */
  extra?: Record<string, string>;
};

/**
 * Expande um JSON (string) ou texto qualquer trocando `{{var}}` pelos valores.
 * Variáveis não mapeadas ficam intactas.
 */
export function expandTemplateVariables(input: string, ctx: TemplateContext = {}): string {
  if (!input) return input;

  const now = new Date();
  const vars: Record<string, string> = {
    // Datas e tempo
    "data": now.toLocaleDateString("pt-BR"),
    "data_iso": now.toISOString().slice(0, 10),
    "data_extenso": now.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    "hora": now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    "ano_atual": String(now.getFullYear()),
    "mes_atual": String(now.getMonth() + 1).padStart(2, "0"),
    "mes_extenso": now.toLocaleDateString("pt-BR", { month: "long" }),
    "trimestre": `Q${Math.floor(now.getMonth() / 3) + 1}/${now.getFullYear()}`,

    // Contexto
    "user.nome": ctx.user?.nome ?? "",
    "user.email": ctx.user?.email ?? "",
    "cliente.nome": ctx.cliente?.nome ?? "",

    // Extras
    ...ctx.extra,
  };

  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (full, key) => {
    const value = vars[key];
    return value !== undefined && value !== "" ? escapeForJson(value) : full;
  });
}

/**
 * Como input pode ser um JSON BlockNote serializado, valores expandidos
 * podem conter caracteres que quebram o JSON (aspas, barras, newlines).
 * Aplicamos um escape leve antes de inserir.
 *
 * Detecção heurística: se o input parece JSON (começa com `[` ou `{`),
 * escapamos. Caso contrário, devolvemos cru.
 */
function escapeForJson(value: string): string {
  // Escape mínimo pra não quebrar a string JSON onde a substituição vai cair:
  // aspas duplas, barras invertidas, e quebras de linha.
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Lista as variáveis disponíveis (pra mostrar no editor de template como dica).
 */
export const VARIAVEIS_DISPONIVEIS: Array<{ chave: string; descricao: string; exemplo: string }> = [
  { chave: "{{data}}", descricao: "Data atual (DD/MM/AAAA)", exemplo: "06/05/2026" },
  { chave: "{{data_extenso}}", descricao: "Data por extenso", exemplo: "6 de maio de 2026" },
  { chave: "{{data_iso}}", descricao: "Data em formato ISO", exemplo: "2026-05-06" },
  { chave: "{{hora}}", descricao: "Hora atual (HH:MM)", exemplo: "14:30" },
  { chave: "{{ano_atual}}", descricao: "Ano corrente", exemplo: "2026" },
  { chave: "{{mes_atual}}", descricao: "Mês corrente (01-12)", exemplo: "05" },
  { chave: "{{mes_extenso}}", descricao: "Mês por extenso", exemplo: "maio" },
  { chave: "{{trimestre}}", descricao: "Trimestre / ano", exemplo: "Q2/2026" },
  { chave: "{{user.nome}}", descricao: "Seu nome", exemplo: "Marcelo Freitas" },
  { chave: "{{user.email}}", descricao: "Seu email", exemplo: "marcelo@salestrategias.com.br" },
  { chave: "{{cliente.nome}}", descricao: "Nome do cliente (quando aplicável)", exemplo: "Cliente XYZ" },
];
