import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { FinanceiroClient } from "@/components/financeiro-client";
import { processarFaturamentoSilencioso } from "@/lib/faturamento-recorrente";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  // Área sensível: só ADMIN vê o financeiro da empresa (mesmo padrão
  // das telas /admin). As APIs também exigem requireAdmin — defesa dupla.
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  // Lazy trigger: garante que o mês corrente já tem mensalidades dos
  // clientes ATIVO geradas antes de carregar a lista. Idempotente —
  // rodar 2x no mesmo mês é no-op. Silencioso pra não quebrar a página.
  await processarFaturamentoSilencioso();

  const [lancamentos, clientes, clientesAtivos] = await Promise.all([
    prisma.lancamento.findMany({
      // PF fora da interface (decisão 10/08/2026): dados PF permanecem no
      // banco, mas nem chegam ao browser — a tela é 100% empresa.
      where: { entidade: "PJ" },
      include: { cliente: { select: { nome: true } } },
      orderBy: { data: "desc" },
    }),
    prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.cliente.findMany({ where: { status: "ATIVO" }, select: { valorContratoMensal: true } }),
  ]);

  const mrr = clientesAtivos.reduce((s, c) => s + Number(c.valorContratoMensal), 0);

  return (
    <PageShell title="Financeiro" subtitle="Receitas, despesas, MRR e projeções">
      <FinanceiroClient
        lancamentos={lancamentos.map((l) => ({
          ...l,
          valor: Number(l.valor),
          data: l.data.toISOString(),
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
          clienteNome: l.cliente?.nome ?? null,
        }))}
        clientes={clientes}
        mrr={mrr}
      />
    </PageShell>
  );
}
