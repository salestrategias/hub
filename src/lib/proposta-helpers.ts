/**
 * Helpers compartilhados entre rotas e renderers de proposta.
 *
 * - `propostaContexto`: monta o ctx pra expandir {{vars}} em qualquer seção
 * - `extrairTextoDeBlocos`: BlockNote JSON → string plana (usado em PDF)
 */
import { expandTemplateVariables, type TemplateContext } from "@/lib/template-variables";

type PropostaParaContexto = {
  numero: string;
  titulo: string;
  clienteNome: string;
  clienteEmail: string | null;
  valorMensal: number | null;
  valorTotal: number | null;
  duracaoMeses: number | null;
  validadeDias: number;
  shareExpiraEm: Date | null;
};

/**
 * Constrói o contexto de variáveis pra uma proposta.
 * Pode ser usado com `expandTemplateVariables` em qualquer seção.
 *
 * Variáveis extras (além das de template-variables.ts):
 *   {{proposta.numero}}, {{proposta.titulo}}
 *   {{cliente.nome}}, {{cliente.email}}
 *   {{valor.mensal}}, {{valor.total}}, {{duracao.meses}}
 *   {{validade.dias}}, {{validade.data}}
 */
export function propostaContexto(
  proposta: PropostaParaContexto,
  user: { name?: string | null; email?: string | null }
): TemplateContext {
  const validadeData =
    proposta.shareExpiraEm ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + proposta.validadeDias);
      return d;
    })();

  return {
    user: { nome: user.name ?? "", email: user.email ?? "" },
    cliente: { nome: proposta.clienteNome },
    extra: {
      "proposta.numero": proposta.numero,
      "proposta.titulo": proposta.titulo,
      "cliente.email": proposta.clienteEmail ?? "",
      "valor.mensal": proposta.valorMensal !== null ? formatBRL(proposta.valorMensal) : "",
      "valor.total": proposta.valorTotal !== null ? formatBRL(proposta.valorTotal) : "",
      "duracao.meses": proposta.duracaoMeses !== null ? String(proposta.duracaoMeses) : "",
      "validade.dias": String(proposta.validadeDias),
      "validade.data": validadeData.toLocaleDateString("pt-BR"),
    },
  };
}

/** Expande variáveis em um JSON BlockNote (string). */
export function expandirSecaoProposta(
  jsonOuTexto: string | null | undefined,
  ctx: TemplateContext
): string {
  if (!jsonOuTexto) return "";
  return expandTemplateVariables(jsonOuTexto, ctx);
}

/**
 * Extrai texto plano de um JSON BlockNote, preservando ordem e quebras
 * de linha entre blocos. Usado pelo PDF generator (que renderiza com
 * react-pdf e prefere texto puro com tags simples).
 *
 * Heurística:
 *  - Cada block vira 1 parágrafo
 *  - Headings prefixam com `# ` / `## ` / `### ` (pro PDF detectar e estilizar)
 *  - Listas: `- `
 *  - Check: `[x] ` / `[ ] `
 *  - Inline marks viram texto cru (negrito não é preservado nessa heurística)
 */
export function extrairTextoDeBlocos(jsonOuTexto: string | null | undefined): string {
  if (!jsonOuTexto) return "";
  const trimmed = jsonOuTexto.trim();
  if (!trimmed) return "";

  // Não é JSON BlockNote — devolve cru
  if (!trimmed.startsWith("[")) return trimmed;

  let blocks: unknown[];
  try {
    blocks = JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
  if (!Array.isArray(blocks)) return "";

  const linhas: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const obj = b as { type?: string; props?: Record<string, unknown>; content?: unknown };
    const tipo = obj.type;
    const texto = inlineToText(obj.content);
    if (!texto && tipo !== "paragraph") continue;

    switch (tipo) {
      case "heading": {
        const level = (obj.props?.level as number) ?? 1;
        linhas.push(`${"#".repeat(level)} ${texto}`);
        break;
      }
      case "bulletListItem":
        linhas.push(`- ${texto}`);
        break;
      case "numberedListItem":
        linhas.push(`1. ${texto}`);
        break;
      case "checkListItem": {
        const checked = (obj.props?.checked as boolean) ?? false;
        linhas.push(`${checked ? "[x]" : "[ ]"} ${texto}`);
        break;
      }
      case "codeBlock":
        linhas.push("```");
        linhas.push(texto);
        linhas.push("```");
        break;
      default:
        linhas.push(texto);
    }
  }

  return linhas.join("\n");
}

function inlineToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((seg) => {
      if (typeof seg === "string") return seg;
      if (!seg || typeof seg !== "object") return "";
      const s = seg as { type?: string; text?: string; content?: unknown; props?: Record<string, unknown> };
      if (s.type === "mention") {
        const label = (s.props?.label as string) ?? "";
        return `@${label}`;
      }
      if (s.type === "link" && Array.isArray(s.content)) {
        return inlineToText(s.content);
      }
      return s.text ?? "";
    })
    .join("");
}

export function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
