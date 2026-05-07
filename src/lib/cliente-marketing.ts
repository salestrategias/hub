/**
 * Agrega métricas de marketing de um cliente para a página single source.
 *
 * 3 verticais cobertas:
 *   1. Tráfego pago (CampanhaPaga) — últimos 6 meses
 *   2. Redes sociais (MetricaRede + MetaRede) — último mês por rede
 *   3. SEO (MetricaSeo + SeoKeyword) — último mês + top keywords
 *
 * Tudo retornado serializado pra passar pro client component.
 */
import { prisma } from "@/lib/db";
import type { PlataformaAds, RedeSocial } from "@prisma/client";

export type TrafegoPagoResumo = {
  investimentoTotal6m: number;
  conversoesTotal6m: number;
  roasMedio6m: number;
  cpaMedio6m: number;
  campanhasMes: number; // campanhas registradas no mês corrente
  porMes: Array<{ ano: number; mes: number; label: string; investimento: number; conversoes: number; roas: number }>;
  topCampanhas: Array<{
    id: string;
    nome: string;
    plataforma: PlataformaAds;
    investimento: number;
    conversoes: number;
    roas: number;
    ano: number;
    mes: number;
  }>;
};

export type RedesResumo = {
  porRede: Array<{
    rede: RedeSocial;
    seguidoresAtual: number;
    seguidoresAnterior: number;
    deltaSeguidores: number;
    metaSeguidores: number; // 0 se não há meta
    progressoMeta: number; // 0..1, ou 0 se sem meta
    alcanceMes: number;
    engajamentoMes: number;
    taxaEngajamento: number; // engajamento / alcance, 0..1
    postsMes: number;
    storiesMes: number;
    reelsMes: number;
    ultimoRegistro: string | null; // ISO
  }>;
};

export type SeoResumo = {
  posicaoMedia: number | null;
  cliquesOrganicos: number | null;
  impressoes: number | null;
  ctr: number | null; // 0..1
  keywordsRanqueadas: number | null;
  observacoes: string | null;
  ultimoRegistro: string | null;
  deltaPosicao: number | null; // negativo = melhorou
  topKeywords: Array<{
    id: string;
    keyword: string;
    posicaoAtual: number;
    posicaoAnterior: number;
    delta: number; // negativo = subiu
    volumeEstimado: number;
    urlRanqueada: string | null;
  }>;
};

export type ClienteMarketing = {
  trafegoPago: TrafegoPagoResumo;
  redes: RedesResumo;
  seo: SeoResumo;
};

const REDES_TODAS: RedeSocial[] = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "YOUTUBE"];

export async function buildClienteMarketing(clienteId: string): Promise<ClienteMarketing> {
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1; // 1..12

  // Janela 6m: ano/mes pra cá menos 5 meses (inclui atual)
  const seisMesesAtras = new Date(agora);
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 5);
  const anoMin = seisMesesAtras.getFullYear();
  const mesMin = seisMesesAtras.getMonth() + 1;

  // Mês anterior (pra delta de redes/seo)
  const mesAnteriorDate = new Date(agora);
  mesAnteriorDate.setMonth(mesAnteriorDate.getMonth() - 1);
  const anoAnt = mesAnteriorDate.getFullYear();
  const mesAnt = mesAnteriorDate.getMonth() + 1;

  // ─── Queries paralelas ────────────────────────────────────────
  const [campanhas, metricasRede, metasRede, metricasSeo, seoKeywords] = await Promise.all([
    prisma.campanhaPaga.findMany({
      where: {
        clienteId,
        OR: [
          { ano: { gt: anoMin } },
          { AND: [{ ano: anoMin }, { mes: { gte: mesMin } }] },
        ],
      },
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
    }),
    prisma.metricaRede.findMany({
      where: { clienteId },
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
      take: 30, // últimos 6m × 5 redes
    }),
    prisma.metaRede.findMany({
      where: { clienteId },
    }),
    prisma.metricaSeo.findMany({
      where: { clienteId },
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
      take: 6,
    }),
    prisma.seoKeyword.findMany({
      where: { clienteId },
      orderBy: { posicaoAtual: "asc" },
      take: 10,
    }),
  ]);

  // ─── Tráfego pago ──────────────────────────────────────────────
  const trafegoPago = agregarTrafego(campanhas, anoAtual, mesAtual);

  // ─── Redes sociais ────────────────────────────────────────────
  const redes = agregarRedes(metricasRede, metasRede, anoAtual, mesAtual, anoAnt, mesAnt);

  // ─── SEO ──────────────────────────────────────────────────────
  const seo = agregarSeo(metricasSeo, seoKeywords);

  return { trafegoPago, redes, seo };
}

