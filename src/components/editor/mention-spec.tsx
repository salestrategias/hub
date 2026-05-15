"use client";
import { createReactInlineContentSpec } from "@blocknote/react";
import type { MentionEntity } from "@prisma/client";

/**
 * Inline content custom `mention` — render visual + serialização do @ no editor.
 *
 * Persistido como:
 *   { type: "mention", props: { targetType, targetId, label } }
 *
 * `extractMentions` em src/lib/mentions.ts depende dessa shape exata.
 *
 * NOTA: render é defensivo — try/catch + sem dependências externas (sem
 * lucide-react inside the NodeView, que causava crash em
 * `renderSpec` do ProseMirror em algumas configurações). Usa só emoji
 * por categoria. Mesmo render quebra fallback pra @label simples.
 */
export const mentionInlineSpec = createReactInlineContentSpec(
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
    render: (props) => {
      try {
        const targetType = (props.inlineContent?.props?.targetType ?? "") as MentionEntity | "";
        const targetId = props.inlineContent?.props?.targetId ?? "";
        const label = props.inlineContent?.props?.label || "—";
        const emoji = emojiFor(targetType);
        return (
          <span
            contentEditable={false}
            className="mention-pill inline-block px-1.5 py-0.5 rounded-md bg-sal-600/15 text-sal-400 text-[0.95em] font-medium align-baseline"
            data-mention-target-type={String(targetType)}
            data-mention-target-id={String(targetId)}
            title={`${targetType || "?"} · ${label}`}
          >
            {emoji} @{label}
          </span>
        );
      } catch {
        // Fallback ultra-simples se algo bizarro vier nas props
        const label = (props as { inlineContent?: { props?: { label?: unknown } } })?.inlineContent?.props?.label;
        return (
          <span contentEditable={false} className="mention-pill">
            @{typeof label === "string" ? label : "?"}
          </span>
        );
      }
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
