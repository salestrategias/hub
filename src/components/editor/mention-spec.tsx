"use client";
import { createInlineContentSpec } from "@blocknote/core";
import type { MentionEntity } from "@prisma/client";

/**
 * Inline content custom `mention` — render visual + serialização do @ no editor.
 *
 * Persistido como:
 *   { type: "mention", props: { targetType, targetId, label } }
 *
 * `extractMentions` em src/lib/mentions.ts depende dessa shape exata.
 *
 * **IMPORTANTE — por que DOM puro e não React?**
 * A versão anterior usava `createReactInlineContentSpec`. No BlockNote 0.21
 * isso disparava `RangeError: Invalid array passed to renderSpec` em
 * ProseMirror, dentro do `createNodeViews` async. O erro acontece fora do
 * lifecycle de render React, então ErrorBoundary não pega. Solução: usar
 * `createInlineContentSpec` (do `@blocknote/core`) que produz um NodeView
 * DOM puro — funciona via `toDOM` padrão do ProseMirror sem React adapter.
 */
export const mentionInlineSpec = createInlineContentSpec(
  {
    type: "mention" as const,
    propSchema: {
      targetType: { default: "" },
      targetId: { default: "" },
      label: { default: "" },
    },
    content: "none",
  },
  {
    render: (inlineContent) => {
      const targetType = String(inlineContent.props.targetType ?? "") as MentionEntity | "";
      const targetId = String(inlineContent.props.targetId ?? "");
      const labelRaw = inlineContent.props.label;
      const label = typeof labelRaw === "string" && labelRaw ? labelRaw : "—";
      const emoji = emojiFor(targetType);

      const dom = document.createElement("span");
      dom.className =
        "mention-pill inline-block px-1.5 py-0.5 rounded-md bg-sal-600/15 text-sal-400 text-[0.95em] font-medium align-baseline";
      dom.contentEditable = "false";
      dom.setAttribute("data-mention-target-type", targetType);
      dom.setAttribute("data-mention-target-id", targetId);
      dom.setAttribute("title", `${targetType || "?"} · ${label}`);
      dom.textContent = `${emoji} @${label}`;

      return { dom };
    },
  }
);

function emojiFor(t: MentionEntity | ""): string {
  switch (t) {
    case "CLIENTE": return "👤";
    case "REUNIAO": return "🎙";
    case "POST": return "📝";
    case "PROJETO": return "📁";
    case "TAREFA": return "✓";
    case "CONTRATO": return "📄";
    case "NOTA": return "🗒";
    default: return "@";
  }
}
