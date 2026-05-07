import type { PartialBlock } from "@blocknote/core";

/**
 * Converte texto legado (plain text ou markdown leve) em blocos do BlockNote.
 *
 * Heurísticas:
 *  - Linhas começando com `# `, `## `, `### ` → heading 1/2/3
 *  - `> ` → quote
 *  - `- ` ou `* ` → bullet list
 *  - `1. ` (qualquer dígito) → numbered list
 *  - `[ ] ` / `[x] ` → check list (marcado se `[x]`)
 *  - Linhas vazias → quebra de parágrafo
 *  - Cercas ``` ``` → code block (preserva linguagem se informada após a cerca)
 *  - Texto puro → paragraph
 *
 * Não tenta cobrir 100% de markdown — é só pra migração suave de campos legados
 * (ex: `Tarefa.descricao` que hoje é string crua). Para markdown complexo, persistir
 * em JSON do próprio BlockNote.
 */
export function textToBlocks(input: string): PartialBlock[] {
  if (!input) return [];

  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: PartialBlock[] = [];

  let inCodeFence = false;
  let codeBuffer: string[] = [];
  let codeLang: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw ?? "";

    // ── Code fence ──────────────────────────────────────────────
    const fenceMatch = line.match(/^```\s*([a-zA-Z0-9_+-]*)\s*$/);
    if (fenceMatch) {
      if (inCodeFence) {
        // Fecha bloco
        blocks.push({
          type: "codeBlock",
          props: codeLang ? { language: codeLang } : undefined,
          content: codeBuffer.join("\n"),
        } as PartialBlock);
        inCodeFence = false;
        codeBuffer = [];
        codeLang = undefined;
      } else {
        // Abre bloco
        inCodeFence = true;
        codeLang = fenceMatch[1] || undefined;
      }
      continue;
    }
    if (inCodeFence) {
      codeBuffer.push(line);
      continue;
    }

    // ── Linha vazia: pula (BlockNote já trata espaçamento entre blocos) ──
    if (line.trim() === "") continue;

    // ── Headings ────────────────────────────────────────────────
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      blocks.push(headingBlock(1, h1[1]));
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      blocks.push(headingBlock(2, h2[1]));
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      blocks.push(headingBlock(3, h3[1]));
      continue;
    }

    // ── Quote ───────────────────────────────────────────────────
    const quote = line.match(/^>\s*(.*)$/);
    if (quote) {
      blocks.push({
        type: "paragraph",
        // BlockNote padrão não tem bloco "quote" próprio — usa paragraph + estilo CSS
        // (ver block-editor-theme.css que estiliza blockquote). Mantemos simples.
        content: inlineContent(quote[1]),
      } as PartialBlock);
      continue;
    }

    // ── Check list ──────────────────────────────────────────────
    const check = line.match(/^\s*\[([ xX])\]\s+(.+)$/);
    if (check) {
      blocks.push({
        type: "checkListItem",
        props: { checked: check[1].toLowerCase() === "x" },
        content: inlineContent(check[2]),
      } as PartialBlock);
      continue;
    }

    // ── Bullet list ─────────────────────────────────────────────
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      blocks.push({
        type: "bulletListItem",
        content: inlineContent(bullet[1]),
      } as PartialBlock);
      continue;
    }

    // ── Numbered list ───────────────────────────────────────────
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numbered) {
      blocks.push({
        type: "numberedListItem",
        content: inlineContent(numbered[1]),
      } as PartialBlock);
      continue;
    }

    // ── Paragraph (default) ─────────────────────────────────────
    blocks.push({
      type: "paragraph",
      content: inlineContent(line),
    } as PartialBlock);
  }

  // Se ficou um code fence aberto (markdown malformado), fecha o que tiver
  if (inCodeFence && codeBuffer.length > 0) {
    blocks.push({
      type: "codeBlock",
      props: codeLang ? { language: codeLang } : undefined,
      content: codeBuffer.join("\n"),
    } as PartialBlock);
  }

  return blocks;
}

function headingBlock(level: 1 | 2 | 3, text: string): PartialBlock {
  return {
    type: "heading",
    props: { level },
    content: inlineContent(text),
  } as PartialBlock;
}

/**
 * Parser de inline marks bem leve: **bold**, *italic*, `code`, [link](url).
 * Não cobre nesting complexo — pra texto agency-grade simples basta.
 */
function inlineContent(text: string): PartialBlock["content"] {
  const segments: Array<{ text: string; styles?: Record<string, boolean>; href?: string }> = [];
  let rest = text;

  // Regex global capturando o primeiro mark em cada iteração
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/;

  while (rest.length > 0) {
    const m = rest.match(pattern);
    if (!m) {
      segments.push({ text: rest });
      break;
    }
    const idx = m.index ?? 0;
    if (idx > 0) {
      segments.push({ text: rest.slice(0, idx) });
    }
    if (m[1]) {
      // **bold**
      segments.push({ text: m[2], styles: { bold: true } });
    } else if (m[3]) {
      // *italic*
      segments.push({ text: m[4], styles: { italic: true } });
    } else if (m[5]) {
      // `code`
      segments.push({ text: m[6], styles: { code: true } });
    } else if (m[7]) {
      // [link](url)
      segments.push({ text: m[8], href: m[9] });
    }
    rest = rest.slice(idx + m[0].length);
  }

  // BlockNote aceita string ou array de InlineContent[].
  // Se temos só um segmento sem styling, devolve string direto.
  if (segments.length === 1 && !segments[0].styles && !segments[0].href) {
    return segments[0].text as unknown as PartialBlock["content"];
  }

  // Mapeia para o formato esperado: links viram { type: "link", content: [...], href }
  return segments.map((seg) => {
    if (seg.href) {
      return {
        type: "link",
        href: seg.href,
        content: [{ type: "text", text: seg.text, styles: {} }],
      };
    }
    return {
      type: "text",
      text: seg.text,
      styles: seg.styles ?? {},
    };
  }) as unknown as PartialBlock["content"];
}
