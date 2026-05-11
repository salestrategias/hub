/**
 * Faturamento recorrente — gera 1 lançamento de RECEITA por mês para
 * cada cliente ATIVO com `valorContratoMensal > 0`.
 *
 * Trigger: lazy quando alguém abre o /financeiro num mês cujo
 * faturamento ainda não foi processado. Sem dep de cron externo —
 * o próprio acesso humano dispara a geração. Marcelo também pode
 * forçar via botão "Gerar faturamento do mês" (admin/financeiro).
 *
 * Idempotência: antes de criar, checa se já existe Lancamento com:
 *   - mesmo clienteId
 *   - categoria = "Mensalidade"
 *   - data dentro do mês alvo
 * Rodar 2x no mesmo mês é no-op.
 *
 * Por que não usar Contrato (que tem dataInicio/dataFim)? Decisão de
 * MVP: `valorContratoMensal` no Cliente é a fonte da verdade pro MRR.
 * Se quiser cobrar baseado em Contratos múltiplos no futuro, troca
 * este loop pra iterar `prisma.contrato.findMany({status: ATIVO})`.
 */
import { prisma } from "@/lib/db";

export type ResultadoFaturamento = {
  ano: number;
  mes: number;
  criados: number;
  jaExistiam: number;
  ignorados: number;                    // clientes com valorContratoMensal=0
  detalhes: { cliente: string; status: "criado" | "ja_existia" | "ignorado"; valor: number }[];
};

/**
 * Processa o faturamento mensal pro mês/ano dado (default: mês corrente).
 * Cria lançamentos faltantes idempotentemente.
 */
export async function processarFaturamentoMensal(
  opts: { ano?: number; mes?: number } = {}
): Promise<ResultadoFaturamento> {
  const hoje = new Date();
  const ano = opts.ano ?? hoje.getFullYear();
  const mes = opts.mes ?? hoje.getMonth() + 1; // 1..12

  // Janela do mês alvo: [primeiro dia 00:00, próximo mês 00:00)
  const inicioMes = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const inicioProxMes = new Date(ano, mes, 1, 0, 0, 0, 0);

  const clientesAtivos = await prisma.cliente.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true, valorContratoMensal: true },
  });

  const resultado: ResultadoFaturamento = {
    ano,
    mes,
    criados: 0,
    jaExistiam: 0,
    ignorados: 0,
    detalhes: [],
  };

  for (const c of clientesAtivos) {
    const valor = Number(c.valorContratoMensal);
    if (!valor || valor <= 0) {
      resultado.ignorados++;
      resultado.detalhes.push({ cliente: c.nome, status: "ignorado", valor: 0 });
      continue;
    }

    // Idempotência: já tem mensalidade nesse mês pra esse cliente?
    const jaExiste = await prisma.lancamento.findFirst({
      where: {
        clienteId: c.id,
        categoria: "Mensalidade",
        tipo: "RECEITA",
        data: { gte: inicioMes, lt: inicioProxMes },
      },
      select: { id: true },
    });

    if (jaExiste) {
      resultado.jaExistiam++;
      resultado.detalhes.push({ cliente: c.nome, status: "ja_existia", valor });
      continue;
    }

    // Cria. Data = dia 1 do mês. Descrição inclui mês/ano pra leitura
    // rápida no extrato. Entidade default PJ (mensalidade é receita de
    // empresa). Recorrente=true pra Marcelo identificar geração automática.
    await prisma.lancamento.create({
      data: {
        descricao: `Mensalidade ${c.nome} — ${String(mes).padStart(2, "0")}/${ano}`,
        valor,
        tipo: "RECEITA",
        categoria: "Mensalidade",
        data: inicioMes,
        recorrente: true,
        entidade: "PJ",
        clienteId: c.id,
      },
    });

    resultado.criados++;
    resultado.detalhes.push({ cliente: c.nome, status: "criado", valor });
  }

  return resultado;
}

/**
 * Versão "fire-and-forget" pra usar em Server Components — não joga
 * erro pra cima, só loga. Garante que abrir o /financeiro nunca quebra
 * por causa do auto-faturamento.
 */
export async function processarFaturamentoSilencioso(): Promise<ResultadoFaturamento | null> {
  try {
    return await processarFaturamentoMensal();
  } catch (err) {
    console.error("[faturamento-recorrente] falha silenciosa:", err);
    return null;
  }
}
