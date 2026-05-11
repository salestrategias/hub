import { prisma } from "@/lib/db";

/**
 * Gera próximo número de proposta no formato `YYYY-NNN`.
 *
 * Sequencial por ano: 2026-001, 2026-002, ... 2027-001, ...
 *
 * Implementação: query as propostas do ano corrente, conta + 1, pad com 3 dígitos.
 * Race condition é teórica pra volume baixo (uma agência cria 1-3 propostas/mês).
 * Se virar problema, basta adicionar advisory lock ou unique constraint com retry.
 */
export async function proximoNumeroProposta(): Promise<string> {
  const ano = new Date().getFullYear();
  const prefixo = `${ano}-`;

  const ultima = await prisma.proposta.findFirst({
    where: { numero: { startsWith: prefixo } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });

  let seq = 1;
  if (ultima?.numero) {
    const match = ultima.numero.match(/-(\d+)$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `${prefixo}${String(seq).padStart(3, "0")}`;
}
