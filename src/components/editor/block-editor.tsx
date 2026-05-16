"use client";
/**
 * BlockEditor — wrapper Tiptap mantendo a API legada do BlockNote.
 *
 * Por que existe: ~22 call sites importam `BlockEditor` e fazem
 * `onChange={(blocks) => JSON.stringify(blocks)}`. Em vez de refatorar
 * todos, este wrapper recebe o JSON do Tiptap via onChange e repassa
 * pros call sites — eles continuam fazendo JSON.stringify e tudo
 * funciona (só que agora persistido como Tiptap JSON em vez de
 * BlockNote JSON).
 *
 * Conteúdo legado em BlockNote JSON (legendas antigas, notas, etc) é
 * convertido pra texto plano no carregamento — preserva o texto mas
 * perde formatação rica do registro antigo. Novos saves usam Tiptap
 * nativo com toda a formatação preservada.
 */
import { TiptapEditor } from "./tiptap-editor";
import type { EditorBlock } from "./types";

export type BlockContent = EditorBlock[] | string | null | undefined;

type BlockEditorProps = {
  value?: BlockContent;
  onChange?: (blocks: EditorBlock[]) => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: string;
  /** Ignorado — antiga API do BlockNote, mantido por retrocompatibilidade. */
  filterSlashMenu?: (items: unknown[]) => unknown[];
  className?: string;
};

export function BlockEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "Comece a escrever...",
  minHeight = "200px",
  className,
}: BlockEditorProps) {
  return (
    <TiptapEditor
      value={asString(value)}
      onChange={(json) => {
        // Passa o JSON do Tiptap mascarado como EditorBlock[] pros call
        // sites — eles fazem JSON.stringify e salvam. O JSON real é o
        // doc do Tiptap (`{type:"doc", content:[...]}`), serializado como
        // string no DB.
        onChange?.(json as unknown as EditorBlock[]);
      }}
      readOnly={readOnly}
      placeholder={placeholder}
      minHeight={minHeight}
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
