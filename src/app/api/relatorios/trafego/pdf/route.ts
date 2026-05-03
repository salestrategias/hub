import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { Document, Page, Text, View, PdfHeader, PdfFooter, pdfStyles } from "@/lib/pdf";
import { formatBRL, MES_NOMES } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId")!;
    const [cliente, camps] = await Promise.all([
      prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } }),
      prisma.campanhaPaga.findMany({ where: { clienteId }, orderBy: [{ ano: "desc" }, { mes: "desc" }] }),
    ]);

    const inv = camps.reduce((s, c) => s + Number(c.investimento), 0);
    const conv = camps.reduce((s, c) => s + c.conversoes, 0);
    const roas = camps.length ? camps.reduce((s, c) => s + c.roas, 0) / camps.length : 0;
    const cpa = camps.length ? camps.reduce((s, c) => s + Number(c.cpa), 0) / camps.length : 0;

    const doc = (
      <Document>
        {/* Capa */}
        <Page size="A4" style={pdfStyles.page}>
          <View style={{ height: "100%", justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 28, color: "#F59E0B", fontWeight: 700 }}>SAL Hub</Text>
            <Text style={{ fontSize: 10, color: "#64748B", letterSpacing: 2, marginBottom: 40 }}>ESTRATÉGIAS DE MARKETING</Text>
            <Text style={{ fontSize: 22, fontWeight: 700 }}>Relatório de Tráfego Pago</Text>
            <Text style={{ fontSize: 14, marginTop: 8, color: "#475569" }}>{cliente.nome}</Text>
            <Text style={{ fontSize: 10, marginTop: 4, color: "#94A3B8" }}>Gerado em {new Date().toLocaleDateString("pt-BR")}</Text>
          </View>
        </Page>

        {/* Conteúdo */}
        <Page size="A4" style={pdfStyles.page}>
          <PdfHeader titulo="Tráfego Pago" cliente={cliente.nome} periodo={`${camps.length} campanhas`} />
          <Text style={pdfStyles.h1}>Resumo consolidado</Text>
          <View style={pdfStyles.kpiGrid}>
            {[
              { l: "Investimento", v: formatBRL(inv) },
              { l: "Conversões", v: String(conv) },
              { l: "ROAS médio", v: roas.toFixed(2) + "x" },
              { l: "CPA médio", v: formatBRL(cpa) },
            ].map((k) => (
              <View key={k.l} style={pdfStyles.kpi}>
                <Text style={pdfStyles.kpiLabel}>{k.l}</Text>
                <Text style={pdfStyles.kpiValue}>{k.v}</Text>
              </View>
            ))}
          </View>

          <Text style={pdfStyles.h2}>Campanhas</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.trHead}>
              {["Mês", "Plataforma", "Nome", "Invest.", "Conv.", "ROAS"].map((h) => <Text key={h} style={pdfStyles.cell}>{h}</Text>)}
            </View>
            {camps.map((c) => (
              <View key={c.id} style={pdfStyles.tr}>
                <Text style={pdfStyles.cell}>{MES_NOMES[c.mes - 1]}/{c.ano}</Text>
                <Text style={pdfStyles.cell}>{c.plataforma}</Text>
                <Text style={pdfStyles.cell}>{c.nome}</Text>
                <Text style={pdfStyles.cell}>{formatBRL(Number(c.investimento))}</Text>
                <Text style={pdfStyles.cell}>{c.conversoes}</Text>
                <Text style={[pdfStyles.cell, { color: c.roas > 3 ? "#10B981" : c.roas > 1.5 ? "#F59E0B" : "#EF4444" }]}>{c.roas.toFixed(2)}x</Text>
              </View>
            ))}
          </View>

          {camps.some((c) => c.insights) && (
            <>
              <Text style={pdfStyles.h2}>Insights e próximas ações</Text>
              {camps.filter((c) => c.insights).map((c) => (
                <View key={c.id} style={pdfStyles.card}>
                  <Text style={{ fontWeight: 700, marginBottom: 4 }}>{c.nome} ({c.plataforma})</Text>
                  <Text>{c.insights}</Text>
                </View>
              ))}
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
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="trafego-${cliente.nome}.pdf"` },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}
