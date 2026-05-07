"use client";
import { useMemo } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultInlineContentSpecs, type PartialBlock } from "@blocknote/core";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./block-editor-theme.css";

import { textToBlocks } from "./text-to-blocks";
import { mentionInlineSpec } from "./mention-spec";
import type { BlockContent } from "./block-editor";

const rendererSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: mentionInlineSpec,
  },
});

type BlockRendererProps = {
  /** Conteúdo (mesmos formatos aceitos pelo BlockEditor). */
  value?: BlockContent;
  /** Limita renderização aos primeiros N blocos (preview em card). 0 = sem limite. */
  maxBlocks?: number;
  /** Trunca em N caracteres totais aproximados (estimativa, não exato). */
  truncateChars?: number;
  className?: string;
};

/**
 * Renderiza blocos do BlockNote em modo read-only — para preview em card,
 * notificações, links de backlink, etc. Não mostra drag handle, slash menu,
 * toolbar de formatação. Mantém estilos de tipografia + render de mentions.
 *
 * Observação: BlockNote precisa de uma instância de editor mesmo em read-only,
 * mas custos são baixos pois pulamos slashMenu/sideMenu.
 */
export function BlockRenderer({ value, maxBlocks = 0, truncateChars = 0, className }: BlockRendererProps) {
  const blocks = useMemo(() => parseAndTrim(value, maxBlocks, truncateChars), [value, maxBlocks, truncateChars]);

  const editor = useCreateBlockNote({
    schema: rendererSchema,
    initialContent: blocks.length > 0 ? (blocks as PartialBlock[]) : undefined,
  });

  if (blocks.length === 0) {
    return <div className={className} data-block-renderer-empty />;
  }

  return (
    <div className={className} data-block-editor data-block-renderer>
      <BlockNoteView
        editor={editor}
        editable={false}
        slashMenu={false}
        sideMenu={false}
        formattingToolbar={false}
        linkToolbar={false}
        filePanel={false}
        tableHandles={false}
        theme="dark"
      />
    </div>
  );
}

function parseAndTrim(value: BlockContent, maxBlocks: number, truncateChars: number): PartialBlock[] {
  if (!value) return [];
  let blocks: PartialBlock[];
  if (Array.isArray(value)) {
    blocks = value;
  } else {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        blocks = Array.isArray(parsed) ? (parsed as PartialBlock[]) : textToBlocks(trimmed);
      } catch {
        blocks = textToBlocks(trimmed);
      }
    } else {
      blocks = textToBlocks(trimmed);
    }
  }

  if (maxBlocks > 0 && blocks.length > maxBlocks) {
    blocks = blocks.slice(0, maxBlocks);
  }

  if (truncateChars > 0) {
    let total = 0;
    const out: PartialBlock[] = [];
    for (const b of blocks) {
      const len = approxLen(b);
      if (total + len > truncateChars) {
        out.push(b);
        break;
      }
      out.push(b);
      total += len;
    }
    blocks = out;
  }

  return blocks;
}

function approxLen(block: PartialBlock): number {
  const c = (block as { content?: unknown }).content;
  if (typeof c === "string") return c.length;
  if (Array.isArray(c)) {
    return c.reduce((acc: number, seg) => {
      if (typeof seg === "string") return acc + seg.length;
      const t = (seg as { text?: string }).text;
      return acc + (typeof t === "string" ? t.length : 0);
    }, 0);
  }
  return 0;
}
