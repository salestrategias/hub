"use client";
import { useCallback, useMemo } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import {
  BlockNoteSchema,
  defaultInlineContentSpecs,
  filterSuggestionItems,
  type PartialBlock,
} from "@blocknote/core";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./block-editor-theme.css";

import { textToBlocks } from "./text-to-blocks";
import { mentionInlineSpec } from "./mention-spec";
import type { MentionSearchItem } from "@/app/api/mentions/search/route";

/**
 * Schema customizado: estende defaults + registra inline content `mention`.
 * Tipagens fluem corretamente via `BlockNoteSchema.create({...})`.
 */
const editorSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: mentionInlineSpec,
  },
});

type CustomBlockNoteEditor = ReturnType<typeof editorSchema.BlockNoteEditor.create>;

export type BlockContent = PartialBlock[] | string | null | undefined;

type BlockEditorProps = {
  /** Conteúdo inicial. Aceita JSON serializado (string), array de blocos, ou texto puro legado. */
  value?: BlockContent;
  /** Disparado on-change. Recebe array de blocos serializável (use JSON.stringify para persistir). */
  onChange?: (blocks: PartialBlock[]) => void;
  /** Modo somente leitura (ex: visualização de nota arquivada). */
  readOnly?: boolean;
  /** Placeholder do primeiro bloco. */
  placeholder?: string;
  /** Altura mínima do editor (CSS válido). Default: 200px. */
  minHeight?: string;
  /** Callback opcional para limitar/customizar slash menu items. */
  filterSlashMenu?: (items: DefaultReactSuggestionItem[]) => DefaultReactSuggestionItem[];
  className?: string;
};

/**
 * Editor de blocos universal estilo Notion (BlockNote).
 *
 * - Slash menu (`/`) abre paleta de blocos.
 * - Mentions (`@`) abre busca de entidades (cliente/reuniao/post/etc).
 * - Drag handle aparece à esquerda em hover de cada bloco.
 * - Tema custom em `block-editor-theme.css` aplica paleta SAL no dark mode.
 * - Persistência: serialize via `JSON.stringify(blocks)`. Carregue passando o JSON como `value`.
 *
 * @example
 * <BlockEditor
 *   value={nota.conteudo}
 *   onChange={(blocks) => save(JSON.stringify(blocks))}
 *   placeholder="Comece escrevendo ou digite / para opções..."
 * />
 */
export function BlockEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "Digite / para abrir o menu de blocos...",
  minHeight = "200px",
  filterSlashMenu,
  className,
}: BlockEditorProps) {
  const initialContent = useMemo<PartialBlock[] | undefined>(() => parseValue(value), [value]);

  const editor: CustomBlockNoteEditor = useCreateBlockNote({
    schema: editorSchema,
    initialContent: initialContent && initialContent.length > 0 ? (initialContent as PartialBlock[]) : undefined,
  });

  const handleChange = useCallback(() => {
    if (onChange) onChange(editor.document as PartialBlock[]);
  }, [editor, onChange]);

  // Slash menu enxuto — só os blocos que fazem sentido pra agência
  const slashMenuItems = useCallback(
    (query: string): DefaultReactSuggestionItem[] => {
      const allowed = new Set([
        "Heading 1", "Heading 2", "Heading 3",
        "Bullet List", "Numbered List", "Check List",
        "Paragraph", "Quote", "Code Block",
        "Image", "Video", "Audio", "File",
        "Table", "Divider",
      ]);
      const all = getDefaultReactSlashMenuItems(editor);
      const filtered = all.filter((it) => allowed.has(it.title));
      const items = filterSlashMenu ? filterSlashMenu(filtered) : filtered;
      return filterSuggestionItems(items, query);
    },
    [editor, filterSlashMenu]
  );

  // Mention menu — busca via /api/mentions/search e devolve itens executáveis
  const mentionMenuItems = useCallback(
    async (query: string): Promise<DefaultReactSuggestionItem[]> => {
      const url = `/api/mentions/search?q=${encodeURIComponent(query)}&limit=4`;
      let data: { items: MentionSearchItem[] };
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        data = await res.json();
      } catch {
        return [];
      }

      return data.items.map<DefaultReactSuggestionItem>((item) => ({
        title: item.label,
        subtext: `${prettyType(item.type)}${item.subtitle ? ` · ${item.subtitle}` : ""}`,
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: "mention",
              props: {
                targetType: item.type,
                targetId: item.id,
                label: item.label,
              },
            },
            " ", // espaço após a pill pra continuar digitando
          ]);
        },
      }));
    },
    [editor]
  );

  return (
    <div className={className} style={{ minHeight }} data-block-editor>
      <BlockNoteView
        editor={editor}
        editable={!readOnly}
        onChange={handleChange}
        slashMenu={false}
        theme="dark"
      >
        {!readOnly && (
          <>
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => slashMenuItems(query)}
            />
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={mentionMenuItems}
            />
          </>
        )}
      </BlockNoteView>
      <span style={{ display: "none" }} data-placeholder={placeholder} />
    </div>
  );
}

function prettyType(t: string): string {
  switch (t) {
    case "CLIENTE": return "Cliente";
    case "REUNIAO": return "Reunião";
    case "POST": return "Post";
    case "PROJETO": return "Projeto";
    case "TAREFA": return "Tarefa";
    case "CONTRATO": return "Contrato";
    case "NOTA": return "Nota";
    default: return t;
  }
}

/**
 * Aceita 4 formatos:
 * - undefined / null → vazio
 * - string vazia → vazio
 * - string que parece JSON ([) → parse direto
 * - texto markdown/plain → converte heuristicamente em blocos
 */
function parseValue(value: BlockContent): PartialBlock[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as PartialBlock[];
    } catch {
      // cai pra conversão heurística
    }
  }
  return textToBlocks(trimmed);
}
