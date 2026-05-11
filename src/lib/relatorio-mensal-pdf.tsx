/**
 * Componente PDF do relatório mensal por cliente.
 *
 * Estrutura: 1 página A4 quando tem pouco dado, expande pra 2-4 páginas
 * automaticamente conforme as seções crescem (react-pdf quebra páginas
 * sozinho com `wrap`).
 *
 * Seções (na ordem):
 *  1. Capa + resumo executivo (KPIs principais do mês)
 *  2. Redes sociais — uma tabela por rede ativa, com KPIs + comparativo MoM
 *  3. SEO — KPIs + ranking de keywords
 *  4. Tráfego pago — totais + tabela de campanhas
 *  5. Conteúdo publicado
 *  6. Operacional — tarefas entregues + reuniões realizadas
 *
 * Seções sem dados (`temDados=false`) são escondidas pra não criar
 * página em branco. Cliente que não faz SEO não vê seção SEO.
 *
 * Paleta SAL: roxo #7E30E1 no header, cor neutra no corpo (legibilidade
 * em impressão B&W também). KPIs verdes/vermelhos pro delta.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { RelatorioMensalData } from "@/lib/relatorio-mensal-data";
import { delta } from "@/lib/relatorio-mensal-data";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const COR_SAL = "#7E30E1";
const COR_DARK = "#54199F";
const COR_TEXTO = "#0F172A";
const COR_MUTED = "#64748B";
const COR_BORDA = "#E2E8F0";
const COR_FUNDO_LEVE = "#F8FAFC";
const VERDE = "#10B981";
const VERMELHO = "#EF4444";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: COR_TEXTO, fontFamily: "Helvetica" },

  // Capa
  capaHeader: {
    backgroundColor: COR_SAL,
    margin: -40,
    marginBottom: 24,
    padding: 40,
    paddingTop: 60,
    paddingBottom: 40,
  },
  capaBrand: { color: "#ffffff", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", opacity: 0.85 },
  capaTitulo: { color: "#ffffff", fontSize: 28, fontWeight: 700, marginTop: 8 },
  capaCliente: { color: "#ffffff", fontSize: 18, marginTop: 6, opacity: 0.95 },
  capaPeriodo: { color: "#ffffff", fontSize: 12, marginTop: 4, opacity: 0.8 },

  // Headers compactos (páginas seguintes)
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: COR_SAL,
    paddingBottom: 8,
    marginBottom: 14,
  },
  pageHeaderBrand: { fontSize: 12, fontWeight: 700, color: COR_SAL },
  pageHeaderSub: { fontSize: 9, color: COR_MUTED },

  // Section titles
  h1: { fontSize: 16, fontWeight: 700, marginTop: 8, marginBottom: 12, color: COR_DARK },
  h2: { fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 8, color: COR_TEXTO },
  h3: { fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 6, color: COR_TEXTO },

  // KPIs em grid
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  kpi: {
    borderWidth: 1,
    borderColor: COR_BORDA,
    borderRadius: 4,
    padding: 8,
    width: 110,
  },
  kpiLabel: { fontSize: 7, color: COR_MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  kpiDelta: { fontSize: 7, marginTop: 1 },

  // Tabela
  table: { borderWidth: 1, borderColor: COR_BORDA, borderRadius: 4, marginTop: 4 },
  trHead: { flexDirection: "row", backgroundColor: COR_FUNDO_LEVE, padding: 5 },
  tr: { flexDirection: "row", padding: 5, borderTopWidth: 1, borderTopColor: COR_BORDA },
  cell: { fontSize: 8.5, flex: 1 },
  cellNum: { fontSize: 8.5, flex: 1, textAlign: "right" },

  // Empty state
  empty: { color: COR_MUTED, fontSize: 9, fontStyle: "italic", marginVertical: 6 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: COR_MUTED,
  },
});

export function RelatorioMensalPdf({ data }: { data: RelatorioMensalData }) {
  const periodoLabel = `${MESES[data.mes - 1]} de ${data.ano}`;

  return (
    <Document
      title={`Relatório mensal · ${data.cliente.nome} · ${periodoLabel}`}
      author="SAL Estratégias de Marketing"
    >
      {/* ── Página 1: Capa + KPIs principais ── */}
      <Page size="A4" style={s.page}>
        <View style={s.capaHeader}>
          <Text style={s.capaBrand}>SAL · Estratégias de Marketing</Text>
          <Text style={s.capaTitulo}>Relatório mensal</Text>
          <Text style={s.capaCliente}>{data.cliente.nome}</Text>
          <Text style={s.capaPeriodo}>{periodoLabel}</Text>
        </View>

        <Text style={s.h1}>Resumo executivo</Text>
        <ResumoExecutivo data={data} />

        <Footer />
      </Page>

      {/* ── Página(s) seguintes: detalhamento ── */}
      {(data.redes.temDados || data.seo.temDados || data.trafego.temDados ||
        data.conteudo.temDados || data.operacional.temDados) && (
        <Page size="A4" style={s.page} wrap>
          <PageHeader cliente={data.cliente.nome} periodo={periodoLabel} />

          {data.redes.temDados && <SecaoRedes redes={data.redes.porRede} />}
          {data.seo.temDados && <SecaoSeo data={data.seo} />}
          {data.trafego.temDados && <SecaoTrafego data={data.trafego} />}
          {data.conteudo.temDados && <SecaoConteudo posts={data.conteudo.posts} />}
          {data.operacional.temDados && (
            <SecaoOperacional
              tarefas={data.operacional.tarefasConcluidas}
              reunioes={data.operacional.reunioes}
            />
          )}

          <Footer />
        </Page>
      )}
    </Document>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────

