"use client";
/**
 * UI da lista de menções @. Renderizada via tippy.js dentro do popup
 * de sugestão do Tiptap. Recebe items (entidades buscadas via API) +
 * `command` (callback pra inserir o mention selecionado).
 */
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Users, Mic, FileText, FolderKanban, ListChecks, FileSignature, StickyNote } from "lucide-react";

export type MentionItemData = {
  id: string;
  type: "CLIENTE" | "REUNIAO" | "POST" | "PROJETO" | "TAREFA" | "CONTRATO" | "NOTA";
  label: string;
  subtitle?: string;
};

export type MentionListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

type Props = {
  items: MentionItemData[];
  command: (item: { id: string; label: string; targetType: string; targetId: string }) => void;
};

export const MentionList = forwardRef<MentionListRef, Props>(function MentionList(props, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (!item) return;
    props.command({
      id: `${item.type}:${item.id}`,
      label: item.label,
      targetType: item.type,
      targetId: item.id,
    });
  };

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
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card shadow-lg px-3 py-2 text-xs text-muted-foreground">
        Nenhum resultado
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card shadow-lg overflow-hidden w-[260px] max-h-[280px] overflow-y-auto">
      {props.items.map((item, idx) => {
        const Icon = iconFor(item.type);
        const isActive = idx === selectedIndex;
        return (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs transition-colors ${
              isActive ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/40"
            }`}
            onClick={() => selectItem(idx)}
            onMouseEnter={() => setSelectedIndex(idx)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate font-medium">{item.label}</span>
            {item.subtitle && (
              <span className="text-[10px] text-muted-foreground/60 truncate max-w-[80px]">
                {item.subtitle}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

function iconFor(t: MentionItemData["type"]) {
  switch (t) {
    case "CLIENTE": return Users;
    case "REUNIAO": return Mic;
    case "POST": return FileText;
    case "PROJETO": return FolderKanban;
    case "TAREFA": return ListChecks;
    case "CONTRATO": return FileSignature;
    case "NOTA": return StickyNote;
    default: return FileText;
  }
}
