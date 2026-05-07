/**
 * Insights agregados de um cliente — usado na página single-source
 * `/clientes/[id]`.
 *
 * Server-only. Faz queries paralelas e devolve a forma serializada que o
 * server component passa pros componentes client.
 *
 * Decisões:
 *  - Health score 0-100 com 5 dimensões de 20 pts (regra abaixo)
 *  - MRR sparkline: 12 meses, fallback pro valorContratoMensal em meses
 *    sem lançamento real
 *  - Activity chart: 12 semanas (90d), 4 categorias
 *  - Timeline: 50 eventos mais recentes mesclados (reunião, post, tarefa,
 *    lançamento, mention)
 */
import { prisma } from "@/lib/db";

export type HealthBreakdown = {
  reuniaoRecente: { score: number; max: number; label: string };
  tarefasAtrasadas: { score: number; max: number; label: string };
  postsRecentes: { score: number; max: number; label: string };
  contrato: { score: number; max: number; label: string };
  pagamentos: { score: number; max: number; label: string };
};

export type ClienteInsights = {
  // Cliente base
  id: string;
  nome: string;
  status: "ATIVO" | "INATIVO" | "PROSPECT" | "CHURNED";
  valorContratoMensal: number;

  // Health
  healthScore: number;
  healthLabel: "Saudável" | "Atenção" | "Crítico";
  healthBreakdown: HealthBreakdown;

  // KPIs
  tempoComoClienteMeses: number;
  primeiraInteracao: string | null; // ISO da primeira reunião/lançamento
  ltvTotal: number;
  ticketMedioMensal: number;
  reunioesTotal: number;
  reunioesUltimos30d: number;
  postsTotal: number;
  postsPublicadosUltimos30d: number;
  tarefasAtrasadas: number;

  // Charts
  mrr12m: { mes: string; receita: number }[];
  atividadeSemanas: {
    semana: string; // "01/01" formato curto
    semanaIso: string; // "2026-W01"
    reunioes: number;
    posts: number;
    tarefasConcluidas: number;
    lancamentos: number;
  }[];

  // Timeline
  timeline: TimelineEvento[];
};

export type TimelineEventoTipo = "REUNIAO" | "POST" | "TAREFA" | "LANCAMENTO" | "MENTION" | "CONTRATO";

export type TimelineEvento = {
  id: string;
  tipo: TimelineEventoTipo;
  titulo: string;
  subtitulo?: string;
  href?: string;
  data: string; // ISO
  meta?: string; // ex: "R$ 4.200" pra lançamentos
};

