"use client";
import { useCallback } from "react";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import { BlockEditor, type BlockContent } from "./block-editor";
import { cn } from "@/lib/utils";

type RichTextFieldProps = {
  value?: BlockContent;
  onChange?: (blocks: PartialBlock[]) => void;
  placeholder?: string;
  /** Altura mínima visual (default: 120px). */
  minHeight?: string;
  /** Modo extra compacto (sem padding, listas só), p/ inline em forms. */
  compact?: boolean;
  readOnly?: boolean;
  className?: string;
};

/**
 * Versão simplificada do BlockEditor para campos de texto rico em formulários
 * (descrição de tarefa/projeto, notas de cliente, observações de contrato).
 *
 * Diferenças do BlockEditor:
 *  - Slash menu reduzido a 7 itens essenciais (Heading 1/2, Bullet, Numbered, Check, Quote, Code)
 *  - Padding interno menor
 *  - Border + radius para parecer um input
 */
export function RichTextField({
  value,
  onChange,
  placeholder = "Digite ou pressione / para abrir o menu...",
  minHeight = "120px",
  compact = false,
  readOnly = false,
  className,
}: RichTextFieldProps) {
  const filterSlashMenu = useCallback((items: DefaultReactSuggestionItem[]) => {
    const allowed = new Set([
      "Heading 2",
      "Heading 3",
      "Bullet List",
      "Numbered List",
      "Check List",
      "Quote",
      "Code Block",
    ]);
    return items.filter((it) => allowed.has(it.title));
  }, []);

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background/40 transition-colors focus-within:border-primary/50",
        compact ? "px-2 py-1" : "px-3 py-2",
        className
      )}
    >
      <BlockEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
        readOnly={readOnly}
        filterSlashMenu={filterSlashMenu}
      />
    </div>
  );
}
