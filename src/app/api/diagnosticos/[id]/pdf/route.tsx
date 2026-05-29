import React from "react";
import path from "node:path";
import { renderToStream, Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { extrairTextoDeBlocos } from "@/lib/proposta-helpers";
import { normalizarSecoes } from "@/lib/diagnostico-secoes";

// ─── Registro de fontes ─────────────────────────────────────────
// Mesma estratégia da proposta: Inter (UTF-8 + acentos) + Twemoji.
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
try {
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONT_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Inter-Bold.ttf"), fontWeight: 700 },
      { src: path.join(FONT_DIR, "Inter-ExtraBold.ttf"), fontWeight: 800 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  Font.registerEmojiSource({
    format: "png",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/",
  });
} catch {
  // Já registrado ou ambiente sem FS — segue com fallback
}

/**
 * Gera PDF do diagnóstico. Disponível pra usuário logado (preview interno)
 * e via link público (`?token=<shareToken>`). Capa + uma página por seção
 * visível. Diagnóstico não tem aceite/extras — é leitura estratégica.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  try {
    let where;
    if (token) {
      where = { shareToken: token, id: params.id };
    } else {
      await requireAuth();
      where = { id: params.id };
    }

    const diagnostico = await prisma.diagnostico.findFirst({
      where,
      include: { user: { select: { name: true, email: true } } },
    });
    if (!diagnostico) {
      return new Response("Diagnóstico não encontrado", { status: 404 });
    }

    // Cliente baixou via link público — registra evento (throttle por dia).
    if (token) {
      const hoje = new Date().toISOString().slice(0, 10);
      void prisma.notificacao
        .create({
          data: {
            userId: diagnostico.criadoPor,
            tipo: "SISTEMA",
            titulo: `📄 ${diagnostico.clienteNome} baixou o PDF do diagnóstico ${diagnostico.numero}`,
            descricao: diagnostico.titulo,
            href: `/diagnosticos/${diagnostico.id}`,
            entidadeTipo: "DIAGNOSTICO",
            entidadeId: diagnostico.id,
            chave: `DIAGNOSTICO_PDF_BAIXADO:${diagnostico.id}:${hoje}`,
          },
        })
        .catch(() => undefined);
    }

    const corPrim = diagnostico.corPrimaria ?? "#7E30E1";
    const secoes = normalizarSecoes(diagnostico.secoes)
      .filter((s) => s.visivel)
      .map((s) => ({ titulo: s.titulo, texto: extrairTextoDeBlocos(s.conteudo) }))
      .filter((s) => s.texto.trim().length > 0);

    const validadeStr = diagnostico.shareExpiraEm
      ? diagnostico.shareExpiraEm.toLocaleDateString("pt-BR")
      : null;

    const doc = (
      <Document>
        {/* Capa */}
        <Page size="A4" style={styles.capa}>
          {diagnostico.capaImagemUrl && (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={diagnostico.capaImagemUrl} style={styles.capaHero} fixed />
              <View style={styles.capaHeroOverlay} fixed />
            </>
          )}
          <View style={[styles.capaAccent, { backgroundColor: corPrim }]} fixed />
          <View style={styles.capaInner}>
            <View style={styles.capaTop}>
              {diagnostico.logoUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={diagnostico.logoUrl} style={styles.capaLogo} />
              ) : (
                <>
                  <Text style={styles.brand}>SAL</Text>
                  <Text style={styles.brandSub}>Estratégias de Marketing</Text>
                </>
              )}
            </View>
            <View style={styles.capaCenter}>
              <View style={styles.capaTagWrap}>
                <View style={[styles.capaTagDot, { backgroundColor: corPrim }]} />
                <Text style={styles.capaNumero}>Diagnóstico estratégico {diagnostico.numero}</Text>
              </View>
              <Text style={styles.capaTitulo}>{diagnostico.titulo}</Text>
              <View style={[styles.capaSeparador, { backgroundColor: corPrim }]} />
              <Text style={styles.capaPara}>Preparado para</Text>
              <Text style={styles.capaCliente}>{diagnostico.clienteNome}</Text>
            </View>
            <View style={styles.capaBottom}>
              <View>
                <Text style={styles.meta}>Por {diagnostico.user.name ?? "SAL"}</Text>
                <Text style={styles.meta}>{diagnostico.user.email ?? ""}</Text>
              </View>
              <View style={{ textAlign: "right" }}>
                <Text style={styles.meta}>Emitido {new Date().toLocaleDateString("pt-BR")}</Text>
                {validadeStr && <Text style={styles.meta}>Válido até {validadeStr}</Text>}
              </View>
            </View>
          </View>
        </Page>

        {/* Uma página por seção visível com conteúdo */}
        {secoes.map((s, i) => (
          <Page key={i} size="A4" style={styles.page}>
            <PageHeader numero={diagnostico.numero} cliente={diagnostico.clienteNome} cor={corPrim} />
            <SectionTitle
              eyebrow={`Seção ${String(i + 1).padStart(2, "0")}`}
              titulo={s.titulo}
              cor={corPrim}
            />
            <Conteudo texto={s.texto} />
            <PageFooter />
          </Page>
        ))}

        {/* Fallback: diagnóstico sem nenhuma seção preenchida */}
        {secoes.length === 0 && (
          <Page size="A4" style={styles.page}>
            <PageHeader numero={diagnostico.numero} cliente={diagnostico.clienteNome} cor={corPrim} />
            <SectionTitle titulo="Diagnóstico em preparação" cor={corPrim} />
            <Text style={styles.p}>Este diagnóstico ainda não tem seções preenchidas.</Text>
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
        "Content-Disposition": `inline; filename="diagnostico-${diagnostico.numero}.pdf"`,
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
    <>
      <View style={[styles.pageAccentBar, { backgroundColor: cor }]} fixed />
      <View style={styles.pageHeader} fixed>
        <Text style={[styles.pageHeaderBrand, { color: cor }]}>Diagnóstico {numero}</Text>
        <Text style={styles.pageHeaderCliente}>{cliente}</Text>
      </View>
    </>
  );
}

