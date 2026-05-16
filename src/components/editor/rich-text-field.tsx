"use client";
/**
 * RichTextField — wrapper compacto do TiptapEditor pra forms.
 *
 * Mesma API legada do BlockNote. Aceita value (qualquer formato),
 * onChange recebe Tiptap JSON tipado como EditorBlock[] pra preservar
 * call sites existentes.
 */
import { TiptapEditor } from "./tiptap-editor";
import type { BlockContent } from "./block-editor";
import type { EditorBlock } from "./types";

type RichTextFieldProps = {
  value?: BlockContent;
  onChange?: (blocks: EditorBlock[]) => void;
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
  return (
    <TiptapEditor
      value={asString(value)}
      onChange={(json) => onChange?.(json as unknown as EditorBlock[])}
      readOnly={readOnly}
      placeholder={placeholder}
      minHeight={minHeight}
      compact={compact}
      className={className}
    />
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
