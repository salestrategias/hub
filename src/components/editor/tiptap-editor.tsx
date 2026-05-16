"use client";
/**
 * Editor rico Notion-like baseado em Tiptap (ProseMirror).
 *
 * Recursos:
 *  - StarterKit: parágrafo, headings H1-H3, bold/italic/strike/code,
 *    listas bullet/numerada, blockquote, codeBlock, horizontalRule
 *  - Underline (Ctrl+U), Highlight, Link clicável
 *  - Task list / checklist
 *  - Imagens (cole ou arraste arquivo — vira dataURL inline)
 *  - Tabelas (3x3 via slash menu, resizable)
 *  - Typography (aspas curvas, em-dash, ellipsis, etc)
 *  - Mention `@` com busca por entidades (cliente/post/projeto/etc)
 *  - Slash menu `/` com paleta de blocos
 *  - BubbleMenu (toolbar flutuante em texto selecionado)
 *  - Placeholder
 *
 * Persistência: editor.getJSON() retorna `{type:"doc",content:[...]}`.
 * Call sites JSON.stringify pra salvar no DB. Conteúdo legado em
 * BlockNote JSON é convertido pra texto plano no carregamento.
 */
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Mention from "@tiptap/extension-mention";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import AutoJoiner from "tiptap-extension-auto-joiner";
import type { JSONContent } from "@tiptap/react";

import "tippy.js/dist/tippy.css";

import { blocknoteToText } from "@/lib/blocknote-to-text";
import { cn } from "@/lib/utils";
import { SlashCommand } from "./extensions/slash-command";
import { mentionSuggestion } from "./extensions/mention-suggestion";
import { BubbleMenuBar } from "./ui/bubble-menu-bar";

export type TiptapEditorProps = {
  /** Valor inicial. Aceita Tiptap JSON, BlockNote JSON legado, ou texto puro. */
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
  placeholder = "Digite '/' pra abrir o menu de blocos, ou comece a escrever...",
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
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return `Heading ${node.attrs.level}`;
          return placeholder;
        },
        showOnlyWhenEditable: true,
        emptyEditorClass: "is-editor-empty",
        emptyNodeClass: "is-empty",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { class: "text-primary underline underline-offset-2 cursor-pointer", rel: "noopener noreferrer" },
      }),
      TaskList.configure({ HTMLAttributes: { class: "pl-1 space-y-1 list-none" } }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "flex items-start gap-2" },
      }),
      Typography,
      Underline,
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: { class: "bg-yellow-400/30 rounded px-0.5" },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: "rounded my-2 max-w-full" },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "border-collapse w-full my-2" },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: { class: "border border-border bg-muted/40 px-2 py-1 text-left font-semibold" },
      }),
      TableCell.configure({
        HTMLAttributes: { class: "border border-border px-2 py-1" },
      }),
      Mention.extend({
        // Estende attrs pra preservar targetType/targetId (backlinks).
        addAttributes() {
          return {
            // Defaults do Mention (id, label) com lookup via data-id/data-label
            id: {
              default: null,
              parseHTML: (el) => el.getAttribute("data-id"),
              renderHTML: (attrs) => (attrs.id ? { "data-id": String(attrs.id) } : {}),
            },
            label: {
              default: null,
              parseHTML: (el) => el.getAttribute("data-label"),
              renderHTML: (attrs) => (attrs.label ? { "data-label": String(attrs.label) } : {}),
            },
            targetType: {
              default: null,
              parseHTML: (el) => el.getAttribute("data-mention-target-type"),
              renderHTML: (attrs) =>
                attrs.targetType ? { "data-mention-target-type": String(attrs.targetType) } : {},
            },
            targetId: {
              default: null,
              parseHTML: (el) => el.getAttribute("data-mention-target-id"),
              renderHTML: (attrs) =>
                attrs.targetId ? { "data-mention-target-id": String(attrs.targetId) } : {},
            },
          };
        },
      }).configure({
        HTMLAttributes: { class: "mention-pill" },
        renderText({ node }) {
          return `@${node.attrs.label ?? node.attrs.id ?? ""}`;
        },
        suggestion: mentionSuggestion,
      }),
      SlashCommand,
      // Drag handle — alça "⋮⋮" aparece à esquerda do bloco em hover.
      // Permite arrastar blocos pra reordenar (igual Notion).
      GlobalDragHandle.configure({
        dragHandleWidth: 22,
        scrollTreshold: 100,
        excludedTags: [],
        customNodes: [],
      }),
      // Auto-junta listas consecutivas após drag (sem isso, dois <ul>
      // separados ficariam como dois blocos)
      AutoJoiner,
    ],
    content: parseInitialContent(value),
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "tiptap-editor prose prose-invert prose-sm max-w-none focus:outline-none",
          "[&_p]:my-1 [&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-2xl [&_h1]:font-bold",
          "[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-xl [&_h2]:font-semibold",
          "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-lg [&_h3]:font-semibold",
          "[&_ul]:my-1 [&_ol]:my-1 [&_blockquote]:my-2",
          "[&_table]:my-2 [&_td]:align-top [&_th]:align-top",
          compact ? "px-2 py-1.5" : "px-3 py-2.5"
        ),
        style: `min-height: ${minHeight}`,
      },
      handlePaste(view, event) {
        const file = event.clipboardData?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return false;
        if (file.size > 3_000_000) {
          alert("Imagem grande demais (max 3MB). Cole URL ou hospede em outro lugar.");
          return true;
        }
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result);
          const node = view.state.schema.nodes.image?.create({ src: url });
          if (!node) return;
          const tr = view.state.tr.replaceSelectionWith(node);
          view.dispatch(tr);
        };
        reader.readAsDataURL(file);
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return false;
        if (file.size > 3_000_000) {
          alert("Imagem grande demais (max 3MB).");
          return true;
        }
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result);
          const node = view.state.schema.nodes.image?.create({ src: url });
          if (!node) return;
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const pos = coords?.pos ?? view.state.selection.from;
          const tr = view.state.tr.insert(pos, node);
          view.dispatch(tr);
        };
        reader.readAsDataURL(file);
        return true;
      },
    },
    onUpdate({ editor }) {
      onChange?.(editor.getJSON());
    },
  });

  // Re-aplica content se value mudou externamente (ex: trocar de post).
  useEffect(() => {
    if (!editor) return;
    const incoming = parseInitialContent(value);
    const current = editor.getJSON();
    if (deepEqualishContent(current, incoming)) return;
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
      {editor && !readOnly && <BubbleMenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function parseInitialContent(value: string | null | undefined): JSONContent {
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

  return paragrafosDeTexto(trimmed);
}

function paragrafosDeTexto(text: string): JSONContent {
  const blocos = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (blocos.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };
  return {
    type: "doc",
    content: blocos.map((p) => ({
      type: "paragraph",
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

function deepEqualishContent(a: JSONContent | string, b: JSONContent | string): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
