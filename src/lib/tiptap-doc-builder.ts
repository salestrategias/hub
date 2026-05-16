/**
 * Helper conciso pra montar documentos Tiptap programaticamente.
 *
 * Tiptap usa JSON no formato `{type:"doc", content:[...]}`. Escrever
 * isso à mão é verboso. Esses helpers deixam o seed do manual fluido:
 *
 *   doc(
 *     h1("Visão geral"),
 *     p("Texto explicando o que é"),
 *     h2("Como usar"),
 *     ul("Passo 1", "Passo 2", "Passo 3"),
 *   )
 *
 * Retorna uma string JSON pronta pra `prisma.create({ conteudo })`.
 */

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> };

/** Doc raiz. Recebe N blocos de top-level. Retorna string serializada. */
export function doc(...blocks: Node[]): string {
  return JSON.stringify({ type: "doc", content: blocks });
}

/** Parágrafo. Aceita strings (texto puro) ou nodes inline. */
export function p(...parts: Array<string | Node>): Node {
  return {
    type: "paragraph",
    content: parts.map((x) => (typeof x === "string" ? { type: "text", text: x } : x)),
  };
}

/** Heading H1 */
export function h1(text: string): Node {
  return { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] };
}

/** Heading H2 */
export function h2(text: string): Node {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}

/** Heading H3 */
export function h3(text: string): Node {
  return { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] };
}

/** Bullet list. Cada item pode ser string ou parágrafo customizado. */
export function ul(...items: Array<string | Node>): Node {
  return {
    type: "bulletList",
    content: items.map((it) => ({
      type: "listItem",
      content: [typeof it === "string" ? p(it) : it],
    })),
  };
}

/** Numbered list. */
export function ol(...items: Array<string | Node>): Node {
  return {
    type: "orderedList",
    content: items.map((it) => ({
      type: "listItem",
      content: [typeof it === "string" ? p(it) : it],
    })),
  };
}

/** Bloco de citação. */
export function quote(...parts: Array<string | Node>): Node {
  return {
    type: "blockquote",
    content: parts.map((x) =>
      typeof x === "string" ? p(x) : x
    ),
  };
}

/** Bloco de código (lang opcional pra syntax highlight). */
export function code(text: string, lang?: string): Node {
  return {
    type: "codeBlock",
    attrs: lang ? { language: lang } : undefined,
    content: [{ type: "text", text }],
  };
}

/** Linha horizontal. */
export function hr(): Node {
  return { type: "horizontalRule" };
}

// ─── Inline marks ─────────────────────────────────────────────────────

/** Texto em negrito. Use dentro de `p(...)`. */
export function b(text: string): Node {
  return { type: "text", text, marks: [{ type: "bold" }] };
}

/** Texto em itálico. */
export function i(text: string): Node {
  return { type: "text", text, marks: [{ type: "italic" }] };
}

/** Texto em código inline. */
export function c(text: string): Node {
  return { type: "text", text, marks: [{ type: "code" }] };
}

/** Link. */
export function link(text: string, href: string): Node {
  return {
    type: "text",
    text,
    marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }],
  };
}

/** Sublinhado. */
export function u(text: string): Node {
  return { type: "text", text, marks: [{ type: "underline" }] };
}
