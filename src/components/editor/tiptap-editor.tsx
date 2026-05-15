"use client";
/**
 * Editor rico baseado em Tiptap (ProseMirror).
 *
 * Substitui o BlockNote 0.21 que estava crashando consistentemente com
 * `Invalid array passed to renderSpec` em `createNodeViews` async.
 *
 * Recursos Notion-like:
 *  - Headings H1/H2/H3, parágrafo
 *  - Negrito, itálico, código inline, riscado
 *  - Listas bullet/numerada/checklist
 *  - Citação, código em bloco, divisor
 *  - Links clicáveis
 *  - Atalhos Markdown: `#`/`##`/`###` viram headings, `* `/`- ` viram
 *    bullet list, `1. ` numbered, `> ` quote, `**bold**`, `*italic*`,
 *    `\`code\``, `---` divisor
 *  - Typography (aspas curvas, ndash/mdash, …)
 *  - Placeholder
 *
 * Persistência: editor.getJSON() retorna `{type:"doc",content:[...]}`.
 * Os call sites JSON.stringify pra salvar no DB (campo Text).
 *
 * Compatibilidade com conteúdo legado:
 *  - BlockNote JSON (array começando com `[`) → convertido pra texto
 *    plano via blocknoteToText, depois carregado como parágrafos
 *  - Texto puro → carregado como parágrafos (quebras duplas de linha
 *    geram novos parágrafos)
 *  - Tiptap JSON (`{type:"doc",...}`) → carregado direto
 */
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import type { JSONContent } from "@tiptap/react";

import { blocknoteToText } from "@/lib/blocknote-to-text";
import { cn } from "@/lib/utils";

export type TiptapEditorProps = {
  /** Valor inicial. Aceita: Tiptap JSON, BlockNote JSON (legado), ou texto puro. */
  value?: string | null;
  /** Disparado on-change. Recebe o JSON do Tiptap (pra serializar e salvar). */
  onChange?: (json: JSONContent) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** Altura mínima do editor. Default 180px. */
  minHeight?: string;
  /** Container compacto (menos padding). */
  compact?: boolean;
  className?: string;
};

export function TiptapEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "Comece a escrever, ou use atalhos: # H1, ## H2, * lista, > citação...",
  minHeight = "180px",
  compact = false,
  className,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "rounded bg-muted/60 p-2 text-[12px] font-mono" } },
        blockquote: { HTMLAttributes: { class: "border-l-2 border-primary/40 pl-3 italic text-muted-foreground" } },
        bulletList: { HTMLAttributes: { class: "list-disc pl-5 space-y-0.5" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-5 space-y-0.5" } },
        code: { HTMLAttributes: { class: "rounded bg-muted/60 px-1 py-0.5 text-[0.92em] font-mono" } },
        horizontalRule: { HTMLAttributes: { class: "my-3 border-border" } },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { class: "text-primary underline underline-offset-2 cursor-pointer" },
      }),
      TaskList.configure({ HTMLAttributes: { class: "pl-1 space-y-1" } }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "flex items-start gap-2" },
      }),
      Typography,
    ],
    content: parseInitialContent(value),
    editable: !readOnly,
    immediatelyRender: false, // evita hydration mismatch no Next.js
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert prose-sm max-w-none focus:outline-none",
          "[&_p]:my-1 [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:mt-2 [&_h3]:mb-1",
          "[&_ul]:my-1 [&_ol]:my-1 [&_blockquote]:my-2",
          compact ? "px-2 py-1.5" : "px-3 py-2"
        ),
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate({ editor }) {
      onChange?.(editor.getJSON());
    },
  });

  // Re-aplica content se value mudou externamente (ex: trocar de post).
  // Só faz isso se o editor está vazio ou se o valor é claramente diferente —
  // evita perder cursor do user enquanto digita.
  useEffect(() => {
    if (!editor) return;
    const incoming = parseInitialContent(value);
    const current = editor.getJSON();
    // Heurística: só substitui se um lado está vazio ou estrutura difere muito
    if (deepEqualishContent(current, incoming)) return;
    // Se editor tem foco, evita interromper digitação
    if (editor.isFocused) return;
    editor.commands.setContent(incoming, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background/40 transition-colors",
        "focus-within:border-primary/50 focus-within:bg-background/60",
        className
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Converte um valor (string ou null) em conteúdo Tiptap inicial.
 * Lida com 3 formatos: Tiptap JSON, BlockNote JSON (legado), texto puro.
 */
function parseInitialContent(value: string | null | undefined): JSONContent | string {
  if (!value) return { type: "doc", content: [{ type: "paragraph" }] };
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return { type: "doc", content: [{ type: "paragraph" }] };

  // Tiptap JSON?
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && parsed.type === "doc") {
        return parsed as JSONContent;
      }
    } catch {
      // cai pra texto plano
    }
  }

  // BlockNote JSON legado (array)?
  if (trimmed.startsWith("[")) {
    const text = blocknoteToText(trimmed);
    return paragrafosDeTexto(text);
  }

  // Texto puro
  return paragrafosDeTexto(trimmed);
}

/** Quebra texto em parágrafos por \n\n+ e gera um doc Tiptap. */
function paragrafosDeTexto(text: string): JSONContent {
  const blocos = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (blocos.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return {
    type: "doc",
    content: blocos.map((p) => ({
      type: "paragraph",
      // Mantém quebras de linha simples dentro do parágrafo como hard breaks
      content: linhasComoTextoEHardBreak(p),
    })),
  };
}

function linhasComoTextoEHardBreak(paragrafo: string): JSONContent[] {
  const linhas = paragrafo.split("\n");
  const out: JSONContent[] = [];
  linhas.forEach((linha, i) => {
    if (linha) out.push({ type: "text", text: linha });
    if (i < linhas.length - 1) out.push({ type: "hardBreak" });
  });
  return out.length > 0 ? out : [{ type: "text", text: paragrafo }];
}

/** Compara grosseiramente dois JSONContent — não é deep equal, só heurística. */
function deepEqualishContent(a: JSONContent | string, b: JSONContent | string): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