function PageHeader({ cliente, periodo }: { cliente: string; periodo: string }) {
  return (
    <View style={s.pageHeader}>
      <Text style={s.pageHeaderBrand}>SAL Hub</Text>
      <Text style={s.pageHeaderSub}>{cliente} · {periodo}</Text>
    </View>
  );
}

function Footer() {
  return (
    <Text style={s.footer} fixed>
      SAL Estratégias de Marketing · Relatório gerado em {new Date().toLocaleDateString("pt-BR")}
    </Text>
  );
}

function ResumoExecutivo({ data }: { data: RelatorioMensalData }) {
  // Agrega TOTAL de seguidores entre todas as redes (KPI macro)
  const totalSeguidores = data.redes.porRede.reduce((sum, r) => sum + r.atual.seguidores, 0);
  const totalSeguidoresAnt = data.redes.porRede.reduce((sum, r) => sum + (r.anterior?.seguidores ?? 0), 0);
  const totalEngajamento = data.redes.porRede.reduce((sum, r) => sum + r.atual.engajamento, 0);
  const totalAlcance = data.redes.porRede.reduce((sum, r) => sum + r.atual.alcance, 0);

  const kpis: Array<{ label: string; value: string; delta: number | null }> = [];

  if (data.redes.temDados) {
    kpis.push({
      label: "Seguidores totais",
      value: formatNum(totalSeguidores),
      delta: delta(totalSeguidores, totalSeguidoresAnt),
    });
    kpis.push({
      label: "Alcance total",
      value: formatNum(totalAlcance),
      delta: null,
    });
    kpis.push({
      label: "Engajamento total",
      value: formatNum(totalEngajamento),
      delta: null,
    });
  }

  if (data.seo.atual) {
    kpis.push({
      label: "Cliques orgânicos",
      value: formatNum(data.seo.atual.cliquesOrganicos),
      delta: delta(data.seo.atual.cliquesOrganicos, data.seo.anterior?.cliquesOrganicos ?? null),
    });
  }

  if (data.trafego.temDados) {
    kpis.push({
      label: "Invest. tráfego pago",
      value: formatBRL(data.trafego.totais.investimento),
      delta: null,
    });
    kpis.push({
      label: "ROAS médio",
      value: data.trafego.totais.roasMedio.toFixed(2) + "x",
      delta: null,
    });
  }

  kpis.push({
    label: "Conteúdo publicado",
    value: String(data.conteudo.posts.length),
    delta: null,
  });

  kpis.push({
    label: "Tarefas entregues",
    value: String(data.operacional.tarefasConcluidas.length),
    delta: null,
  });

  if (kpis.length === 0) {
    return <Text style={s.empty}>Sem métricas registradas para esse mês.</Text>;
  }

  return (
    <View style={s.kpiGrid}>
      {kpis.map((k) => (
        <View key={k.label} style={s.kpi}>
          <Text style={s.kpiLabel}>{k.label}</Text>
          <Text style={s.kpiValue}>{k.value}</Text>
          {k.delta !== null && (
            <Text style={[s.kpiDelta, { color: k.delta >= 0 ? VERDE : VERMELHO }]}>
              {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta).toFixed(1)}% vs mês ant.
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function SecaoRedes({ redes }: { redes: RelatorioMensalData["redes"]["porRede"] }) {
  return (
    <View>
      <Text style={s.h2}>Redes sociais</Text>
      {redes.map((r) => (
        <View key={r.rede} wrap={false} style={{ marginBottom: 10 }}>
          <Text style={s.h3}>{nomeRede(r.rede)}</Text>
          <View style={s.kpiGrid}>
            {[
              { l: "Seguidores", a: r.atual.seguidores, p: r.anterior?.seguidores ?? null },
              { l: "Alcance", a: r.atual.alcance, p: r.anterior?.alcance ?? null },
              { l: "Impressões", a: r.atual.impressoes, p: r.anterior?.impressoes ?? null },
              { l: "Engajamento", a: r.atual.engajamento, p: r.anterior?.engajamento ?? null },
              { l: "Posts", a: r.atual.posts, p: r.anterior?.posts ?? null },
              { l: "Stories", a: r.atual.stories, p: r.anterior?.stories ?? null },
              { l: "Reels", a: r.atual.reels, p: r.anterior?.reels ?? null },
            ].map((k) => {
              const d = delta(k.a, k.p);
              return (
                <View key={k.l} style={s.kpi}>
                  <Text style={s.kpiLabel}>{k.l}</Text>
                  <Text style={s.kpiValue}>{formatNum(k.a)}</Text>
                  {d !== null && (
                    <Text style={[s.kpiDelta, { color: d >= 0 ? VERDE : VERMELHO }]}>
                      {d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}%
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function SecaoSeo({ data }: { data: RelatorioMensalData["seo"] }) {
  if (!data.atual) return null;
  return (
    <View wrap={false}>
      <Text style={s.h2}>SEO orgânico</Text>
      <View style={s.kpiGrid}>
        {[
          {
            l: "Posição média",
            v: data.atual.posicaoMedia.toFixed(1),
            d: data.anterior ? -delta(data.atual.posicaoMedia, data.anterior.posicaoMedia)! : null, // invertido: menor é melhor
          },
          {
            l: "Cliques orgânicos",
            v: formatNum(data.atual.cliquesOrganicos),
            d: delta(data.atual.cliquesOrganicos, data.anterior?.cliquesOrganicos ?? null),
          },
          {
            l: "Impressões",
            v: formatNum(data.atual.impressoes),
            d: delta(data.atual.impressoes, data.anterior?.impressoes ?? null),
          },
          {
            l: "CTR",
            v: (data.atual.ctr * 100).toFixed(2) + "%",
            d: delta(data.atual.ctr, data.anterior?.ctr ?? null),
          },
          {
            l: "Keywords ranqueadas",
            v: String(data.atual.keywordsRanqueadas),
            d: delta(data.atual.keywordsRanqueadas, data.anterior?.keywordsRanqueadas ?? null),
          },
        ].map((k) => (
          <View key={k.l} style={s.kpi}>
            <Text style={s.kpiLabel}>{k.l}</Text>
            <Text style={s.kpiValue}>{k.v}</Text>
            {k.d !== null && (
              <Text style={[s.kpiDelta, { color: k.d >= 0 ? VERDE : VERMELHO }]}>
                {k.d >= 0 ? "▲" : "▼"} {Math.abs(k.d).toFixed(1)}%
              </Text>
            )}
          </View>
        ))}
      </View>

      {data.keywords.length > 0 && (
        <>
          <Text style={s.h3}>Top keywords monitoradas</Text>
          <View style={s.table}>
            <View style={s.trHead}>
              <Text style={[s.cell, { flex: 3 }]}>Keyword</Text>
              <Text style={s.cellNum}>Pos. atual</Text>
              <Text style={s.cellNum}>Anterior</Text>
              <Text style={s.cellNum}>Variação</Text>
            </View>
            {data.keywords.slice(0, 10).map((k) => {
              const variacao = k.posicaoAnterior - k.posicaoAtual; // positivo = subiu nas SERPs
              return (
                <View key={k.keyword} style={s.tr}>
                  <Text style={[s.cell, { flex: 3 }]}>{k.keyword}</Text>
                  <Text style={s.cellNum}>{k.posicaoAtual || "—"}</Text>
                  <Text style={s.cellNum}>{k.posicaoAnterior || "—"}</Text>
                  <Text
                    style={[
                      s.cellNum,
                      { color: variacao > 0 ? VERDE : variacao < 0 ? VERMELHO : COR_MUTED },
                    ]}
                  >
                    {variacao > 0 ? `+${variacao}` : variacao || "—"}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function SecaoTrafego({ data }: { data: RelatorioMensalData["trafego"] }) {
  return (
    <View>
      <Text style={s.h2}>Tráfego pago</Text>
      <View style={s.kpiGrid}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Investimento</Text>
          <Text style={s.kpiValue}>{formatBRL(data.totais.investimento)}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Conversões</Text>
          <Text style={s.kpiValue}>{formatNum(data.totais.conversoes)}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>CPA médio</Text>
          <Text style={s.kpiValue}>{formatBRL(data.totais.cpaMedio)}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>ROAS médio</Text>
          <Text style={s.kpiValue}>{data.totais.roasMedio.toFixed(2)}x</Text>
        </View>
      </View>

      <Text style={s.h3}>Campanhas do mês</Text>
      <View style={s.table}>
        <View style={s.trHead}>
          <Text style={[s.cell, { flex: 2 }]}>Campanha</Text>
          <Text style={s.cell}>Plataforma</Text>
          <Text style={s.cellNum}>Invest.</Text>
          <Text style={s.cellNum}>Conv.</Text>
          <Text style={s.cellNum}>CPA</Text>
          <Text style={s.cellNum}>ROAS</Text>
        </View>
        {data.campanhas.map((c, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.cell, { flex: 2 }]}>{c.nome}</Text>
            <Text style={s.cell}>{nomePlataforma(c.plataforma)}</Text>
            <Text style={s.cellNum}>{formatBRL(c.investimento)}</Text>
            <Text style={s.cellNum}>{c.conversoes}</Text>
            <Text style={s.cellNum}>{formatBRL(c.cpa)}</Text>
            <Text style={s.cellNum}>{c.roas.toFixed(2)}x</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SecaoConteudo({ posts }: { posts: RelatorioMensalData["conteudo"]["posts"] }) {
  return (
    <View>
      <Text style={s.h2}>Conteúdo publicado</Text>
      <View style={s.table}>
        <View style={s.trHead}>
          <Text style={s.cell}>Data</Text>
          <Text style={[s.cell, { flex: 3 }]}>Título</Text>
          <Text style={s.cell}>Formato</Text>
          <Text style={s.cell}>Status</Text>
        </View>
        {posts.map((p, i) => (
          <View key={i} style={s.tr}>
            <Text style={s.cell}>{p.dataPublicacao.toLocaleDateString("pt-BR")}</Text>
            <Text style={[s.cell, { flex: 3 }]}>{p.titulo}</Text>
            <Text style={s.cell}>{p.formato.toLowerCase()}</Text>
            <Text style={s.cell}>{p.status.toLowerCase().replace(/_/g, " ")}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SecaoOperacional({
  tarefas,
  reunioes,
}: {
  tarefas: RelatorioMensalData["operacional"]["tarefasConcluidas"];
  reunioes: RelatorioMensalData["operacional"]["reunioes"];
}) {
  return (
    <View>
      <Text style={s.h2}>Operacional</Text>

      {tarefas.length > 0 && (
        <>
          <Text style={s.h3}>Tarefas entregues ({tarefas.length})</Text>
          <View style={s.table}>
            <View style={s.trHead}>
              <Text style={s.cell}>Concluída em</Text>
              <Text style={[s.cell, { flex: 3 }]}>Tarefa</Text>
              <Text style={s.cell}>Prioridade</Text>
            </View>
            {tarefas.slice(0, 20).map((t, i) => (
              <View key={i} style={s.tr}>
                <Text style={s.cell}>{t.concluidaEm.toLocaleDateString("pt-BR")}</Text>
                <Text style={[s.cell, { flex: 3 }]}>{t.titulo}</Text>
                <Text style={s.cell}>{t.prioridade.toLowerCase()}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {reunioes.length > 0 && (
        <>
          <Text style={s.h3}>Reuniões realizadas ({reunioes.length})</Text>
          <View style={s.table}>
            <View style={s.trHead}>
              <Text style={s.cell}>Data</Text>
              <Text style={[s.cell, { flex: 3 }]}>Título</Text>
              <Text style={s.cellNum}>Duração</Text>
            </View>
            {reunioes.map((r, i) => (
              <View key={i} style={s.tr}>
                <Text style={s.cell}>
                  {r.data.toLocaleDateString("pt-BR")} {r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <Text style={[s.cell, { flex: 3 }]}>{r.titulo}</Text>
                <Text style={s.cellNum}>
                  {r.duracaoSeg ? `${Math.round(r.duracaoSeg / 60)} min` : "—"}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatNum(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function nomeRede(r: string): string {
  const map: Record<string, string> = {
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    LINKEDIN: "LinkedIn",
    TIKTOK: "TikTok",
    YOUTUBE: "YouTube",
  };
  return map[r] ?? r;
}

function nomePlataforma(p: string): string {
  const map: Record<string, string> = {
    META_ADS: "Meta",
    GOOGLE_ADS: "Google",
    TIKTOK_ADS: "TikTok",
    YOUTUBE_ADS: "YouTube",
    LINKEDIN_ADS: "LinkedIn",
  };
  return map[p] ?? p;
}
