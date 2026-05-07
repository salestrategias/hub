import { prisma } from "@/lib/db";
import { Header } from "@/components/header";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { DashboardHoje } from "@/components/dashboard/dashboard-hoje";
import { DashboardAtencao } from "@/components/dashboard/dashboard-atencao";
import { DashboardPulse } from "@/components/dashboard/dashboard-pulse";
import { DashboardCharts } from "@/components/dashboard-charts";

export const dynamic = "force-dynamic";

/**
 * Dashboard "Hub de comando" — tela onde Marcelo abre o sistema de manhã
 * e em 5 segundos sabe o que tem que acontecer hoje.
 *
 * Estrutura (top-down, prioridade decrescente):
 *  1. Saudação contextual + data
 *  2. KPIs do negócio (MRR, receita, clientes, pulse)
 *  3. Hoje × Atenção (lado a lado)
 *  4. Pulse de produção (3 cards: posts, tarefas, atividade)
 *  5. Charts financeiros (receita 12 meses, receita por cliente)
 *
 * Todas as queries em paralelo. ~12 queries, ~250ms total típico.
 */
export default async function DashboardPage() {
  // ─── Janelas de tempo ──────────────────────────────────────────
  const agora = new Date();
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date(inicioHoje);
  fimHoje.setDate(fimHoje.getDate() + 1);

  const inicioMes = new Date(agora);
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const fimMes = new Date(inicioMes);
  fimMes.setMonth(fimMes.getMonth() + 1);

  const inicioMesAnterior = new Date(inicioMes);
  inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);

  const fim60Dias = new Date(inicioHoje);
  fim60Dias.setDate(fim60Dias.getDate() + 60);

  const inicio12m = new Date(inicioMes);
  inicio12m.setMonth(inicio12m.getMonth() - 11);

  // ─── Queries em paralelo ───────────────────────────────────────
  const [
    contratosAtivos,
    clientesAgg,
    receitaMesAtualLanc,
    receitaMesAnteriorLanc,
    despesasMesAtual,
    postsMes,
    reunioesMes,
    reunioesHoje,
    tarefasUrgentesHoje,
    postsHoje,
    contratosVencendo,
    tarefasAtrasadas,
    actionItemsAbertos,
    postsBreakdown,
    tarefasAbertas,
    tarefasConcluidasMes,
    notasRecentes,
    reunioesRecentes,
    postsRecentes,
    receitaPorCliente,
    lanc12m,
  ] = await Promise.all([
    // KPIs
    prisma.contrato.findMany({
      where: { status: "ATIVO" },
      select: { valor: true },
    }),
    prisma.cliente.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.lancamento.aggregate({
      where: { tipo: "RECEITA", data: { gte: inicioMes, lt: fimMes } },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { tipo: "RECEITA", data: { gte: inicioMesAnterior, lt: inicioMes } },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { tipo: "DESPESA", data: { gte: inicioMes, lt: fimMes } },
      _sum: { valor: true },
    }),
    prisma.post.count({
      where: { dataPublicacao: { gte: inicioMes, lt: fimMes } },
    }),
    prisma.reuniao.count({
      where: { data: { gte: inicioMes, lt: fimMes } },
    }),
    // Hoje
    prisma.reuniao.findMany({
      where: { data: { gte: inicioHoje, lt: fimHoje } },
      include: { cliente: { select: { nome: true } } },
      orderBy: { data: "asc" },
      take: 10,
    }),
    prisma.tarefa.findMany({
      where: {
        concluida: false,
        prioridade: { in: ["URGENTE", "ALTA"] },
        OR: [
          { dataEntrega: { gte: inicioHoje, lt: fimHoje } },
          { dataEntrega: { lt: inicioHoje } }, // atrasadas urgentes também aparecem em "hoje"
        ],
      },
      include: { cliente: { select: { nome: true } } },
      orderBy: [{ prioridade: "asc" }, { dataEntrega: "asc" }],
      take: 8,
    }),
    prisma.post.findMany({
      where: {
        dataPublicacao: { gte: inicioHoje, lt: fimHoje },
        status: { in: ["APROVADO", "RASCUNHO"] },
      },
      include: { cliente: { select: { nome: true } } },
      take: 6,
    }),
    // Atenção: contratos vencendo (60 dias)
    prisma.contrato.findMany({
      where: { status: "ATIVO", dataFim: { gte: inicioHoje, lte: fim60Dias } },
      include: { cliente: { select: { nome: true } } },
      orderBy: { dataFim: "asc" },
      take: 8,
    }),
    // Tarefas atrasadas (qualquer prioridade)
    prisma.tarefa.findMany({
      where: { concluida: false, dataEntrega: { lt: inicioHoje } },
      include: { cliente: { select: { nome: true } } },
      orderBy: { dataEntrega: "asc" },
      take: 8,
    }),
    // Action items abertos com prazo
    prisma.reuniaoAction.findMany({
      where: { concluido: false, prazo: { not: null } },
      include: { reuniao: { select: { id: true, titulo: true } } },
      take: 30,
    }),
    // Pulse de posts
    prisma.post.groupBy({
      by: ["status"],
      where: { dataPublicacao: { gte: inicioMes, lt: fimMes } },
      _count: { _all: true },
    }),
    // Pulse de tarefas
    prisma.tarefa.count({ where: { concluida: false } }),
    prisma.tarefa.count({
      where: { concluida: true, updatedAt: { gte: inicioMes, lt: fimMes } },
    }),
    // Atividade recente (últimas X de cada tipo, depois mescla)
    prisma.nota.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, titulo: true, pasta: true, updatedAt: true },
    }),
    prisma.reuniao.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        titulo: true,
        updatedAt: true,
        cliente: { select: { nome: true } },
      },
    }),
    prisma.post.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        titulo: true,
        updatedAt: true,
        cliente: { select: { nome: true } },
      },
    }),
    // Charts
    prisma.contrato.findMany({
      where: { status: "ATIVO" },
      select: { valor: true, cliente: { select: { nome: true } } },
    }),
    prisma.lancamento.findMany({
      where: { tipo: "RECEITA", data: { gte: inicio12m } },
      select: { data: true, valor: true },
    }),
  ]);

  // ─── Pós-processamento ─────────────────────────────────────────

  const mrr = contratosAtivos.reduce((s, c) => s + Number(c.valor), 0);
  const clientesAtivos = clientesAgg.find((g) => g.status === "ATIVO")?._count._all ?? 0;
  const clientesProspect = clientesAgg.find((g) => g.status === "PROSPECT")?._count._all ?? 0;

  const receitaMesAtual = Number(receitaMesAtualLanc._sum.valor ?? 0) || mrr;
  const receitaMesAnterior = Number(receitaMesAnteriorLanc._sum.valor ?? 0) || mrr;
  const _saldoMesAtual =
    Number(receitaMesAtualLanc._sum.valor ?? 0) - Number(despesasMesAtual._sum.valor ?? 0);

  const reunioesHojeData = reunioesHoje.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    hora: r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    cliente: r.cliente?.nome ?? null,
  }));

  const tarefasUrgentesHojeData = tarefasUrgentesHoje.slice(0, 6).map((t) => ({
    id: t.id,
    titulo: t.titulo,
    prioridade: t.prioridade,
    cliente: t.cliente?.nome ?? null,
  }));

  const postsHojeData = postsHoje.map((p) => ({
    id: p.id,
    titulo: p.titulo ?? "(sem título)",
    cliente: p.cliente?.nome ?? null,
    status: p.status,
  }));

  const contratosData = contratosVencendo.map((c) => ({
    id: c.id,
    cliente: c.cliente?.nome ?? "(s/ cliente)",
    diasRestantes: Math.ceil((c.dataFim.getTime() - inicioHoje.getTime()) / (1000 * 60 * 60 * 24)),
    dataFim: c.dataFim.toLocaleDateString("pt-BR"),
    valor: Number(c.valor),
  }));

  const tarefasAtrasadasData = tarefasAtrasadas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    cliente: t.cliente?.nome ?? null,
    prioridade: t.prioridade,
    diasAtraso: t.dataEntrega
      ? Math.floor((inicioHoje.getTime() - t.dataEntrega.getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  }));

  // Filtra action items cujo prazo já passou (parser leve no server)
  const actionsAtrasadosData = actionItemsAbertos
    .map((a) => {
      const prazoDt = parsePrazoLivre(a.prazo ?? "");
      if (!prazoDt || prazoDt >= inicioHoje) return null;
      return {
        id: a.id,
        texto: a.texto,
        reuniaoId: a.reuniao.id,
        reuniaoTitulo: a.reuniao.titulo,
        diasAtraso: Math.floor((inicioHoje.getTime() - prazoDt.getTime()) / (1000 * 60 * 60 * 24)),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .slice(0, 6);

  const postsBreakdownData = {
    rascunho: postsBreakdown.find((g) => g.status === "RASCUNHO")?._count._all ?? 0,
    aprovado: postsBreakdown.find((g) => g.status === "APROVADO")?._count._all ?? 0,
    publicado: postsBreakdown.find((g) => g.status === "PUBLICADO")?._count._all ?? 0,
    total: postsBreakdown.reduce((s, g) => s + g._count._all, 0),
  };

  // Mescla atividades recentes (8 mais recentes do total)
  type Atividade = {
    id: string;
    tipo: "NOTA" | "REUNIAO" | "POST";
    titulo: string;
    subtitulo?: string;
    href: string;
    createdAt: string;
  };
  const todasAtividades: Atividade[] = [
    ...notasRecentes.map<Atividade>((n) => ({
      id: n.id,
      tipo: "NOTA",
      titulo: n.titulo,
      subtitulo: n.pasta,
      href: `/notas?nota=${n.id}`,
      createdAt: n.updatedAt.toISOString(),
    })),
    ...reunioesRecentes.map<Atividade>((r) => ({
      id: r.id,
      tipo: "REUNIAO",
      titulo: r.titulo,
      subtitulo: r.cliente?.nome,
      href: `/reunioes/${r.id}`,
      createdAt: r.updatedAt.toISOString(),
    })),
    ...postsRecentes.map<Atividade>((p) => ({
      id: p.id,
      tipo: "POST",
      titulo: p.titulo ?? "(sem título)",
      subtitulo: p.cliente?.nome,
      href: `/editorial?post=${p.id}`,
      createdAt: p.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  // Receita 12m (fallback MRR pra meses sem lançamentos)
  const receitaMensal: { mes: string; receita: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mes = d.getMonth();
    const ano = d.getFullYear();
    const total = lanc12m
      .filter((l) => l.data.getMonth() === mes && l.data.getFullYear() === ano)
      .reduce((s, l) => s + Number(l.valor), 0);
    receitaMensal.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      receita: total > 0 ? total : mrr,
    });
  }

  const receitaPorClienteData = receitaPorCliente
    .filter((c) => Number(c.valor) > 0)
    .map((c) => ({ name: c.cliente?.nome ?? "(s/c)", value: Number(c.valor) }));

  return (
    <>
      <Header />
      <div className="px-8 py-7 space-y-7 max-w-[1400px] mx-auto">
        <DashboardGreeting />

        <DashboardKpis
          data={{
            mrr,
            receitaMesAtual,
            receitaMesAnterior,
            saldoMesAtual: _saldoMesAtual,
            clientesAtivos,
            clientesProspect,
            postsMes,
            reunioesMes,
          }}
        />

        <div className="grid lg:grid-cols-[1fr_1fr] gap-3">
          <DashboardHoje
            reunioes={reunioesHojeData}
            tarefas={tarefasUrgentesHojeData}
            posts={postsHojeData}
          />
          <DashboardAtencao
            contratos={contratosData}
            tarefasAtrasadas={tarefasAtrasadasData}
            actionItems={actionsAtrasadosData}
          />
        </div>

        <DashboardPulse
          atividades={todasAtividades}
          posts={postsBreakdownData}
          tarefasAbertas={tarefasAbertas}
          tarefasConcluidasMes={tarefasConcluidasMes}
        />

        <div className="animate-slide-up" style={{ animationDelay: "300ms" }}>
          <DashboardCharts receitaMensal={receitaMensal} receitaPorCliente={receitaPorClienteData} />
        </div>
      </div>
    </>
  );
}

/**
 * Parser leve para `prazo` livre. Espelhado em src/lib/notificacoes.ts —
 * mantido inline aqui pra não importar lib server-only no server component
 * (ambos correm no server, mas evita ciclo de imports).
 */
function parsePrazoLivre(prazo: string): Date | null {
  const s = prazo.toLowerCase().trim();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (s.includes("amanh")) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (s.includes("hoje")) return hoje;

  const m = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10) - 1;
    let ano = m[3] ? parseInt(m[3], 10) : hoje.getFullYear();
    if (ano < 100) ano += 2000;
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}
