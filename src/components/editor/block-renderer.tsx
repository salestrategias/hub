"use client";
/**
 * BlockRenderer — renderiza conteúdo (Tiptap JSON, BlockNote JSON legado,
 * ou texto puro) como HTML estilizado, read-only.
 *
 * Usado em previews (portal do cliente, share público de propostas,
 * backlinks). Internamente usa o mesmo TiptapEditor com `readOnly`,
 * o que dá render rico (negrito, listas, headings, etc) sem barra de
 * formatação.
 */
import { TiptapEditor } from "./tiptap-editor";
import type { BlockContent } from "./block-editor";
import { blocknoteToText } from "@/lib/blocknote-to-text";
import { cn } from "@/lib/utils";

type BlockRendererProps = {
  value?: BlockContent;
  /** Limita renderização aos primeiros N parágrafos/blocos. 0 = sem limite. */
  maxBlocks?: number;
  /** Trunca em N caracteres totais (estimativa). 0 = sem limite. */
  truncateChars?: number;
  className?: string;
};

export function BlockRenderer({ value, maxBlocks = 0, truncateChars = 0, className }: BlockRendererProps) {
  const stringValue = asString(value);
  if (!stringValue.trim()) {
    return <div className={className} data-block-renderer-empty />;
  }

  // Se precisa truncar/limitar, cai pro modo texto puro (Tiptap não tem
  // limite nativo). Caso contrário usa Tiptap read-only pra render rico.
  if (maxBlocks > 0 || truncateChars > 0) {
    let text = blocknoteToText(stringValue);
    if (maxBlocks > 0) {
      const paragrafos = text.split(/\n\n+/);
      if (paragrafos.length > maxBlocks) {
        text = paragrafos.slice(0, maxBlocks).join("\n\n");
      }
    }
    if (truncateChars > 0 && text.length > truncateChars) {
      text = text.slice(0, truncateChars).trimEnd() + "…";
    }
    return (
      <div className={cn("whitespace-pre-wrap break-words", className)} data-block-renderer>
        {text}
      </div>
    );
  }

  return (
    <div className={className} data-block-renderer>
      <TiptapEditor value={stringValue} readOnly placeholder="" minHeight="0" />
    </div>
  );
}

function asString(value: BlockContent): string {
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
