import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { Document, Page, Text, View, PdfHeader, PdfFooter, pdfStyles } from "@/lib/pdf";
import { formatNumber, MES_NOMES } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId")!;
    const [cliente, metricas, keywords] = await Promise.all([
      prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } }),
      prisma.metricaSeo.findMany({ where: { clienteId }, orderBy: [{ ano: "asc" }, { mes: "asc" }] }),
      prisma.seoKeyword.findMany({ where: { clienteId }, orderBy: { posicaoAtual: "asc" } }),
    ]);
    const ultima = metricas[metricas.length - 1];

    const doc = (
      <Document>
        <Page size="A4" style={pdfStyles.page}>
          <PdfHeader titulo="Relatório SEO" cliente={cliente.nome} periodo={ultima ? `${MES_NOMES[ultima.mes - 1]}/${ultima.ano}` : ""} />
          <Text style={pdfStyles.h1}>Indicadores</Text>
          <View style={pdfStyles.kpiGrid}>
            {ultima && [
              { l: "Posição média", v: ultima.posicaoMedia.toFixed(1) },
              { l: "Cliques orgânicos", v: formatNumber(ultima.cliquesOrganicos) },
              { l: "Impressões", v: formatNumber(ultima.impressoes) },
              { l: "CTR", v: `${(ultima.ctr * 100).toFixed(2)}%` },
              { l: "Keywords ranqueadas", v: formatNumber(ultima.keywordsRanqueadas) },
            ].map((k) => (
              <View key={k.l} style={pdfStyles.kpi}>
                <Text style={pdfStyles.kpiLabel}>{k.l}</Text>
                <Text style={pdfStyles.kpiValue}>{k.v}</Text>
              </View>
            ))}
          </View>

          <Text style={pdfStyles.h2}>Histórico mensal</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.trHead}>
              {["Mês", "Pos. média", "Cliques", "Impressões", "CTR"].map((h) => <Text key={h} style={pdfStyles.cell}>{h}</Text>)}
            </View>
            {metricas.map((m) => (
              <View key={m.id} style={pdfStyles.tr}>
                <Text style={pdfStyles.cell}>{MES_NOMES[m.mes - 1]}/{m.ano}</Text>
                <Text style={pdfStyles.cell}>{m.posicaoMedia.toFixed(1)}</Text>
                <Text style={pdfStyles.cell}>{formatNumber(m.cliquesOrganicos)}</Text>
                <Text style={pdfStyles.cell}>{formatNumber(m.impressoes)}</Text>
                <Text style={pdfStyles.cell}>{(m.ctr * 100).toFixed(2)}%</Text>
              </View>
            ))}
          </View>

          <Text style={pdfStyles.h2}>Keywords monitoradas</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.trHead}>
              {["Keyword", "Pos. atual", "Anterior", "Δ", "Volume"].map((h) => <Text key={h} style={pdfStyles.cell}>{h}</Text>)}
            </View>
            {keywords.map((k) => {
              const delta = k.posicaoAnterior - k.posicaoAtual;
              return (
                <View key={k.id} style={pdfStyles.tr}>
                  <Text style={pdfStyles.cell}>{k.keyword}</Text>
                  <Text style={pdfStyles.cell}>{k.posicaoAtual}</Text>
                  <Text style={pdfStyles.cell}>{k.posicaoAnterior}</Text>
                  <Text style={[pdfStyles.cell, { color: delta > 0 ? "#10B981" : delta < 0 ? "#EF4444" : "#64748B" }]}>{delta > 0 ? `+${delta}` : delta}</Text>
                  <Text style={pdfStyles.cell}>{formatNumber(k.volumeEstimado)}</Text>
                </View>
              );
            })}
          </View>

          {ultima?.observacoes && (
            <>
              <Text style={pdfStyles.h2}>Observações e recomendações</Text>
              <View style={pdfStyles.card}><Text>{ultima.observacoes}</Text></View>
            </>
          )}

          <PdfFooter />
        </Page>
      </Document>
    );

    const stream = await renderToStream(doc);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) chunks.push(chunk);
    return new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="seo-${cliente.nome}.pdf"` },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}
