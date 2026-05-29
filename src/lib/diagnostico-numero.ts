import { prisma } from "@/lib/db";

/**
 * Gera próximo número de diagnóstico no formato `YYYY-NNN`.
 *
 * Sequencial por ano, independente da numeração de propostas:
 * 2026-001, 2026-002, ... 2027-001, ...
 *
 * Mesma abordagem de `proposta-numero.ts` — race condition é teórica
 * pro volume de uma agência (1-3 diagnósticos/mês).
 */
export async function proximoNumeroDiagnostico(): Promise<string> {
  const ano = new Date().getFullYear();
  const prefixo = `${ano}-`;

  const ultimo = await prisma.diagnostico.findFirst({
    where: { numero: { startsWith: prefixo } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });

  let seq = 1;
  if (ultimo?.numero) {
    const match = ultimo.numero.match(/-(\d+)$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `${prefixo}${String(seq).padStart(3, "0")}`;
}