export async function buildClienteInsights(clienteId: string): Promise<ClienteInsights | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nome: true,
      status: true,
      valorContratoMensal: true,
      createdAt: true,
    },
  });

  if (!cliente) return null;

  // ─── Janelas de tempo ──────────────────────────────────────────
  const agora = new Date();
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);

  const fim30d = new Date(inicioHoje);
  const ini30d = new Date(inicioHoje);
  ini30d.setDate(ini30d.getDate() - 30);

  const ini60d = new Date(inicioHoje);
  ini60d.setDate(ini60d.getDate() - 60);

  const ini90d = new Date(inicioHoje);
  ini90d.setDate(ini90d.getDate() - 90);

  const ini12m = new Date();
  ini12m.setMonth(ini12m.getMonth() - 11);
  ini12m.setDate(1);
  ini12m.setHours(0, 0, 0, 0);

  // ─── Queries paralelas ────────────────────────────────────────
  const [
    reunioes,
    posts,
    tarefasAbertas,
    tarefasAtrasadasCount,
    contratos,
    lancamentos,
    mentions,
    primeiraReuniao,
    primeiroLancamento,
  ] = await Promise.all([
    prisma.reuniao.findMany({
      where: { clienteId, data: { gte: ini90d } },
      orderBy: { data: "desc" },
      select: { id: true, titulo: true, data: true, status: true },
      take: 60,
    }),
    prisma.post.findMany({
      where: { clienteId, dataPublicacao: { gte: ini90d } },
      orderBy: { dataPublicacao: "desc" },
      select: { id: true, titulo: true, dataPublicacao: true, status: true },
      take: 60,
    }),
    prisma.tarefa.findMany({
      where: { clienteId, OR: [{ concluida: false }, { updatedAt: { gte: ini90d }, concluida: true }] },
      orderBy: { updatedAt: "desc" },
      select: { id: true, titulo: true, concluida: true, dataEntrega: true, updatedAt: true, prioridade: true },
      take: 60,
    }),
    prisma.tarefa.count({
      where: { clienteId, concluida: false, dataEntrega: { lt: inicioHoje } },
    }),
    prisma.contrato.findMany({
      where: { clienteId },
      orderBy: { dataInicio: "desc" },
      select: { id: true, status: true, dataInicio: true, dataFim: true, valor: true },
    }),
    prisma.lancamento.findMany({
      where: { clienteId, data: { gte: ini12m } },
      orderBy: { data: "desc" },
      select: { id: true, descricao: true, valor: true, tipo: true, data: true },
      take: 200,
    }),
    prisma.mention.findMany({
      where: { targetType: "CLIENTE", targetId: clienteId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, sourceType: true, sourceId: true, createdAt: true },
    }),
    // Primeira reunião e primeiro lançamento — pra calcular tempo como cliente
    prisma.reuniao.findFirst({
      where: { clienteId },
      orderBy: { data: "asc" },
      select: { data: true },
    }),
    prisma.lancamento.findFirst({
      where: { clienteId, tipo: "RECEITA" },
      orderBy: { data: "asc" },
      select: { data: true },
    }),
  ]);

  // ─── KPIs base ─────────────────────────────────────────────────
  const reunioesUltimos30d = reunioes.filter((r) => r.data >= ini30d && r.data <= fim30d).length;
  const reunioesTotal = await prisma.reuniao.count({ where: { clienteId } });

  const postsPublicados = posts.filter((p) => p.status === "PUBLICADO");
  const postsPublicadosUltimos30d = postsPublicados.filter(
    (p) => p.dataPublicacao >= ini30d && p.dataPublicacao <= fim30d
  ).length;
  const postsTotal = await prisma.post.count({ where: { clienteId } });

  const ltvTotal = lancamentos
    .filter((l) => l.tipo === "RECEITA")
    .reduce((s, l) => s + Number(l.valor), 0);

  // Primeira data: menor entre primeira reunião e primeiro lançamento (fallback createdAt)
  const candidatos = [primeiraReuniao?.data, primeiroLancamento?.data, cliente.createdAt].filter(
    (d): d is Date => d instanceof Date
  );
  const primeiraInteracao = candidatos.length > 0 ? new Date(Math.min(...candidatos.map((d) => d.getTime()))) : null;
  const tempoMeses = primeiraInteracao
    ? Math.max(
        1,
        (agora.getFullYear() - primeiraInteracao.getFullYear()) * 12 +
          (agora.getMonth() - primeiraInteracao.getMonth())
      )
    : 0;
  const ticketMedio = tempoMeses > 0 ? ltvTotal / tempoMeses : Number(cliente.valorContratoMensal);

  // ─── Health Score ──────────────────────────────────────────────
  const breakdown = calcularHealthBreakdown({
    reunioesUltimos30d,
    ultimaReuniaoData: reunioes[0]?.data ?? primeiraReuniao?.data ?? null,
    tarefasAtrasadas: tarefasAtrasadasCount,
    postsPublicadosUltimos30d,
    contratoStatus: contratos[0]?.status ?? null,
    lancamentosUltimos30d: lancamentos.filter(
      (l) => l.tipo === "RECEITA" && l.data >= ini30d
    ).length,
    valorContratoMensal: Number(cliente.valorContratoMensal),
    receitaUltimos30d: lancamentos
      .filter((l) => l.tipo === "RECEITA" && l.data >= ini30d)
      .reduce((s, l) => s + Number(l.valor), 0),
  });
  const healthScore =
    breakdown.reuniaoRecente.score +
    breakdown.tarefasAtrasadas.score +
    breakdown.postsRecentes.score +
    breakdown.contrato.score +
    breakdown.pagamentos.score;
  const healthLabel: ClienteInsights["healthLabel"] =
    healthScore >= 80 ? "Saudável" : healthScore >= 60 ? "Atenção" : "Crítico";

  // ─── MRR 12m ──────────────────────────────────────────────────
  const mrrFallback = Number(cliente.valorContratoMensal);
  const mrr12m: ClienteInsights["mrr12m"] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mes = d.getMonth();
    const ano = d.getFullYear();
    const total = lancamentos
      .filter((l) => l.tipo === "RECEITA" && l.data.getMonth() === mes && l.data.getFullYear() === ano)
      .reduce((s, l) => s + Number(l.valor), 0);
    mrr12m.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      receita: total > 0 ? total : mrrFallback,
    });
  }

  // ─── Activity chart 12 semanas ────────────────────────────────
  const atividadeSemanas: ClienteInsights["atividadeSemanas"] = [];
  for (let i = 11; i >= 0; i--) {
    const fimSemana = new Date(inicioHoje);
    fimSemana.setDate(fimSemana.getDate() - i * 7);
    const inicioSemana = new Date(fimSemana);
    inicioSemana.setDate(inicioSemana.getDate() - 6);

    atividadeSemanas.push({
      semana: inicioSemana.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      semanaIso: isoWeekKey(inicioSemana),
      reunioes: reunioes.filter((r) => r.data >= inicioSemana && r.data <= fimSemana).length,
      posts: postsPublicados.filter((p) => p.dataPublicacao >= inicioSemana && p.dataPublicacao <= fimSemana).length,
      tarefasConcluidas: tarefasAbertas.filter(
        (t) => t.concluida && t.updatedAt >= inicioSemana && t.updatedAt <= fimSemana
      ).length,
      lancamentos: lancamentos.filter(
        (l) => l.tipo === "RECEITA" && l.data >= inicioSemana && l.data <= fimSemana
      ).length,
    });
  }

  // ─── Timeline mesclada ────────────────────────────────────────
  const timeline: TimelineEvento[] = [
    ...reunioes.map<TimelineEvento>((r) => ({
      id: `r-${r.id}`,
      tipo: "REUNIAO",
      titulo: r.titulo,
      subtitulo: r.status,
      href: `/reunioes/${r.id}`,
      data: r.data.toISOString(),
    })),
    ...postsPublicados.map<TimelineEvento>((p) => ({
      id: `p-${p.id}`,
      tipo: "POST",
      titulo: p.titulo ?? "(sem título)",
      subtitulo: "Post publicado",
      href: `/editorial?post=${p.id}`,
      data: p.dataPublicacao.toISOString(),
    })),
    ...tarefasAbertas
      .filter((t) => t.concluida)
      .map<TimelineEvento>((t) => ({
        id: `t-${t.id}`,
        tipo: "TAREFA",
        titulo: t.titulo,
        subtitulo: "Tarefa concluída",
        href: `/tarefas?tarefa=${t.id}`,
        data: t.updatedAt.toISOString(),
      })),
    ...lancamentos.slice(0, 30).map<TimelineEvento>((l) => ({
      id: `l-${l.id}`,
      tipo: "LANCAMENTO",
      titulo: l.descricao,
      subtitulo: l.tipo === "RECEITA" ? "Receita" : "Despesa",
      data: l.data.toISOString(),
      meta: `${l.tipo === "RECEITA" ? "+" : "-"}${formatBRL(Number(l.valor))}`,
    })),
    ...contratos.map<TimelineEvento>((c) => ({
      id: `c-${c.id}`,
      tipo: "CONTRATO",
      titulo: `Contrato ${c.status.toLowerCase()}`,
      subtitulo: `${formatDate(c.dataInicio)} → ${formatDate(c.dataFim)}`,
      href: `/contratos?contrato=${c.id}`,
      data: c.dataInicio.toISOString(),
      meta: formatBRL(Number(c.valor)) + "/mês",
    })),
    ...mentions.map<TimelineEvento>((m) => ({
      id: `m-${m.id}`,
      tipo: "MENTION",
      titulo: `Mencionado em ${m.sourceType.toLowerCase()}`,
      subtitulo: "Backlink criado",
      href: hrefForSource(m.sourceType, m.sourceId),
      data: m.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 50);

  return {
    id: cliente.id,
    nome: cliente.nome,
    status: cliente.status,
    valorContratoMensal: Number(cliente.valorContratoMensal),

    healthScore,
    healthLabel,
    healthBreakdown: breakdown,

    tempoComoClienteMeses: tempoMeses,
    primeiraInteracao: primeiraInteracao?.toISOString() ?? null,
    ltvTotal,
    ticketMedioMensal: ticketMedio,
    reunioesTotal,
    reunioesUltimos30d,
    postsTotal,
    postsPublicadosUltimos30d,
    tarefasAtrasadas: tarefasAtrasadasCount,

    mrr12m,
    atividadeSemanas,
    timeline,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function calcularHealthBreakdown(input: {
  reunioesUltimos30d: number;
  ultimaReuniaoData: Date | null;
  tarefasAtrasadas: number;
  postsPublicadosUltimos30d: number;
  contratoStatus: string | null;
  lancamentosUltimos30d: number;
  valorContratoMensal: number;
  receitaUltimos30d: number;
}): HealthBreakdown {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // 1. Reunião recente
  let reuniaoScore = 0;
  let reuniaoLabel = "Sem reunião há mais de 60 dias";
  if (input.ultimaReuniaoData) {
    const diasDesdeUltima = Math.floor((hoje.getTime() - input.ultimaReuniaoData.getTime()) / 86_400_000);
    if (diasDesdeUltima <= 30) {
      reuniaoScore = 20;
      reuniaoLabel = `Reunião há ${diasDesdeUltima}d`;
    } else if (diasDesdeUltima <= 60) {
      reuniaoScore = 10;
      reuniaoLabel = `Reunião há ${diasDesdeUltima}d`;
    } else {
      reuniaoLabel = `Reunião há ${diasDesdeUltima}d (>60d)`;
    }
  } else {
    reuniaoLabel = "Sem reunião registrada";
  }

  // 2. Tarefas atrasadas
  let tarefasScore = 20;
  let tarefasLabel = "Sem tarefas atrasadas";
  if (input.tarefasAtrasadas >= 3) {
    tarefasScore = 0;
    tarefasLabel = `${input.tarefasAtrasadas} tarefas atrasadas (crítico)`;
  } else if (input.tarefasAtrasadas >= 1) {
    tarefasScore = 10;
    tarefasLabel = `${input.tarefasAtrasadas} tarefa(s) atrasada(s)`;
  }

  // 3. Posts publicados (30d)
  let postsScore = 0;
  let postsLabel = "Sem posts publicados nos últimos 30d";
  if (input.postsPublicadosUltimos30d >= 5) {
    postsScore = 20;
    postsLabel = `${input.postsPublicadosUltimos30d} posts publicados nos últimos 30d`;
  } else if (input.postsPublicadosUltimos30d >= 1) {
    postsScore = 10;
    postsLabel = `${input.postsPublicadosUltimos30d} post(s) publicado(s) nos últimos 30d`;
  }

  // 4. Contrato
  let contratoScore = 0;
  let contratoLabel = "Sem contrato ativo";
  switch (input.contratoStatus) {
    case "ATIVO":
      contratoScore = 20;
      contratoLabel = "Contrato ativo";
      break;
    case "EM_RENOVACAO":
      contratoScore = 10;
      contratoLabel = "Contrato em renovação";
      break;
    case "ENCERRADO":
    case "CANCELADO":
      contratoScore = 0;
      contratoLabel = `Contrato ${input.contratoStatus.toLowerCase()}`;
      break;
    default:
      contratoLabel = "Sem contrato registrado";
  }

  // 5. Pagamentos: recebeu valor próximo do contratado nos últimos 30d?
  let pagScore = 0;
  let pagLabel = "Sem receita registrada nos últimos 30d";
  if (input.valorContratoMensal > 0) {
    const ratio = input.receitaUltimos30d / input.valorContratoMensal;
    if (ratio >= 0.9) {
      pagScore = 20;
      pagLabel = "Pagamento em dia";
    } else if (ratio >= 0.5) {
      pagScore = 10;
      pagLabel = "Pagamento parcial nos últimos 30d";
    } else {
      pagScore = 0;
      pagLabel = "Pagamento abaixo do esperado / atrasado";
    }
  } else {
    // Sem MRR contratado → não penaliza
    pagScore = 20;
    pagLabel = "Sem MRR contratado (n/a)";
  }

  return {
    reuniaoRecente: { score: reuniaoScore, max: 20, label: reuniaoLabel },
    tarefasAtrasadas: { score: tarefasScore, max: 20, label: tarefasLabel },
    postsRecentes: { score: postsScore, max: 20, label: postsLabel },
    contrato: { score: contratoScore, max: 20, label: contratoLabel },
    pagamentos: { score: pagScore, max: 20, label: pagLabel },
  };
}

function isoWeekKey(d: Date): string {
  const target = new Date(d);
  const dayNum = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = target.getTime();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.getTime()) / 604_800_000);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hrefForSource(tipo: string, id: string): string {
  switch (tipo) {
    case "NOTA": return `/notas?nota=${id}`;
    case "REUNIAO": return `/reunioes/${id}`;
    case "POST": return `/editorial?post=${id}`;
    case "PROJETO": return `/projetos?projeto=${id}`;
    case "TAREFA": return `/tarefas?tarefa=${id}`;
    case "CONTRATO": return `/contratos?contrato=${id}`;
    default: return "/";
  }
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}
