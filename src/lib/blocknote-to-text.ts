/**
 * Converte conteúdo em formato BlockNote JSON (ou texto puro) em string
 * legível. Usado nos lugares onde tínhamos BlockEditor/BlockRenderer e
 * tivemos que cair pra Textarea/<p> simples por conta de crashes
 * sistemáticos do BlockNote 0.21 (`Invalid array passed to renderSpec`).
 *
 * Heurísticas:
 *  - null/undefined/"" → ""
 *  - texto puro (não começa com `[` ou `{`) → retorna como veio
 *  - JSON array de blocos → extrai texto de cada bloco, junta com \n\n
 *  - JSON inválido → retorna texto cru (fallback seguro)
 *
 * Mentions inline (`{type: "mention", props: {label}}`) viram `@label`.
 */
export function blocknoteToText(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return trimmed;

  try {
    const blocks = JSON.parse(trimmed);
    if (!Array.isArray(blocks)) return trimmed;
    const out: string[] = [];
    for (const b of blocks) {
      const txt = textoDeBloco(b);
      if (txt) out.push(txt);
    }
    return out.join("\n\n");
  } catch {
    return trimmed;
  }
}

function textoDeBloco(b: unknown): string {
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
