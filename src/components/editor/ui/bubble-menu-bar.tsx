"use client";
/**
 * Toolbar flutuante que aparece quando o user seleciona texto.
 * Botões: B / I / U / S / Code / Highlight / Link.
 *
 * Usa o componente <BubbleMenu> do @tiptap/react, que internamente
 * posiciona via tippy.js. Aparece automaticamente em qualquer seleção
 * editável (não-vazia).
 */
import { BubbleMenu, type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Highlighter,
  Link as LinkIcon,
} from "lucide-react";

export function BubbleMenuBar({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: "top", appendTo: () => document.body }}
      shouldShow={({ editor, state }) => {
        const { from, to } = state.selection;
        if (!editor.isEditable) return false;
        if (from === to) return false;
        // Não mostra dentro de code block (já é monospaced, formatação não se aplica bem)
        if (editor.isActive("codeBlock")) return false;
        return true;
      }}
    >
      <div className="flex items-center gap-0.5 p-1 rounded-md border border-border bg-card shadow-xl">
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          icon={Bold}
          title="Negrito (Ctrl+B)"
        />
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          icon={Italic}
          title="Itálico (Ctrl+I)"
        />
        <Btn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          icon={UnderlineIcon}
          title="Sublinhado (Ctrl+U)"
        />
        <Btn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          icon={Strikethrough}
          title="Riscado"
        />
        <Btn
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          icon={Code}
          title="Código inline"
        />
        <Btn
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")}
          icon={Highlighter}
          title="Destacar"
        />
        <span className="w-px h-5 bg-border mx-0.5" />
        <Btn
          onClick={() => promptLink(editor)}
          active={editor.isActive("link")}
          icon={LinkIcon}
          title="Link"
        />
      </div>
    </BubbleMenu>
  );
}

function Btn({
  onClick,
  active,
  icon: Icon,
  title,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-7 w-7 rounded flex items-center justify-center transition-colors ${
        active ? "bg-primary/20 text-primary" : "hover:bg-muted/60 text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function promptLink(editor: Editor) {
  const previousUrl = editor.getAttributes("link").href;
  const url = window.prompt("URL do link:", typeof previousUrl === "string" ? previousUrl : "https://");
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}
