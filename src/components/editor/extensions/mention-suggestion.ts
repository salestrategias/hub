"use client";
/**
 * Config do plugin Suggestion pro Mention extension do Tiptap.
 *
 * - Busca entidades via /api/mentions/search?q=...
 * - Renderiza MentionList em popup tippy (posicionado no caret)
 * - Quando user seleciona um item, insere nó `mention` com props
 *   { id, label, targetType, targetId }
 *
 * O backend `extractMentions` / `syncMentions` pode ler `targetType` e
 * `targetId` pra popular a tabela `Mention` (backlinks).
 */
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { Editor } from "@tiptap/core";

import { MentionList, type MentionListRef, type MentionItemData } from "../ui/mention-list";

type MentionCommandProps = {
  id: string;
  label: string;
  targetType: string;
  targetId: string;
};

export const mentionSuggestion: Omit<SuggestionOptions<MentionItemData>, "editor"> = {
  char: "@",
  allowSpaces: false,
  startOfLine: false,

  items: async ({ query }: { query: string; editor: Editor }) => {
    try {
      const res = await fetch(`/api/mentions/search?q=${encodeURIComponent(query)}&limit=6`);
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data?.items)) return data.items as MentionItemData[];
      return [];
    } catch {
      return [];
    }
  },

  render: () => {
    let component: ReactRenderer<MentionListRef> | null = null;
    let popup: TippyInstance[] = [];

    return {
      onStart: (props: SuggestionProps<MentionItemData>) => {
        component = new ReactRenderer(MentionList, {
          props: {
            items: props.items,
            command: (item: MentionCommandProps) => props.command(item),
          },
          editor: props.editor,
        });

        if (!props.clientRect) return;
        popup = tippy("body", {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props: SuggestionProps<MentionItemData>) {
        component?.updateProps({
          items: props.items,
          command: (item: MentionCommandProps) => props.command(item),
        });
        if (!props.clientRect) return;
        popup[0]?.setProps({
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
        });
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          popup[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        popup[0]?.destroy();
        component?.destroy();
        component = null;
      },
    };
  },
};
