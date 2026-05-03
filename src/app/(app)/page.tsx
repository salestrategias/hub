import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate, diffDias } from "@/lib/utils";
import { DashboardCharts } from "@/components/dashboard-charts";
import { ProximosEventos } from "@/components/proximos-eventos";
import { Users, Megaphone, ListChecks, FolderKanban, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const fim30Dias = new Date();
  fim30Dias.setDate(fim30Dias.getDate() + 30);

  const [
    clientesAtivos,
    contratos,
    postsMes,
    tarefasAbertas,
    tarefasAtrasadas,
    projetosAtivos,
    contratosVencendo,
    receitaPorClienteRaw,
    proximasEntregas,
  ] = await Promise.all([
    prisma.cliente.count({ where: { status: "ATIVO" } }),
    prisma.cliente.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nome: true, valorContratoMensal: true },
    }),
    prisma.post.count({ where: { dataPublicacao: { gte: inicioMes } } }),
    prisma.tarefa.count({ where: { concluida: false } }),
    prisma.tarefa.count({
      where: { concluida: false, dataEntrega: { lt: new Date() } },
    }),
    prisma.projeto.count({ where: { status: { not: "ENTREGUE" } } }),
    prisma.contrato.findMany({
      where: { dataFim: { gte: new Date(), lte: fim30Dias }, status: "ATIVO" },
      include: { cliente: true },
      orderBy: { dataFim: "asc" },
    }),
    prisma.cliente.findMany({
      where: { status: "ATIVO" },
      select: { nome: true, valorContratoMensal: true },
    }),
    prisma.tarefa.findMany({
      where: { concluida: false, dataEntrega: { gte: new Date() } },
      orderBy: { dataEntrega: "asc" },
      take: 6,
      include: { cliente: { select: { nome: true } } },
    }),
  ]);

  const mrr = contratos.reduce((s, c) => s + Number(c.valorContratoMensal), 0);

  // Receita 12 meses (lançamentos REAIS de RECEITA — fallback para MRR estável se vazio)
  const inicio12m = new Date();
  inicio12m.setMonth(inicio12m.getMonth() - 11);
  inicio12m.setDate(1);
  inicio12m.setHours(0, 0, 0, 0);

  const lanc = await prisma.lancamento.findMany({
    where: { tipo: "RECEITA", data: { gte: inicio12m } },
    select: { data: true, valor: true },
  });

  const receitaMensal: { mes: string; receita: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mes = d.getMonth();
    const ano = d.getFullYear();
    const total = lanc
      .filter((l) => l.data.getMonth() === mes && l.data.getFullYear() === ano)
      .reduce((s, l) => s + Number(l.valor), 0);
    receitaMensal.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      receita: total > 0 ? total : mrr,
    });
  }

  const receitaPorCliente = receitaPorClienteRaw
    .filter((c) => Number(c.valorContratoMensal) > 0)
    .map((c) => ({ name: c.nome, value: Number(c.valorContratoMensal) }));

  return (
    <PageShell title="Dashboard" subtitle="Visão consolidada da operação">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Kpi label="MRR" value={formatBRL(mrr)} icon={<Megaphone className="h-4 w-4" />} mono />
        <Kpi label="Clientes ativos" value={String(clientesAtivos)} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Posts no mês" value={String(postsMes)} icon={<Megaphone className="h-4 w-4" />} />
        <Kpi
          label="Tarefas abertas"
          value={String(tarefasAbertas)}
          icon={<ListChecks className="h-4 w-4" />}
          hint={tarefasAtrasadas ? `${tarefasAtrasadas} atrasada(s)` : undefined}
          danger={tarefasAtrasadas > 0}
        />
        <Kpi label="Projetos ativos" value={String(projetosAtivos)} icon={<FolderKanban className="h-4 w-4" />} />
      </div>

      {contratosVencendo.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Contratos vencendo em 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {contratosVencendo.map((c) => {
                const dias = diffDias(c.dataFim);
                return (
                  <li key={c.id} className="flex justify-between items-center">
                    <span>{c.cliente.nome}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{formatDate(c.dataFim)}</span>
                      <Badge variant={dias <= 7 ? "destructive" : "warning"}>{dias} dias</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <DashboardCharts receitaMensal={receitaMensal} receitaPorCliente={receitaPorCliente} />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Próximas entregas</CardTitle>
          </CardHeader>
          <CardContent>
            {proximasEntregas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma tarefa próxima.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {proximasEntregas.map((t) => (
                  <li key={t.id} className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{t.titulo}</div>
                      <div className="text-xs text-muted-foreground">{t.cliente?.nome ?? "—"}</div>
                    </div>
                    <span className="font-mono text-xs">{formatDate(t.dataEntrega)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <ProximosEventos />
      </div>
    </PageShell>
  );
}

function Kpi({
  label, value, icon, hint, mono, danger,
}: { label: string; value: string; icon: React.ReactNode; hint?: string; mono?: boolean; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className={`mt-1 text-2xl ${mono ? "font-mono" : "font-semibold"} ${danger ? "text-destructive" : ""}`}>
          {value}
        </div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}
