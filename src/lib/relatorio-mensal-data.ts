/**
 * Consolida todos os dados necessários pro relatório mensal de um cliente.
 *
 * Fetcher único — chamado pela API GET /api/clientes/[id]/relatorio-mensal.
 * Roda queries em paralelo e devolve estrutura "PDF-ready" (já com deltas
 * pré-calculados, totais agregados, etc) pra o componente PDF ser puro
 * de dados.
 *
 * Decisões:
 *  - "Mês alvo" é definido por ano/mês (não por janela arbitrária) —
 *    mantém alinhamento com os granularidades de MetricaRede/Seo.
 *  - Comparativo é sempre vs. mês imediatamente anterior. Hardcoded
 *    porque é o caso de uso (cliente quer ver evolução MoM).
 *  - Seções com dados zerados são marcadas com `temDados=false` pro
 *    PDF poder esconder/colapsar — evita página em branco.
 */
import { prisma } from "@/lib/db";

export type RelatorioMensalData = {
  cliente: { id: string; nome: string };
  ano: number;
  mes: number;
  inicioMes: Date;
  fimMes: Date;
  geradoEm: Date;

  redes: {
    temDados: boolean;
    porRede: Array<{
      rede: "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "TIKTOK" | "YOUTUBE";
      atual: MetricaRedeSnap;
      anterior: MetricaRedeSnap | null;
    }>;
  };

  seo: {
    temDados: boolean;
    atual: MetricaSeoSnap | null;
    anterior: MetricaSeoSnap | null;
    keywords: Array<{
      keyword: string;
      posicaoAtual: number;
      posicaoAnterior: number;
      urlRanqueada: string | null;
    }>;
  };

  trafego: {
    temDados: boolean;
    campanhas: Array<{
      nome: string;
      plataforma: string;
      investimento: number;
      impressoes: number;
      cliques: number;
      conversoes: number;
      cpa: number;
      roas: number;
    }>;
    totais: { investimento: number; conversoes: number; cpaMedio: number; roasMedio: number };
  };

  conteudo: {
    temDados: boolean;
    posts: Array<{ titulo: string; formato: string; status: string; dataPublicacao: Date }>;
  };

  operacional: {
    temDados: boolean;
    tarefasConcluidas: Array<{ titulo: string; concluidaEm: Date; prioridade: string }>;
    reunioes: Array<{ titulo: string; data: Date; duracaoSeg: number | null }>;
  };
};

type MetricaRedeSnap = {
  seguidores: number;
  alcance: number;
  impressoes: number;
  engajamento: number;
  posts: number;
  stories: number;
  reels: number;
};

type MetricaSeoSnap = {
  posicaoMedia: number;
  cliquesOrganicos: number;
  impressoes: number;
  ctr: number;
  keywordsRanqueadas: number;
};