function agregarTrafego(
  campanhas: Array<{
    id: string;
    nome: string;
    plataforma: PlataformaAds;
    ano: number;
    mes: number;
    investimento: { toString: () => string };
    conversoes: number;
    roas: number;
    cpa: { toString: () => string };
  }>,
  anoAtual: number,
  mesAtual: number
): TrafegoPagoResumo {
  let investimentoTotal = 0;
  let conversoesTotal = 0;
  let roasSum = 0;
  let cpaSum = 0;
  let countComRoas = 0;
  let countComCpa = 0;

  const porMesMap = new Map<string, { ano: number; mes: number; investimento: number; conversoes: number; roasSum: number; count: number }>();

  for (const c of campanhas) {
    const inv = Number(c.investimento.toString());
    investimentoTotal += inv;
    conversoesTotal += c.conversoes;
    if (c.roas > 0) {
      roasSum += c.roas;
      countComRoas += 1;
    }
    const cpaNum = Number(c.cpa.toString());
    if (cpaNum > 0) {
      cpaSum += cpaNum;
      countComCpa += 1;
    }

    const key = `${c.ano}-${c.mes}`;
    const acc = porMesMap.get(key) ?? { ano: c.ano, mes: c.mes, investimento: 0, conversoes: 0, roasSum: 0, count: 0 };
    acc.investimento += inv;
    acc.conversoes += c.conversoes;
    if (c.roas > 0) {
      acc.roasSum += c.roas;
      acc.count += 1;
    }
    porMesMap.set(key, acc);
  }

  const porMes = Array.from(porMesMap.values())
    .sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes))
    .map((x) => ({
      ano: x.ano,
      mes: x.mes,
      label: nomeMesCurto(x.mes),
      investimento: x.investimento,
      conversoes: x.conversoes,
      roas: x.count > 0 ? x.roasSum / x.count : 0,
    }));

  // Top 3 campanhas por ROAS (com investimento mínimo de R$ 100 pra evitar campanha de teste)
  const topCampanhas = [...campanhas]
    .filter((c) => Number(c.investimento.toString()) >= 100 && c.roas > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      plataforma: c.plataforma,
      investimento: Number(c.investimento.toString()),
      conversoes: c.conversoes,
      roas: c.roas,
      ano: c.ano,
      mes: c.mes,
    }));

  return {
    investimentoTotal6m: investimentoTotal,
    conversoesTotal6m: conversoesTotal,
    roasMedio6m: countComRoas > 0 ? roasSum / countComRoas : 0,
    cpaMedio6m: countComCpa > 0 ? cpaSum / countComCpa : 0,
    campanhasMes: campanhas.filter((c) => c.ano === anoAtual && c.mes === mesAtual).length,
    porMes,
    topCampanhas,
  };
}

