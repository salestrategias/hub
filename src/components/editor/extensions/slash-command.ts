"use client";
/**
 * Extension do Tiptap que dispara o slash menu (/) pra inserir blocos.
 *
 * Usa o plugin Suggestion (do mesmo Tiptap) que entrega caret position
 * e gerencia o popup tippy via ReactRenderer.
 *
 * Comandos disponíveis estão em ../ui/slash-menu-list.ts (SLASH_ITEMS).
 */
import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";

import {
  SlashMenuList,
  type SlashListRef,
  type SlashItem,
  filterSlashItems,
} from "../ui/slash-menu-list";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        allowSpaces: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => filterSlashItems(query),
        render: () => {
          let component: ReactRenderer<SlashListRef> | null = null;
          let popup: TippyInstance[] = [];

          return {
            onStart: (props: SuggestionProps<SlashItem>) => {
              component = new ReactRenderer(SlashMenuList, {
                props: {
                  items: props.items,
                  command: (item: SlashItem) => props.command(item),
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

            onUpdate(props: SuggestionProps<SlashItem>) {
              component?.updateProps({
                items: props.items,
                command: (item: SlashItem) => props.command(item),
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
      }),
    ];
  },
});
