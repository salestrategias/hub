"use client";
import {
  createReactInlineContentSpec,
} from "@blocknote/react";
import type { MentionEntity } from "@prisma/client";
import { Users, Mic, FileText, FolderKanban, ListChecks, FileSignature, StickyNote } from "lucide-react";

/**
 * Inline content custom `mention` — render visual + serialização do @ no editor.
 *
 * Persistido como:
 *   { type: "mention", props: { targetType, targetId, label } }
 *
 * `extractMentions` em src/lib/mentions.ts depende dessa shape exata.
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
      const targetType = props.inlineContent.props.targetType as MentionEntity | "";
      const label = props.inlineContent.props.label || "—";
      const Icon = iconFor(targetType);
      return (
        <span
          contentEditable={false}
          className="mention-pill inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sal-600/15 text-sal-400 text-[0.95em] font-medium align-baseline"
          data-mention-target-type={targetType}
          data-mention-target-id={props.inlineContent.props.targetId}
          title={`${targetType} · ${label}`}
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span>@{label}</span>
        </span>
      );
    },
  }
);

function iconFor(t: MentionEntity | "") {
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