export async function montarRelatorioMensal(
  clienteId: string,
  opts: { ano?: number; mes?: number } = {}
): Promise<RelatorioMensalData> {
  const hoje = new Date();
  const ano = opts.ano ?? hoje.getFullYear();
  const mes = opts.mes ?? hoje.getMonth() + 1;

  const inicioMes = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const fimMes = new Date(ano, mes, 1, 0, 0, 0, 0);

  // Mês anterior (para comparativo MoM)
  const mesAnteriorMes = mes === 1 ? 12 : mes - 1;
  const mesAnteriorAno = mes === 1 ? ano - 1 : ano;

  const cliente = await prisma.cliente.findUniqueOrThrow({
    where: { id: clienteId },
    select: { id: true, nome: true },
  });

  const [
    metricasRedeAtual,
    metricasRedeAnterior,
    metricaSeoAtual,
    metricaSeoAnterior,
    keywords,
    campanhas,
    posts,
    tarefas,
    reunioes,
  ] = await Promise.all([
    prisma.metricaRede.findMany({
      where: { clienteId, ano, mes },
    }),
    prisma.metricaRede.findMany({
      where: { clienteId, ano: mesAnteriorAno, mes: mesAnteriorMes },
    }),
    prisma.metricaSeo.findUnique({
      where: { clienteId_ano_mes: { clienteId, ano, mes } },
    }),
    prisma.metricaSeo.findUnique({
      where: { clienteId_ano_mes: { clienteId, ano: mesAnteriorAno, mes: mesAnteriorMes } },
    }),
    prisma.seoKeyword.findMany({
      where: { clienteId },
      orderBy: { posicaoAtual: "asc" },
      take: 15,
    }),
    prisma.campanhaPaga.findMany({
      where: { clienteId, ano, mes },
      orderBy: { investimento: "desc" },
    }),
    prisma.post.findMany({
      where: {
        clienteId,
        dataPublicacao: { gte: inicioMes, lt: fimMes },
      },
      orderBy: { dataPublicacao: "asc" },
    }),
    prisma.tarefa.findMany({
      where: {
        clienteId,
        concluida: true,
        // Tarefa não tem `concluidaEm` — uso updatedAt como proxy, com filtro
        // que ela tenha sido marcada concluida dentro do mês alvo.
        updatedAt: { gte: inicioMes, lt: fimMes },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.reuniao.findMany({
      where: {
        clienteId,
        data: { gte: inicioMes, lt: fimMes },
      },
      orderBy: { data: "asc" },
    }),
  ]);

  // Index por rede pra cruzar atual + anterior
  const anteriorPorRede = new Map(metricasRedeAnterior.map((m) => [m.rede, m]));

  const redesPorRede = metricasRedeAtual.map((m) => ({
    rede: m.rede,
    atual: snapMetricaRede(m),
    anterior: anteriorPorRede.has(m.rede)
      ? snapMetricaRede(anteriorPorRede.get(m.rede)!)
      : null,
  }));

  const invTotal = campanhas.reduce((s, c) => s + Number(c.investimento), 0);
  const convTotal = campanhas.reduce((s, c) => s + c.conversoes, 0);
  const cpaMedio = campanhas.length
    ? campanhas.reduce((s, c) => s + Number(c.cpa), 0) / campanhas.length
    : 0;
  const roasMedio = campanhas.length
    ? campanhas.reduce((s, c) => s + c.roas, 0) / campanhas.length
    : 0;

  return {
    cliente,
    ano,
    mes,
    inicioMes,
    fimMes,
    geradoEm: new Date(),

    redes: {
      temDados: redesPorRede.length > 0,
      porRede: redesPorRede,
    },

    seo: {
      temDados: !!metricaSeoAtual,
      atual: metricaSeoAtual ? snapMetricaSeo(metricaSeoAtual) : null,
      anterior: metricaSeoAnterior ? snapMetricaSeo(metricaSeoAnterior) : null,
      keywords: keywords.map((k) => ({
        keyword: k.keyword,
        posicaoAtual: k.posicaoAtual,
        posicaoAnterior: k.posicaoAnterior,
        urlRanqueada: k.urlRanqueada,
      })),
    },

    trafego: {
      temDados: campanhas.length > 0,
      campanhas: campanhas.map((c) => ({
        nome: c.nome,
        plataforma: c.plataforma,
        investimento: Number(c.investimento),
        impressoes: c.impressoes,
        cliques: c.cliques,
        conversoes: c.conversoes,
        cpa: Number(c.cpa),
        roas: c.roas,
      })),
      totais: {
        investimento: invTotal,
        conversoes: convTotal,
        cpaMedio,
        roasMedio,
      },
    },

    conteudo: {
      temDados: posts.length > 0,
      posts: posts.map((p) => ({
        titulo: p.titulo,
        formato: p.formato,
        status: p.status,
        dataPublicacao: p.dataPublicacao,
      })),
    },

    operacional: {
      temDados: tarefas.length > 0 || reunioes.length > 0,
      tarefasConcluidas: tarefas.map((t) => ({
        titulo: t.titulo,
        concluidaEm: t.updatedAt,
        prioridade: t.prioridade,
      })),
      reunioes: reunioes.map((r) => ({
        titulo: r.titulo,
        data: r.data,
        duracaoSeg: r.duracaoSeg,
      })),
    },
  };
}

function snapMetricaRede(m: {
  seguidores: number;
  alcance: number;
  impressoes: number;
  engajamento: number;
  posts: number;
  stories: number;
  reels: number;
}): MetricaRedeSnap {
  return {
    seguidores: m.seguidores,
    alcance: m.alcance,
    impressoes: m.impressoes,
    engajamento: m.engajamento,
    posts: m.posts,
    stories: m.stories,
    reels: m.reels,
  };
}

function snapMetricaSeo(m: {
  posicaoMedia: number;
  cliquesOrganicos: number;
  impressoes: number;
  ctr: number;
  keywordsRanqueadas: number;
}): MetricaSeoSnap {
  return {
    posicaoMedia: m.posicaoMedia,
    cliquesOrganicos: m.cliquesOrganicos,
    impressoes: m.impressoes,
    ctr: m.ctr,
    keywordsRanqueadas: m.keywordsRanqueadas,
  };
}

/**
 * Calcula delta percentual entre 2 valores (atual vs anterior).
 * Retorna null se não dá pra comparar (anterior=0 e atual=0).
 */
export function delta(atual: number, anterior: number | null | undefined): number | null {
  if (anterior === null || anterior === undefined) return null;
  if (anterior === 0) return atual === 0 ? null : 100;
  return ((atual - anterior) / anterior) * 100;
}
