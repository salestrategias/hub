"use client";
/**
 * BlockRenderer — DROP-IN PLAIN-TEXT SUBSTITUTO.
 *
 * Renderiza conteúdo (BlockNote JSON, string, ou array de blocos) como
 * texto puro com whitespace-pre-wrap, preservando quebras de linha.
 *
 * Reescrito porque o BlockNote 0.21 estava crashando em `renderSpec`
 * (vide nota em block-editor.tsx).
 *
 * Trade-off: sem formatação rica. Negrito vira texto cru, listas viram
 * texto com hifens, etc. Para uso interno temporário enquanto não
 * resolvemos o BlockNote.
 */
import type { BlockContent } from "./block-editor";
import { blocknoteToText } from "@/lib/blocknote-to-text";
import { cn } from "@/lib/utils";

type BlockRendererProps = {
  value?: BlockContent;
  /** Limita renderização aos primeiros N blocos. Aqui virou: limita aos primeiros N parágrafos. */
  maxBlocks?: number;
  /** Trunca em N caracteres totais (estimativa). */
  truncateChars?: number;
  className?: string;
};

export function BlockRenderer({ value, maxBlocks = 0, truncateChars = 0, className }: BlockRendererProps) {
  let text = blocknoteToText(asText(value));

  if (maxBlocks > 0) {
    const paragrafos = text.split(/\n\n+/);
    if (paragrafos.length > maxBlocks) {
      text = paragrafos.slice(0, maxBlocks).join("\n\n");
    }
  }

  if (truncateChars > 0 && text.length > truncateChars) {
    text = text.slice(0, truncateChars).trimEnd() + "…";
  }

  if (!text.trim()) {
    return <div className={className} data-block-renderer-empty />;
  }

  return (
    <div className={cn("whitespace-pre-wrap break-words", className)} data-block-renderer>
      {text}
    </div>
  );
}

function asText(value: BlockContent): string {
  if (!value) return "";
  if (Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return value;
}
