import React from "react";
import { renderToStream, Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  propostaContexto,
  expandirSecaoProposta,
  extrairTextoDeBlocos,
  formatBRL,
} from "@/lib/proposta-helpers";
import { normalizarExtras } from "@/lib/proposta-blocos";

/**
 * Gera PDF da proposta. Disponível pra usuário logado (preview interno)
 * e via link público (cliente baixa). Usa @react-pdf/renderer.
 *
 * Acessível com `?token=<shareToken>` pra contornar auth no fluxo público.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  try {
    let propostaWhere;
    if (token) {
      propostaWhere = { shareToken: token, id: params.id };
    } else {
      await requireAuth();
      propostaWhere = { id: params.id };
    }

    const proposta = await prisma.proposta.findFirst({
      where: propostaWhere,
      include: { user: { select: { name: true, email: true } } },
    });
    if (!proposta) {
      return new Response("Proposta não encontrada", { status: 404 });
    }

    const ctx = propostaContexto(
      {
        numero: proposta.numero,
        titulo: proposta.titulo,
        clienteNome: proposta.clienteNome,
        clienteEmail: proposta.clienteEmail,
        valorMensal: proposta.valorMensal ? Number(proposta.valorMensal) : null,
        valorTotal: proposta.valorTotal ? Number(proposta.valorTotal) : null,
        duracaoMeses: proposta.duracaoMeses,
        validadeDias: proposta.validadeDias,
        shareExpiraEm: proposta.shareExpiraEm,
      },
      { name: proposta.user.name, email: proposta.user.email }
    );

    const secoes = [
      { label: "Diagnóstico", conteudo: expandirSecaoProposta(proposta.diagnostico, ctx) },
      { label: "Objetivo", conteudo: expandirSecaoProposta(proposta.objetivo, ctx) },
      { label: "Estratégia & escopo", conteudo: expandirSecaoProposta(proposta.escopo, ctx) },
      { label: "Cronograma", conteudo: expandirSecaoProposta(proposta.cronograma, ctx) },
      { label: "Investimento", conteudo: expandirSecaoProposta(proposta.investimento, ctx) },
      { label: "Próximos passos", conteudo: expandirSecaoProposta(proposta.proximosPassos, ctx) },
      { label: "Termos & condições", conteudo: expandirSecaoProposta(proposta.termos, ctx) },
    ];

    const validadeStr = proposta.shareExpiraEm
      ? proposta.shareExpiraEm.toLocaleDateString("pt-BR")
      : `${proposta.validadeDias} dias após envio`;

    const corPrim = proposta.corPrimaria ?? "#7E30E1";
    const extras = normalizarExtras(proposta.extras);

    const doc = (
      <Document>
        {/* Capa */}
        <Page size="A4" style={styles.capa}>
          <View style={styles.capaTop}>
            {proposta.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={proposta.logoUrl} style={styles.capaLogo} />
            ) : (
              <>
                <Text style={styles.brand}>SAL</Text>
                <Text style={styles.brandSub}>Estratégias de Marketing</Text>
              </>
            )}
          </View>
          <View style={styles.capaCenter}>
            <Text style={styles.capaNumero}>Proposta {proposta.numero}</Text>
            <Text style={styles.capaTitulo}>{proposta.titulo}</Text>
            <View style={[styles.capaSeparador, { backgroundColor: corPrim }]} />
            <Text style={styles.capaPara}>Preparado para</Text>
            <Text style={styles.capaCliente}>{proposta.clienteNome}</Text>
          </View>
          <View style={styles.capaBottom}>
            <View>
              <Text style={styles.meta}>Por {proposta.user.name ?? "SAL"}</Text>
              <Text style={styles.meta}>{proposta.user.email ?? ""}</Text>
            </View>
            <View style={{ textAlign: "right" }}>
              <Text style={styles.meta}>Emitida {new Date().toLocaleDateString("pt-BR")}</Text>
              <Text style={styles.meta}>Válida até {validadeStr}</Text>
            </View>
          </View>
        </Page>

        {/* Capa custom (se preenchida) */}
        {proposta.capa && extrairTextoDeBlocos(expandirSecaoProposta(proposta.capa, ctx)) && (
          <Page size="A4" style={styles.page}>
            <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
            <Text style={[styles.h1, { borderBottomColor: corPrim }]}>Apresentação</Text>
            <Conteudo texto={extrairTextoDeBlocos(expandirSecaoProposta(proposta.capa, ctx))} />
            <PageFooter />
          </Page>
        )}

        {/* Demais seções */}
        {secoes.map((s, i) => {
          const texto = extrairTextoDeBlocos(s.conteudo);
          if (!texto.trim()) return null;
          return (
            <Page key={i} size="A4" style={styles.page}>
              <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
              <Text style={[styles.h1, { borderBottomColor: corPrim }]}>{s.label}</Text>

              {/* Card de números na seção "Investimento" */}
              {s.label === "Investimento" && (proposta.valorMensal || proposta.valorTotal) && (
                <View style={[styles.investBox, { borderLeftColor: corPrim, backgroundColor: hexAlpha(corPrim, 0.08) }]}>
                  {proposta.valorMensal && (
                    <View style={styles.investItem}>
                      <Text style={styles.investLabel}>Investimento mensal</Text>
                      <Text style={[styles.investValor, { color: corPrim }]}>{formatBRL(Number(proposta.valorMensal))}</Text>
                    </View>
                  )}
                  {proposta.valorTotal && (
                    <View style={styles.investItem}>
                      <Text style={styles.investLabel}>Valor total</Text>
                      <Text style={[styles.investValor, { color: corPrim }]}>{formatBRL(Number(proposta.valorTotal))}</Text>
                    </View>
                  )}
                  {proposta.duracaoMeses && (
                    <View style={styles.investItem}>
                      <Text style={styles.investLabel}>Duração</Text>
                      <Text style={[styles.investValor, { color: corPrim }]}>{proposta.duracaoMeses} meses</Text>
                    </View>
                  )}
                </View>
              )}

              <Conteudo texto={texto} />
              <PageFooter />
            </Page>
          );
        })}

        {/* Página: Cases */}
        {extras.cases?.visivel && extras.cases.cases.length > 0 && (
          <Page size="A4" style={styles.page}>
            <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
            <Text style={[styles.h1, { borderBottomColor: corPrim }]}>{extras.cases.titulo}</Text>
            {extras.cases.subtitulo && <Text style={styles.subtitulo}>{extras.cases.subtitulo}</Text>}
            <View>
              {extras.cases.cases.map((c, idx) => (
                <View key={c.id} style={[styles.cardBox, { borderLeftColor: corPrim, marginTop: idx === 0 ? 8 : 14 }]}>
                  {c.metricaPrincipal && (
                    <Text style={[styles.cardMetrica, { color: corPrim }]}>{c.metricaPrincipal}</Text>
                  )}
                  <Text style={styles.cardTitulo}>{c.cliente}</Text>
                  {c.segmento && <Text style={styles.cardSub}>{c.segmento}</Text>}
                  <Text style={styles.cardTexto}>{c.resultado}</Text>
                  {c.descricao && <Text style={styles.cardDescricao}>{c.descricao}</Text>}
                </View>
              ))}
            </View>
            <PageFooter />
          </Page>
        )}

        {/* Página: KPIs */}
        {extras.kpis?.visivel && extras.kpis.kpis.length > 0 && (
          <Page size="A4" style={styles.page}>
            <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
            <Text style={[styles.h1, { borderBottomColor: corPrim }]}>{extras.kpis.titulo}</Text>
            {extras.kpis.subtitulo && <Text style={styles.subtitulo}>{extras.kpis.subtitulo}</Text>}
            <View style={styles.kpiGrid}>
              {extras.kpis.kpis.map((k) => (
                <View key={k.id} style={[styles.kpiCardPdf, { borderColor: hexAlpha(corPrim, 0.2) }]}>
                  <Text style={styles.kpiLabelPdf}>{k.label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                    {k.valorAtual && (
                      <>
                        <Text style={styles.kpiAtualPdf}>{k.valorAtual}</Text>
                        <Text style={{ color: corPrim, fontSize: 12 }}> → </Text>
                      </>
                    )}
                    <Text style={[styles.kpiMetaPdf, { color: corPrim }]}>{k.valorMeta}</Text>
                  </View>
                  {k.variacao && <Text style={styles.kpiVariacaoPdf}>{k.variacao}</Text>}
                </View>
              ))}
            </View>
            <PageFooter />
          </Page>
        )}

        {/* Página: Pacotes */}
        {extras.pacotes?.visivel && extras.pacotes.pacotes.length > 0 && (
          <Page size="A4" style={styles.page}>
            <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
            <Text style={[styles.h1, { borderBottomColor: corPrim }]}>{extras.pacotes.titulo}</Text>
            {extras.pacotes.subtitulo && <Text style={styles.subtitulo}>{extras.pacotes.subtitulo}</Text>}
            <View style={styles.pacoteGrid}>
              {extras.pacotes.pacotes.map((p) => (
                <View
                  key={p.id}
                  style={[
                    styles.pacoteBoxPdf,
                    p.destaque && {
                      borderColor: corPrim,
                      borderWidth: 2,
                      backgroundColor: hexAlpha(corPrim, 0.04),
                    },
                  ]}
                >
                  {p.destaque && (
                    <Text style={[styles.pacoteBadgePdf, { backgroundColor: corPrim, color: "#FFFFFF" }]}>
                      RECOMENDADO
                    </Text>
                  )}
                  {p.subtitulo && <Text style={styles.pacoteSubPdf}>{p.subtitulo}</Text>}
                  <Text style={styles.pacoteNomePdf}>{p.nome}</Text>
                  <Text style={[styles.pacoteValorPdf, { color: corPrim }]}>{p.valor}</Text>
                  <View style={{ marginTop: 8 }}>
                    {p.features.map((f, idx) => (
                      <Text
                        key={idx}
                        style={[
                          styles.pacoteFeaturePdf,
                          f.destaque && { fontWeight: 700, color: "#1F1F2D" },
                        ]}
                      >
                        {f.incluso ? "✓ " : "—  "}
                        {f.texto}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <PageFooter />
          </Page>
        )}

        {/* Página: Equipe */}
        {extras.equipe?.visivel && extras.equipe.membros.length > 0 && (
          <Page size="A4" style={styles.page}>
            <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
            <Text style={[styles.h1, { borderBottomColor: corPrim }]}>{extras.equipe.titulo}</Text>
            {extras.equipe.subtitulo && <Text style={styles.subtitulo}>{extras.equipe.subtitulo}</Text>}
            <View style={styles.equipeGrid}>
              {extras.equipe.membros.map((m) => (
                <View key={m.id} style={styles.membroBox}>
                  {m.fotoUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={m.fotoUrl} style={[styles.membroFotoPdf, { borderColor: corPrim }]} />
                  ) : (
                    <View
                      style={[
                        styles.membroFotoPdf,
                        styles.membroFotoFallbackPdf,
                        { borderColor: corPrim },
                      ]}
                    >
                      <Text style={{ fontSize: 24, color: corPrim, fontWeight: 700 }}>
                        {m.nome.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.membroNomePdf}>{m.nome}</Text>
                  <Text style={[styles.membroCargoPdf, { color: corPrim }]}>{m.cargo}</Text>
                  {m.bio && <Text style={styles.membroBioPdf}>{m.bio}</Text>}
                </View>
              ))}
            </View>
            <PageFooter />
          </Page>
        )}

        {/* Página: FAQ */}
        {extras.faq?.visivel && extras.faq.perguntas.length > 0 && (
          <Page size="A4" style={styles.page}>
            <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
            <Text style={[styles.h1, { borderBottomColor: corPrim }]}>{extras.faq.titulo}</Text>
            {extras.faq.subtitulo && <Text style={styles.subtitulo}>{extras.faq.subtitulo}</Text>}
            <View>
              {extras.faq.perguntas.map((f) => (
                <View key={f.id} style={styles.faqItem}>
                  <Text style={styles.faqPergunta}>{f.pergunta}</Text>
                  <Text style={styles.faqResposta}>{f.resposta}</Text>
                </View>
              ))}
            </View>
            <PageFooter />
          </Page>
        )}
      </Document>
    );

    const stream = await renderToStream(doc);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) chunks.push(chunk);

    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proposta-${proposta.numero}.pdf"`,
      },
    });
  } catch (e) {
    return apiHandler(async () => {
      throw e;
    });
  }
}

// ─── Componentes auxiliares ──────────────────────────────────────

function PageHeader({ numero, cliente, cor }: { numero: string; cliente: string; cor: string }) {
  return (
    <View style={styles.pageHeader} fixed>
      <Text style={[styles.pageHeaderBrand, { color: cor }]}>Proposta {numero}</Text>
      <Text style={styles.pageHeaderCliente}>{cliente}</Text>
    </View>
  );
}

/** Converte hex + alpha em rgba pra usar em backgrounds suaves (react-pdf não tem color-mix) */
function hexAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return `rgba(126, 48, 225, ${alpha})`;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function PageFooter() {
  return (
    <Text
      style={styles.pageFooter}
      fixed
      render={({ pageNumber, totalPages }) =>
        `Página ${pageNumber} de ${totalPages} · SAL Estratégias de Marketing`
      }
    />
  );
}

function Conteudo({ texto }: { texto: string }) {
  // Quebra em parágrafos respeitando heurística (# heading, - bullet, etc)
  const linhas = texto.split("\n");
  return (
    <View>
      {linhas.map((linha, i) => {
        const trimmed = linha.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("# ")) {
          return <Text key={i} style={styles.h1Inline}>{trimmed.slice(2)}</Text>;
        }
        if (trimmed.startsWith("## ")) {
          return <Text key={i} style={styles.h2}>{trimmed.slice(3)}</Text>;
        }
        if (trimmed.startsWith("### ")) {
          return <Text key={i} style={styles.h3}>{trimmed.slice(4)}</Text>;
        }
        if (trimmed.startsWith("- ")) {
          return (
            <Text key={i} style={styles.bullet}>
              • {trimmed.slice(2)}
            </Text>
          );
        }
        const checkMatch = trimmed.match(/^\[([ xX])\]\s+(.+)$/);
        if (checkMatch) {
          const checked = checkMatch[1].toLowerCase() === "x";
          return (
            <Text key={i} style={styles.bullet}>
              {checked ? "✓ " : "○ "}
              {checkMatch[2]}
            </Text>
          );
        }
        return (
          <Text key={i} style={styles.p}>
            {trimmed}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  capa: {
    backgroundColor: "#0E0E14",
    color: "#FFFFFF",
    padding: 60,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  capaTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  capaLogo: { maxHeight: 56, maxWidth: 200, objectFit: "contain" },
  brand: { fontSize: 36, fontWeight: 700, color: "#B794F4", letterSpacing: 2 },
  brandSub: { fontSize: 9, color: "#9696A8", textTransform: "uppercase", letterSpacing: 2, marginLeft: 4 },
  capaCenter: { marginTop: 80 },
  capaNumero: { fontSize: 10, color: "#9696A8", letterSpacing: 3, textTransform: "uppercase" },
  capaTitulo: { fontSize: 36, fontWeight: 700, color: "#FFFFFF", marginTop: 8, lineHeight: 1.2 },
  capaSeparador: { width: 60, height: 3, backgroundColor: "#7E30E1", marginTop: 24, marginBottom: 24 },
  capaPara: { fontSize: 10, color: "#9696A8", letterSpacing: 2, textTransform: "uppercase" },
  capaCliente: { fontSize: 24, fontWeight: 700, color: "#FFFFFF", marginTop: 4 },
  capaBottom: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#1F1F2D", paddingTop: 16 },
  meta: { fontSize: 9, color: "#9696A8", marginBottom: 2 },

  page: {
    padding: 60,
    paddingTop: 70,
    paddingBottom: 50,
    fontSize: 11,
    color: "#1F1F2D",
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  pageHeader: {
    position: "absolute",
    top: 30,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EE",
    paddingBottom: 6,
  },
  pageHeaderBrand: { fontSize: 9, fontWeight: 700, color: "#7E30E1", letterSpacing: 1 },
  pageHeaderCliente: { fontSize: 9, color: "#64748B" },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 60,
    right: 60,
    textAlign: "center",
    fontSize: 8,
    color: "#94A3B8",
  },

  h1: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1F1F2D",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#7E30E1",
    paddingBottom: 6,
  },
  h1Inline: { fontSize: 16, fontWeight: 700, color: "#1F1F2D", marginTop: 12, marginBottom: 6 },
  h2: { fontSize: 13, fontWeight: 700, color: "#1F1F2D", marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 11, fontWeight: 700, color: "#475569", marginTop: 8, marginBottom: 2 },
  p: { fontSize: 11, color: "#1F1F2D", marginBottom: 6 },
  bullet: { fontSize: 11, color: "#1F1F2D", marginBottom: 4, paddingLeft: 12 },

  investBox: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#F5EFFE",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#7E30E1",
  },
  investItem: { flex: 1 },
  investLabel: { fontSize: 8, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  investValor: { fontSize: 18, fontWeight: 700, color: "#54199F", marginTop: 4 },

  // ─── Blocos extras ───
  subtitulo: { fontSize: 10, color: "#64748B", marginBottom: 16, marginTop: -8 },

  // Cases
  cardBox: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#FAFAFC",
    borderLeftWidth: 3,
    borderLeftColor: "#7E30E1",
  },
  cardMetrica: { fontSize: 24, fontWeight: 800, color: "#7E30E1", marginBottom: 4 },
  cardTitulo: { fontSize: 13, fontWeight: 700, color: "#1F1F2D" },
  cardSub: { fontSize: 8, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  cardTexto: { fontSize: 11, color: "#1F1F2D", marginTop: 4, fontWeight: 500 },
  cardDescricao: { fontSize: 9, color: "#64748B", marginTop: 4, lineHeight: 1.5 },

  // KPIs
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  kpiCardPdf: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    width: "31%",
    minHeight: 80,
    backgroundColor: "#FAFAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLabelPdf: { fontSize: 7.5, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, textAlign: "center" },
  kpiAtualPdf: { fontSize: 12, color: "#94A3B8", textDecoration: "line-through", fontWeight: 700 },
  kpiMetaPdf: { fontSize: 22, fontWeight: 800, color: "#7E30E1" },
  kpiVariacaoPdf: { fontSize: 9, color: "#10B981", fontWeight: 700, marginTop: 4 },

  // Pacotes
  pacoteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  pacoteBoxPdf: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5EE",
    width: "31%",
    backgroundColor: "#FAFAFC",
  },
  pacoteBadgePdf: {
    fontSize: 7,
    fontWeight: 700,
    padding: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: 1,
  },
  pacoteSubPdf: { fontSize: 7.5, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1.2 },
  pacoteNomePdf: { fontSize: 14, fontWeight: 700, color: "#1F1F2D", marginTop: 2 },
  pacoteValorPdf: { fontSize: 16, fontWeight: 700, marginTop: 4 },
  pacoteFeaturePdf: { fontSize: 8.5, color: "#475569", marginBottom: 4, lineHeight: 1.4 },

  // Equipe
  equipeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12, justifyContent: "center" },
  membroBox: { width: "28%", alignItems: "center", textAlign: "center", marginBottom: 14 },
  membroFotoPdf: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, marginBottom: 6, objectFit: "cover" },
  membroFotoFallbackPdf: { alignItems: "center", justifyContent: "center", backgroundColor: "#F5EFFE" },
  membroNomePdf: { fontSize: 11, fontWeight: 700, color: "#1F1F2D" },
  membroCargoPdf: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  membroBioPdf: { fontSize: 9, color: "#64748B", marginTop: 6, lineHeight: 1.4, textAlign: "center" },

  // FAQ
  faqItem: { padding: 10, marginTop: 8, borderRadius: 8, backgroundColor: "#FAFAFC", borderWidth: 1, borderColor: "#E5E5EE" },
  faqPergunta: { fontSize: 11, fontWeight: 700, color: "#1F1F2D" },
  faqResposta: { fontSize: 10, color: "#475569", marginTop: 4, lineHeight: 1.5 },
});
