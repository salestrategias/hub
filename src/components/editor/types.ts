/**
 * Tipo permissivo pra blocos de editor — substituto do `PartialBlock`
 * do BlockNote (que foi removido em favor do Tiptap).
 *
 * Aceita tanto blocos no shape antigo do BlockNote (legado em DB)
 * quanto nós do Tiptap (`{type, content, attrs}`). Os call sites
 * tratam isso como dado opaco: passam pro editor, recebem do editor,
 * serializam com JSON.stringify. Nenhum acessa campos específicos.
 */
export type EditorBlock = {
  type?: string;
  content?: unknown;
  attrs?: Record<string, unknown>;
  props?: Record<string, unknown>;
  [key: string]: unknown;
};
