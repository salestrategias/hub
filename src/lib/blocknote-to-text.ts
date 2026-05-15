/**
 * Converte conteúdo de editor rico em string legível.
 *
 * Aceita 3 formatos:
 *  - Tiptap JSON: `{type:"doc",content:[...]}`
 *  - BlockNote JSON legado: `[{type:"paragraph",content:"..."},...]`
 *  - Texto puro (qualquer string que não começa com `[` ou `{`)
 *
 * Usado em:
 *  - Previews curtos (Buscar, backlinks, listas)
 *  - Fallback de renderização (BlockRenderer com truncamento)
 *  - Indexação textual (busca, etc)
 *
 * Mentions inline (`{type: "mention", attrs: {label}}` no Tiptap; ou
 * `{type:"mention", props:{label}}` no BlockNote) viram `@label`.
 */
export function blocknoteToText(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed);

    // Tiptap JSON: { type: "doc", content: [...] }
    if (parsed && typeof parsed === "object" && parsed.type === "doc" && Array.isArray(parsed.content)) {
      return tiptapDocToText(parsed.content as unknown[]);
    }

    // BlockNote JSON legado: [bloco, bloco, ...]
    if (Array.isArray(parsed)) {
      const out: string[] = [];
      for (const b of parsed) {
        const txt = textoDeBlocoBlockNote(b);
        if (txt) out.push(txt);
      }
      return out.join("\n\n");
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

// ─── Tiptap ─────────────────────────────────────────────────────────

function tiptapDocToText(nodes: unknown[]): string {
  const paragrafos: string[] = [];
  for (const n of nodes) {
    const txt = textoDeNodoTiptap(n);
    if (txt) paragrafos.push(txt);
  }
  return paragrafos.join("\n\n");
}

function textoDeNodoTiptap(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: unknown; content?: unknown[]; attrs?: { label?: unknown } };

  // text node
  if (n.type === "text" && typeof n.text === "string") return n.text;

  // hardBreak
  if (n.type === "hardBreak") return "\n";

  // mention
  if (n.type === "mention" && n.attrs && typeof n.attrs.label === "string") {
    return `@${n.attrs.label}`;
  }

  // listItem / taskItem / paragraph / heading / blockquote / codeBlock — concatena filhos
  if (Array.isArray(n.content)) {
    return n.content.map((c) => textoDeNodoTiptap(c)).join("");
  }

  return "";
}

// ─── BlockNote (legado) ─────────────────────────────────────────────

function textoDeBlocoBlockNote(b: unknown): string {
  if (!b || typeof b !== "object") return "";
  const block = b as { content?: unknown };
  const c = block.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c
    .map((seg) => {
      if (typeof seg === "string") return seg;
      if (seg && typeof seg === "object") {
        const s = seg as { text?: unknown; props?: { label?: unknown } };
        if (typeof s.text === "string") return s.text;
        if (s.props && typeof s.props.label === "string") return `@${s.props.label}`;
      }
      return "";
    })
    .join("");
}
