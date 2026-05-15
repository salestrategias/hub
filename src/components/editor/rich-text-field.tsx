"use client";
/**
 * RichTextField — DROP-IN TEXTAREA SUBSTITUTO.
 *
 * Era um wrapper simplificado do BlockEditor pra formulários. Como o
 * BlockEditor virou Textarea (vide nota lá), aqui também — mantemos a
 * API idêntica pra não quebrar nenhum call site.
 */
import type { PartialBlock } from "@blocknote/core";
import { blocknoteToText } from "@/lib/blocknote-to-text";
import type { BlockContent } from "./block-editor";
import { cn } from "@/lib/utils";

type RichTextFieldProps = {
  value?: BlockContent;
  onChange?: (blocks: PartialBlock[]) => void;
  placeholder?: string;
  /** Altura mínima visual. Default: 120px. */
  minHeight?: string;
  /** Modo compacto. */
  compact?: boolean;
  readOnly?: boolean;
  className?: string;
};

export function RichTextField({
  value,
  onChange,
  placeholder = "Digite o texto...",
  minHeight = "120px",
  compact = false,
  readOnly = false,
  className,
}: RichTextFieldProps) {
  const initialText = blocknoteToText(asText(value));

  return (
    <textarea
      defaultValue={initialText}
      readOnly={readOnly}
      placeholder={placeholder}
      style={{ minHeight }}
      className={cn(
        "w-full rounded-md border border-border bg-background/40 text-sm leading-relaxed transition-colors",
        "placeholder:text-muted-foreground/60",
        "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50",
        "resize-y font-sans",
        compact ? "px-2 py-1.5" : "px-3 py-2",
        readOnly && "opacity-80 cursor-default",
        className
      )}
      onChange={(e) => {
        if (!onChange) return;
        const text = e.target.value;
        onChange([{ type: "paragraph", content: text } as PartialBlock]);
      }}
    />
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
