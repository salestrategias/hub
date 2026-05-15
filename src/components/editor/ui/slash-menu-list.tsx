"use client";
/**
 * Popup do slash menu (/) — lista de blocos pra inserir. Mesma mecânica
 * do MentionList: tippy popup com setas/Enter, renderizada via
 * ReactRenderer pelo plugin Suggestion do Tiptap.
 */
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, Code, Minus, Type, Table as TableIcon, Image as ImageIcon,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { Range } from "@tiptap/core";

export type SlashItem = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  searchTerms: string[];
  command: (props: { editor: Editor; range: Range }) => void;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Texto",
    description: "Parágrafo simples",
    icon: Type,
    searchTerms: ["texto", "paragrafo", "p"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("paragraph").run(),
  },
  {
    title: "Título grande",
    description: "Heading 1 (#)",
    icon: Heading1,
    searchTerms: ["titulo", "heading", "h1"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Título médio",
    description: "Heading 2 (##)",
    icon: Heading2,
    searchTerms: ["titulo", "heading", "h2", "subtitulo"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Título pequeno",
    description: "Heading 3 (###)",
    icon: Heading3,
    searchTerms: ["titulo", "heading", "h3"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Lista com bullets",
    description: "Lista não numerada (- ou *)",
    icon: List,
    searchTerms: ["lista", "bullet", "ul"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Lista numerada",
    description: "Lista 1, 2, 3...",
    icon: ListOrdered,
    searchTerms: ["lista", "numerada", "ol", "numbered"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Checklist",
    description: "Lista de tarefas com checkbox",
    icon: ListChecks,
    searchTerms: ["check", "tarefa", "todo", "checklist"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Citação",
    description: "Bloco de citação (>)",
    icon: Quote,
    searchTerms: ["citacao", "quote", "blockquote"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setBlockquote().run(),
  },
  {
    title: "Código",
    description: "Bloco de código (```)",
    icon: Code,
    searchTerms: ["codigo", "code", "monospace"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Divisor",
    description: "Linha horizontal (---)",
    icon: Minus,
    searchTerms: ["divisor", "hr", "linha", "horizontal", "separador"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Tabela",
    description: "Tabela 3x3 com header",
    icon: TableIcon,
    searchTerms: ["tabela", "table"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Imagem (URL)",
    description: "Inserir imagem por URL",
    icon: ImageIcon,
    searchTerms: ["imagem", "image", "foto", "picture"],
    command: ({ editor, range }) => {
      const url = window.prompt("URL da imagem:");
      if (!url) return;
      editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
    },
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  if (!query) return SLASH_ITEMS;
  const q = query.toLowerCase();
  return SLASH_ITEMS.filter((it) =>
    it.title.toLowerCase().includes(q) ||
    it.description.toLowerCase().includes(q) ||
    it.searchTerms.some((t) => t.includes(q))
  );
}

export type SlashListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

type Props = {
  items: SlashItem[];
  command: (item: SlashItem) => void;
};

export const SlashMenuList = forwardRef<SlashListRef, Props>(function SlashMenuList(props, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((s) => (s + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((s) => (s + 1) % props.items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = props.items[selectedIndex];
        if (item) props.command(item);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card shadow-lg px-3 py-2 text-xs text-muted-foreground">
        Nada encontrado
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card shadow-lg overflow-hidden w-[290px] max-h-[340px] overflow-y-auto">
      {props.items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = idx === selectedIndex;
        return (
          <button
            key={item.title}
            type="button"
            className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2.5 transition-colors ${
              isActive ? "bg-primary/15" : "hover:bg-muted/40"
            }`}
            onClick={() => props.command(item)}
            onMouseEnter={() => setSelectedIndex(idx)}
          >
            <div className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium leading-tight">{item.title}</div>
              <div className="text-[10.5px] text-muted-foreground truncate">{item.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
