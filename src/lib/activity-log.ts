import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { ipFromHeaders } from "@/lib/user-agent";
import type { TipoAtividade } from "@prisma/client";

// Re-exporta funções puras para conveniência (mantém compatibilidade com imports antigos)
export { ipFromHeaders, parseUserAgent } from "@/lib/user-agent";

type LogInput = {
  userId: string;
  tipo: TipoAtividade;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Registra um evento de atividade. Fire-and-forget: não bloqueia a request
 * nem propaga erro caso o write falhe (logging não pode quebrar a UX).
 *
 * Server-only — usa prisma.
 */
export function logActivity(input: LogInput): void {
  prisma.atividadeConta
    .create({
      data: {
        userId: input.userId,
        tipo: input.tipo,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        meta: input.meta ? (input.meta as object) : undefined,
      },
    })
    .catch((e) => console.error("[activity-log] falha ao registrar:", e));
}

/**
 * Versão que extrai IP/UA das headers da request server (Next App Router).
 * Server-only — usa next/headers.
 */
export async function logActivityFromRequest(
  userId: string,
  tipo: TipoAtividade,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    const h = await headers();
    logActivity({
      userId,
      tipo,
      ip: ipFromHeaders(h),
      userAgent: h.get("user-agent"),
      meta,
    });
  } catch {
    // Em contextos onde headers() não está disponível (callbacks especiais)
    logActivity({ userId, tipo, meta });
  }
}