function SectionTitle({
  titulo,
  subtitulo,
  eyebrow,
  cor,
}: {
  titulo: string;
  subtitulo?: string;
  eyebrow?: string;
  cor: string;
}) {
  return (
    <View style={styles.sectionTitleWrap}>
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionTitleBar, { backgroundColor: cor }]} />
        <View style={{ flex: 1 }}>
          {eyebrow && <Text style={[styles.sectionEyebrow, { color: cor }]}>{eyebrow}</Text>}
          <Text style={styles.sectionTitulo}>{titulo}</Text>
          {subtitulo && <Text style={styles.sectionSubtitulo}>{subtitulo}</Text>}
        </View>
      </View>
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

// ─── Design tokens ───────────────────────────────────────────────
const C = {
  ink: "#16161D",
  inkSoft: "#2A2A35",
  body: "#4A4A5C",
  muted: "#8B8B9D",
  bg: "#FFFFFF",
  capaBg: "#0B0B12",
  capaText: "#FFFFFF",
  capaMuted: "#A0A0B0",
  capaBorder: "#1F1F2A",
};

const styles = StyleSheet.create({
  // ═══════════════ CAPA ═══════════════
  capa: {
    backgroundColor: C.capaBg,
    color: C.capaText,
    position: "relative",
    fontFamily: "Inter",
  },
  capaAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  capaInner: {
    flex: 1,
    padding: 64,
    paddingTop: 80,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  capaHero: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, objectFit: "cover" },
  capaHeroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11,11,18,0.7)",
  },
  capaTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  capaLogo: { maxHeight: 52, maxWidth: 180, objectFit: "contain" },
  brand: { fontSize: 32, fontWeight: 700, color: "#C5A6F7", letterSpacing: 2 },
  brandSub: {
    fontSize: 8,
    color: C.capaMuted,
    textTransform: "uppercase",
    letterSpacing: 2.5,
    marginLeft: 4,
  },
  capaCenter: { marginTop: 60 },
  capaTagWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  capaTagDot: { width: 6, height: 6, borderRadius: 3 },
  capaNumero: {
    fontSize: 9,
    color: C.capaMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
    fontWeight: 600,
  },
  capaTitulo: {
    fontSize: 38,
    fontWeight: 800,
    color: C.capaText,
    lineHeight: 1.15,
    letterSpacing: -0.5,
  },
  capaSeparador: { width: 56, height: 3, marginTop: 28, marginBottom: 28, borderRadius: 2 },
  capaPara: {
    fontSize: 9,
    color: C.capaMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: 600,
  },
  capaCliente: { fontSize: 22, fontWeight: 700, color: C.capaText, marginTop: 6, letterSpacing: -0.3 },
  capaBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.capaBorder,
    paddingTop: 18,
  },
  meta: { fontSize: 8.5, color: C.capaMuted, marginBottom: 3, letterSpacing: 0.2 },

  // ═══════════════ PÁGINA DE CONTEÚDO ═══════════════
  page: {
    padding: 60,
    paddingTop: 84,
    paddingBottom: 58,
    fontSize: 11,
    color: C.inkSoft,
    fontFamily: "Inter",
    lineHeight: 1.55,
    backgroundColor: C.bg,
  },
  pageAccentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  pageHeader: {
    position: "absolute",
    top: 36,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageHeaderBrand: { fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" },
  pageHeaderCliente: { fontSize: 8.5, color: C.muted, letterSpacing: 0.3 },
  pageFooter: {
    position: "absolute",
    bottom: 28,
    left: 60,
    right: 60,
    textAlign: "center",
    fontSize: 7.5,
    color: C.muted,
    letterSpacing: 0.5,
  },

  // ═══════════════ SECTION TITLE ═══════════════
  sectionTitleWrap: { marginBottom: 24 },
  sectionTitleRow: { flexDirection: "row", gap: 14, alignItems: "stretch" },
  sectionTitleBar: { width: 4, borderRadius: 2 },
  sectionEyebrow: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitulo: { fontSize: 26, fontWeight: 800, color: C.ink, lineHeight: 1.15, letterSpacing: -0.4 },
  sectionSubtitulo: { fontSize: 11, color: C.body, marginTop: 6, lineHeight: 1.5 },

  // ═══════════════ TIPOGRAFIA DE CONTEÚDO ═══════════════
  h1Inline: { fontSize: 15, fontWeight: 700, color: C.ink, marginTop: 14, marginBottom: 6, lineHeight: 1.3 },
  h2: { fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 12, marginBottom: 4, lineHeight: 1.3 },
  h3: { fontSize: 11, fontWeight: 700, color: C.body, marginTop: 10, marginBottom: 2, lineHeight: 1.3 },
  p: { fontSize: 11, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 },
  bullet: { fontSize: 11, color: C.inkSoft, marginBottom: 5, paddingLeft: 12, lineHeight: 1.5 },
});
