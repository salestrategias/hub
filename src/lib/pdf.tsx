import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import React from "react";

export const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#0F172A", fontFamily: "Helvetica" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "#F59E0B", paddingBottom: 12, marginBottom: 16,
  },
  brand: { fontSize: 18, fontWeight: 700, color: "#F59E0B" },
  brandSub: { fontSize: 8, color: "#64748B", letterSpacing: 1, textTransform: "uppercase" },
  metaRight: { textAlign: "right", fontSize: 9, color: "#475569" },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 8, color: "#1E293B" },
  muted: { color: "#64748B" },
  card: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6, padding: 10, marginBottom: 8 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  kpi: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6, padding: 10, width: 120 },
  kpiLabel: { fontSize: 8, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  table: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6, marginTop: 6 },
  trHead: { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 6 },
  tr: { flexDirection: "row", padding: 6, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  cell: { fontSize: 9, flex: 1 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#94A3B8" },
});

export function PdfHeader({ titulo, cliente, periodo }: { titulo: string; cliente: string; periodo: string }) {
  return (
    <View style={pdfStyles.header}>
      <View>
        <Text style={pdfStyles.brand}>SAL Hub</Text>
        <Text style={pdfStyles.brandSub}>Estratégias de Marketing</Text>
      </View>
      <View style={pdfStyles.metaRight}>
        <Text style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{titulo}</Text>
        <Text>{cliente}</Text>
        <Text>{periodo}</Text>
      </View>
    </View>
  );
}

export function PdfFooter() {
  return (
    <Text style={pdfStyles.footer} fixed>
      SAL Estratégias de Marketing · Relatório gerado em {new Date().toLocaleDateString("pt-BR")}
    </Text>
  );
}

export { Document, Page, Text, View };