function agregarRedes(
  metricas: Array<{
    rede: RedeSocial;
    ano: number;
    mes: number;
    seguidores: number;
    alcance: number;
    impressoes: number;
    engajamento: number;
    posts: number;
    stories: number;
    reels: number;
    updatedAt: Date;
  }>,
  metas: Array<{ rede: RedeSocial; metaSeguidores: number }>,
  anoAtual: number,
  mesAtual: number,
  anoAnt: number,
  mesAnt: number
): RedesResumo {
  const metaPorRede = new Map<RedeSocial, number>();
  for (const m of metas) metaPorRede.set(m.rede, m.metaSeguidores);

  const porRede = REDES_TODAS.map((rede) => {
    const dados = metricas.filter((m) => m.rede === rede);
    if (dados.length === 0) {
      return {
        rede,
        seguidoresAtual: 0,
        seguidoresAnterior: 0,
        deltaSeguidores: 0,
        metaSeguidores: metaPorRede.get(rede) ?? 0,
        progressoMeta: 0,
        alcanceMes: 0,
        engajamentoMes: 0,
        taxaEngajamento: 0,
        postsMes: 0,
        storiesMes: 0,
        reelsMes: 0,
        ultimoRegistro: null as string | null,
      };
    }

    const atual = dados.find((m) => m.ano === anoAtual && m.mes === mesAtual) ?? dados[0];
    const anterior = dados.find((m) => m.ano === anoAnt && m.mes === mesAnt);

    const meta = metaPorRede.get(rede) ?? 0;
    const seguidoresAtual = atual.seguidores;

    return {
      rede,
      seguidoresAtual,
      seguidoresAnterior: anterior?.seguidores ?? 0,
      deltaSeguidores: anterior ? seguidoresAtual - anterior.seguidores : 0,
      metaSeguidores: meta,
      progressoMeta: meta > 0 ? Math.min(1, seguidoresAtual / meta) : 0,
      alcanceMes: atual.alcance,
      engajamentoMes: atual.engajamento,
      taxaEngajamento: atual.alcance > 0 ? atual.engajamento / atual.alcance : 0,
      postsMes: atual.posts,
      storiesMes: atual.stories,
      reelsMes: atual.reels,
      ultimoRegistro: atual.updatedAt.toISOString(),
    };
  });

  return { porRede };
}

function agregarSeo(
  metricas: Array<{
    ano: number;
    mes: number;
    posicaoMedia: number;
    cliquesOrganicos: number;
    impressoes: number;
    ctr: number;
    keywordsRanqueadas: number;
    observacoes: string | null;
    updatedAt: Date;
  }>,
  keywords: Array<{
    id: string;
    keyword: string;
    posicaoAtual: number;
    posicaoAnterior: number;
    volumeEstimado: number;
    urlRanqueada: string | null;
  }>
): SeoResumo {
  if (metricas.length === 0) {
    return {
      posicaoMedia: null,
      cliquesOrganicos: null,
      impressoes: null,
      ctr: null,
      keywordsRanqueadas: null,
      observacoes: null,
      ultimoRegistro: null,
      deltaPosicao: null,
      topKeywords: [],
    };
  }

  const atual = metricas[0]; // já vem ordenado desc
  const anterior = metricas[1] ?? null;

  return {
    posicaoMedia: atual.posicaoMedia,
    cliquesOrganicos: atual.cliquesOrganicos,
    impressoes: atual.impressoes,
    ctr: atual.ctr,
    keywordsRanqueadas: atual.keywordsRanqueadas,
    observacoes: atual.observacoes,
    ultimoRegistro: atual.updatedAt.toISOString(),
    deltaPosicao: anterior ? atual.posicaoMedia - anterior.posicaoMedia : null,
    topKeywords: keywords
      .filter((k) => k.posicaoAtual > 0)
      .slice(0, 5)
      .map((k) => ({
        id: k.id,
        keyword: k.keyword,
        posicaoAtual: k.posicaoAtual,
        posicaoAnterior: k.posicaoAnterior,
        delta: k.posicaoAnterior > 0 ? k.posicaoAtual - k.posicaoAnterior : 0,
        volumeEstimado: k.volumeEstimado,
        urlRanqueada: k.urlRanqueada,
      })),
  };
}

function nomeMesCurto(mes: number): string {
  return new Date(2000, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}
