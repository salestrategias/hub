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
    const rede = searchParams.get("rede") ?? "INSTAGRAM";

    const [cliente, metricas] = await Promise.all([
      prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } }),
      prisma.metricaRede.findMany({
        where: { clienteId, rede: rede as "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "TIKTOK" | "YOUTUBE" },
        orderBy: [{ ano: "asc" }, { mes: "asc" }],
      }),
    ]);

    const ultima = metricas[metricas.length - 1];
    const penultima = metricas[metricas.length - 2];

    const doc = (
      <Document>
        <Page size="A4" style={pdfStyles.page}>
          <PdfHeader
            titulo={`Relatório · ${rede}`}
            cliente={cliente.nome}
            periodo={ultima ? `${MES_NOMES[ultima.mes - 1]}/${ultima.ano}` : ""}
          />
          <Text style={pdfStyles.h1}>Resumo do mês</Text>
          <View style={pdfStyles.kpiGrid}>
            {[
              { l: "Seguidores", a: ultima?.seguidores ?? 0, p: penultima?.seguidores ?? 0 },
              { l: "Alcance", a: ultima?.alcance ?? 0, p: penultima?.alcance ?? 0 },
              { l: "Impressões", a: ultima?.impressoes ?? 0, p: penultima?.impressoes ?? 0 },
              { l: "Engajamento", a: ultima?.engajamento ?? 0, p: penultima?.engajamento ?? 0 },
              { l: "Posts", a: ultima?.posts ?? 0, p: penultima?.posts ?? 0 },
            ].map((k) => {
              const delta = k.p > 0 ? ((k.a - k.p) / k.p) * 100 : k.a > 0 ? 100 : 0;
              return (
                <View key={k.l} style={pdfStyles.kpi}>
                  <Text style={pdfStyles.kpiLabel}>{k.l}</Text>
                  <Text style={pdfStyles.kpiValue}>{formatNumber(k.a)}</Text>
                  <Text style={{ fontSize: 8, color: delta >= 0 ? "#10B981" : "#EF4444" }}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs mês ant.
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={pdfStyles.h2}>Histórico</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.trHead}>
              {["Mês", "Seguidores", "Alcance", "Impressões", "Engajam.", "Posts", "Stories", "Reels"].map((h) => (
                <Text key={h} style={pdfStyles.cell}>{h}</Text>
              ))}
            </View>
            {metricas.map((m) => (
              <View key={m.id} style={pdfStyles.tr}>
                <Text style={pdfStyles.cell}>{MES_NOMES[m.mes - 1]}/{m.ano}</Text>
                <Text style={pdfStyles.cell}>{formatNumber(m.seguidores)}</Text>
                <Text style={pdfStyles.cell}>{formatNumber(m.alcance)}</Text>
                <Text style={pdfStyles.cell}>{formatNumber(m.impressoes)}</Text>
                <Text style={pdfStyles.cell}>{formatNumber(m.engajamento)}</Text>
                <Text style={pdfStyles.cell}>{m.posts}</Text>
                <Text style={pdfStyles.cell}>{m.stories}</Text>
                <Text style={pdfStyles.cell}>{m.reels}</Text>
              </View>
            ))}
          </View>

          <PdfFooter />
        </Page>
      </Document>
    );

    const stream = await renderToStream(doc);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) chunks.push(chunk);
    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="redes-${rede}-${cliente.nome}.pdf"`,
      },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}
