import type { EditorBlock as PartialBlock } from "@/components/editor/types";
import { MentionEntity } from "@prisma/client";
import { prisma } from "@/lib/db";

export { MentionEntity };

export type MentionRef = {
  targetType: MentionEntity;
  targetId: string;
  /** Texto do label exibido no momento da menção (ex: "@Cliente XYZ"). */
  label?: string;
};

export type SyncSource = {
  sourceType: MentionEntity;
  sourceId: string;
};

/**
 * Varre uma árvore de blocos do BlockNote procurando inline contents do tipo
 * `mention` (custom inline content registrado no editor) e devolve a lista
 * desduplicada (por target).
 *
 * Estrutura esperada de cada mention inline content:
 *   { type: "mention", props: { targetType: "CLIENTE", targetId: "...", label: "..." } }
 */
export function extractMentions(blocks: PartialBlock[] | unknown): MentionRef[] {
  if (!Array.isArray(blocks)) return [];
  const found = new Map<string, MentionRef>();

  const visit = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object") return;

    const obj = node as Record<string, unknown>;

    // Inline content de mention
    if (obj.type === "mention" && obj.props && typeof obj.props === "object") {
      const props = obj.props as Record<string, unknown>;
      const targetType = props.targetType;
      const targetId = props.targetId;
      const label = props.label;
      if (typeof targetType === "string" && typeof targetId === "string" && isMentionEntity(targetType)) {
        const key = `${targetType}:${targetId}`;
        if (!found.has(key)) {
          found.set(key, {
            targetType: targetType as MentionEntity,
            targetId,
            label: typeof label === "string" ? label : undefined,
          });
        }
      }
    }

    // Recursão nos campos comuns: content (array de inline ou blocos), children (sub-blocos)
    if (Array.isArray(obj.content)) visit(obj.content);
    if (Array.isArray(obj.children)) visit(obj.children);
  };

  visit(blocks);
  return Array.from(found.values());
}

/**
 * Aceita string JSON / array / null e devolve mentions extraídas.
 * Usado pelos handlers de save que não querem parsear manualmente.
 */
export function extractMentionsFromValue(value: string | unknown[] | null | undefined): MentionRef[] {
  if (!value) return [];
  if (Array.isArray(value)) return extractMentions(value);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed.startsWith("[")) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return extractMentions(parsed);
  } catch {
    return [];
  }
}

/**
 * Sincroniza mentions persistidas com a lista atual extraída do documento.
 * - Insere as novas (skipDuplicates via @@unique)
 * - Deleta as que sumiram do conteúdo
 * - Atualiza nada (Mention não tem campo mutável fora da chave composta)
 *
 * Idempotente: rodar duas vezes seguidas com o mesmo input é no-op.
 */
export async function syncMentions(
  source: SyncSource,
  mentions: MentionRef[]
): Promise<{ created: number; deleted: number }> {
  // Existing
  const existing = await prisma.mention.findMany({
    where: { sourceType: source.sourceType, sourceId: source.sourceId },
    select: { id: true, targetType: true, targetId: true },
  });

  const wantKey = (m: { targetType: MentionEntity; targetId: string }) => `${m.targetType}:${m.targetId}`;
  const existingMap = new Map(existing.map((e) => [wantKey(e), e.id]));
  const desiredSet = new Set(mentions.map(wantKey));

  // Diff
  const toInsert = mentions.filter((m) => !existingMap.has(wantKey(m)));
  const toDelete = existing.filter((e) => !desiredSet.has(wantKey(e)));

  let created = 0;
  let deleted = 0;

  if (toInsert.length > 0) {
    const result = await prisma.mention.createMany({
      data: toInsert.map((m) => ({
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        targetType: m.targetType,
        targetId: m.targetId,
      })),
      skipDuplicates: true,
    });
    created = result.count;
  }

  if (toDelete.length > 0) {
    const result = await prisma.mention.deleteMany({
      where: { id: { in: toDelete.map((d) => d.id) } },
    });
    deleted = result.count;
  }

  return { created, deleted };
}

/**
 * Atalho: extrai do JSON cru e sincroniza. Retorna stats.
 * Não bloqueia o save do documento — chame com `void syncMentionsFromValue(...)`
 * em handlers fire-and-forget se latência importar.
 */
export async function syncMentionsFromValue(
  source: SyncSource,
  value: string | unknown[] | null | undefined
): Promise<{ created: number; deleted: number }> {
  const mentions = extractMentionsFromValue(value);
  return syncMentions(source, mentions);
}

/**
 * Quando um documento é deletado, suas mentions outbound somem junto.
 * Mentions inbound (alguém referencia este doc) ficam órfãs — são filtradas
 * na exibição via JOIN nas tabelas finais (target pode não existir mais).
 */
export async function deleteMentionsOf(source: SyncSource): Promise<number> {
  const r = await prisma.mention.deleteMany({
    where: { sourceType: source.sourceType, sourceId: source.sourceId },
  });
  return r.count;
}

function isMentionEntity(s: string): s is MentionEntity {
  return ["CLIENTE", "REUNIAO", "POST", "PROJETO", "TAREFA", "CONTRATO", "NOTA"].includes(s);
}
