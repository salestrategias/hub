import React from "react";
import { renderToStream, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  propostaContexto,
  expandirSecaoProposta,
  extrairTextoDeBlocos,
  formatBRL,
} from "@/lib/proposta-helpers";

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

    const doc = (
      <Document>
        {/* Capa */}
        <Page size="A4" style={styles.capa}>
          <View style={styles.capaTop}>
            <Text style={styles.brand}>SAL</Text>
            <Text style={styles.brandSub}>Estratégias de Marketing</Text>
          </View>
          <View style={styles.capaCenter}>
            <Text style={styles.capaNumero}>Proposta {proposta.numero}</Text>
            <Text style={styles.capaTitulo}>{proposta.titulo}</Text>
            <View style={styles.capaSeparador} />
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
            <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} />
            <Text style={styles.h1}>Apresentação</Text>
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
              <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} />
              <Text style={styles.h1}>{s.label}</Text>

              {/* Card de números na seção "Investimento" */}
              {s.label === "Investimento" && (proposta.valorMensal || proposta.valorTotal) && (
                <View style={styles.investBox}>
                  {proposta.valorMensal && (
                    <View style={styles.investItem}>
                      <Text style={styles.investLabel}>Investimento mensal</Text>
                      <Text style={styles.investValor}>{formatBRL(Number(proposta.valorMensal))}</Text>
                    </View>
                  )}
                  {proposta.valorTotal && (
                    <View style={styles.investItem}>
                      <Text style={styles.investLabel}>Valor total</Text>
                      <Text style={styles.investValor}>{formatBRL(Number(proposta.valorTotal))}</Text>
                    </View>
                  )}
                  {proposta.duracaoMeses && (
                    <View style={styles.investItem}>
                      <Text style={styles.investLabel}>Duração</Text>
                      <Text style={styles.investValor}>{proposta.duracaoMeses} meses</Text>
                    </View>
                  )}
                </View>
              )}

              <Conteudo texto={texto} />
              <PageFooter />
            </Page>
          );
        })}
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

function PageHeader({ numero, cliente }: { numero: string; cliente: string }) {
  return (
    <View style={styles.pageHeader} fixed>
      <Text style={styles.pageHeaderBrand}>SAL · Proposta {numero}</Text>
      <Text style={styles.pageHeaderCliente}>{cliente}</Text>
    </View>
  );
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
  capaTop: { flexDirection: "row", alignItems: "baseline", gap: 8 },
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
});
