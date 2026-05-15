"use client";
/**
 * BlockEditor — DROP-IN TEXTAREA SUBSTITUTO.
 *
 * Mantém a API original (props value, onChange, placeholder, minHeight,
 * readOnly, className) mas internamente é um <textarea>. Foi reescrito
 * porque o BlockNote 0.21 + ProseMirror estavam crashando sistematicamente
 * com `RangeError: Invalid array passed to renderSpec` dentro de
 * `createNodeViews` async — fora do lifecycle React, ErrorBoundary não
 * pegava. Isso quebrava editor em posts, notas, reuniões, propostas,
 * conteúdo SAL etc.
 *
 * **Como funciona:**
 *  - Recebe `value` em qualquer formato (string, JSON BlockNote, array
 *    de blocos) — converte pra texto plano via `blocknoteToText` antes
 *    de mostrar.
 *  - Quando user digita, chama `onChange` com array fake `[{type:
 *    "paragraph", content: <texto>}]`. Call sites que faziam
 *    `JSON.stringify(blocks)` continuam funcionando — salvam JSON
 *    BlockNote válido com um único parágrafo.
 *  - Round-trip: salva como `'[{"type":"paragraph","content":"..."}]'`,
 *    carrega de volta via blocknoteToText → string original.
 *
 * Trade-off temporário: sem formatação rica (negrito, listas, headings,
 * menções @ clicáveis). Pra recuperar isso, precisamos investigar o
 * BlockNote (provavelmente downgrade pra 0.20.x ou migração pra Tiptap
 * puro). Por enquanto: texto puro funciona end-to-end e cliente vê copy.
 *
 * `filterSlashMenu` é ignorado (sem slash menu agora).
 */
import type { PartialBlock } from "@blocknote/core";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { blocknoteToText } from "@/lib/blocknote-to-text";
import { cn } from "@/lib/utils";

export type BlockContent = PartialBlock[] | string | null | undefined;

type BlockEditorProps = {
  /** Conteúdo inicial. Aceita JSON serializado (string), array de blocos, ou texto puro. */
  value?: BlockContent;
  /** Disparado on-change. Recebe blocks fake `[{type:"paragraph", content: text}]`. */
  onChange?: (blocks: PartialBlock[]) => void;
  /** Modo somente leitura. */
  readOnly?: boolean;
  /** Placeholder. */
  placeholder?: string;
  /** Altura mínima do textarea (CSS válido). Default: 200px. */
  minHeight?: string;
  /** Ignorado nesta implementação Textarea. */
  filterSlashMenu?: (items: DefaultReactSuggestionItem[]) => DefaultReactSuggestionItem[];
  className?: string;
};

export function BlockEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "Digite o texto aqui...",
  minHeight = "200px",
  className,
}: BlockEditorProps) {
  const initialText = blocknoteToText(asText(value));

  return (
    <textarea
      defaultValue={initialText}
      readOnly={readOnly}
      placeholder={placeholder}
      style={{ minHeight }}
      className={cn(
        "w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm leading-relaxed",
        "placeholder:text-muted-foreground/60",
        "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40",
        "resize-y font-sans",
        readOnly && "opacity-80 cursor-default",
        className
      )}
      onChange={(e) => {
        if (!onChange) return;
        const text = e.target.value;
        // Emitir blocks no shape BlockNote esperado pelos call sites.
        // Um único parágrafo com o texto inteiro — preserva quebras de
        // linha (que serão \n no string final ao serializar).
        onChange([{ type: "paragraph", content: text } as PartialBlock]);
      }}
    />
  );
}

/**
 * Converte BlockContent em string pra passar pra blocknoteToText.
 * (Caller pode mandar array direto, não só JSON.)
 */
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
