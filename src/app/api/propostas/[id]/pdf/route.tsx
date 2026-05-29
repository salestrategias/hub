import React from "react";
import path from "node:path";
import { existsSync } from "node:fs";
import { renderToStream, Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
// puppeteer-core é peerDep externo: NÃO está no package.json (o Marcelo roda
// `npm install puppeteer-core` à parte pra não desincronizar o lock).
// Por isso este import pode não resolver no editor até instalar — é esperado.
import puppeteer from "puppeteer-core";
import type { Prisma } from "@prisma/client";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { signPrintToken } from "@/lib/print-token";
import {
  propostaContexto,
  expandirSecaoProposta,
  extrairTextoDeBlocos,
  formatBRL,
} from "@/lib/proposta-helpers";
import { normalizarExtras } from "@/lib/proposta-blocos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gera PDF da proposta.
 *
 * ENGINE PADRÃO (chromium): renderiza a página de print interna
 * (`/p/proposta/print/[id]`) com Chromium headless via puppeteer-core e
 * imprime em PDF — fica fiel à proposta pública (mesmo render rico).
 *
 * FALLBACK LEGACY (`?engine=legacy`): mantém o gerador @react-pdf/renderer
 * antigo. Útil se o Chromium não subir em produção.
 *
 * Acesso: `?token=<shareToken>` (cliente público) OU sessão autenticada
 * (preview interno do Marcelo).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const engine = searchParams.get("engine");

  try {
    // ── Auth: share token público OU sessão interna ──────────────
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

    // Cliente baixou PDF via link público — registra evento + notifica admin.
    // Throttle: 1 notificação por proposta por dia (chave inclui YYYY-MM-DD)
    // pra evitar spam se cliente recarregar várias vezes.
    if (token) {
      const hoje = new Date().toISOString().slice(0, 10);
      void prisma.notificacao
        .create({
          data: {
            userId: proposta.criadoPor,
            tipo: "PROPOSTA_PDF_BAIXADO",
            titulo: `📄 ${proposta.clienteNome} baixou o PDF da proposta ${proposta.numero}`,
            descricao: proposta.titulo,
            href: `/propostas/${proposta.id}`,
            entidadeTipo: "PROPOSTA",
            entidadeId: proposta.id,
            chave: `PROPOSTA_PDF_BAIXADO:${proposta.id}:${hoje}`,
          },
        })
        .catch(() => undefined);
    }

    // ── Engine legacy (@react-pdf) sob demanda ───────────────────
    if (engine === "legacy") {
      const buffer = await renderLegacyPdf(proposta);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="proposta-${proposta.numero}.pdf"`,
        },
      });
    }

    // ── Engine padrão: Chromium headless → PDF da página de print ─
    const buffer = await renderChromiumPdf(proposta.id);
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proposta-${proposta.numero}.pdf"`,
      },
    });
  } catch (e) {
    // Erros do Chromium (launch/goto/timeout): 500 com dica do fallback legacy.
    if (e instanceof ChromiumPdfError) {
      console.error("[propostas/pdf] chromium falhou:", e.message);
      return new Response(
        `Falha ao gerar PDF via Chromium: ${e.message}\n\n` +
          `Tente o gerador legado adicionando ?engine=legacy à URL.`,
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    return apiHandler(async () => {
      throw e;
    });
  }
}

// ─── Engine Chromium ─────────────────────────────────────────────

class ChromiumPdfError extends Error {}

/** Resolve o executável do Chromium: env var ou caminhos comuns do Alpine. */
function resolverChromiumPath(): string {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env) return env;
  for (const candidato of ["/usr/bin/chromium-browser", "/usr/bin/chromium"]) {
    if (existsSync(candidato)) return candidato;
  }
  throw new ChromiumPdfError(
    "Chromium não encontrado. Rode `npm install puppeteer-core` e defina " +
      "PUPPETEER_EXECUTABLE_PATH (ex: /usr/bin/chromium-browser no Alpine, " +
      "ou o caminho do Chrome local no Windows/macOS)."
  );
}

/**
 * Abre a página de print interna com Chromium headless e imprime em PDF.
 * baseUrl é server-side (loopback) — o Chromium roda no mesmo host da app.
 */
async function renderChromiumPdf(propostaId: string): Promise<Buffer> {
  const executablePath = resolverChromiumPath();
  const printToken = signPrintToken(propostaId);
  const baseUrl = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  const printUrl = `${baseUrl}/p/proposta/print/${propostaId}?t=${encodeURIComponent(printToken)}`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } catch (e) {
    if (e instanceof ChromiumPdfError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new ChromiumPdfError(msg);
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

// ─── Engine legacy (@react-pdf/renderer) ─────────────────────────
// Preservado integralmente como fallback acessível via ?engine=legacy.

// Tipo do registro carregado no GET (Proposta + user name/email).
type PropostaLegacy = Prisma.PropostaGetPayload<{
  include: { user: { select: { name: true; email: true } } };
}>;

// Registro de fontes — Helvetica (default do react-pdf) é Type1/Latin-1 e
// quebra com acentos UTF-8 + emojis. Registramos Inter (mesma fonte do web)
// e Twemoji como emoji source (PNG). Idempotente sob hot-reload via try.
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
  // Já registrado ou ambiente sem acesso ao FS — segue com Helvetica fallback
}

async function renderLegacyPdf(proposta: PropostaLegacy): Promise<Buffer> {
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
        {proposta.capaImagemUrl && (
          <>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={proposta.capaImagemUrl} style={styles.capaHero} fixed />
            <View style={styles.capaHeroOverlay} fixed />
          </>
        )}
        {/* Accent bar no topo da capa */}
        <View style={[styles.capaAccent, { backgroundColor: corPrim }]} fixed />
        <View style={styles.capaInner}>
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
            <View style={styles.capaTagWrap}>
              <View style={[styles.capaTagDot, { backgroundColor: corPrim }]} />
              <Text style={styles.capaNumero}>Proposta {proposta.numero}</Text>
            </View>
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
        </View>
      </Page>

      {/* Capa custom (se preenchida) */}
      {proposta.capa && extrairTextoDeBlocos(expandirSecaoProposta(proposta.capa, ctx)) && (
        <Page size="A4" style={styles.page}>
          <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
          <SectionTitle titulo="Apresentação" cor={corPrim} />
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
            <SectionTitle titulo={s.label} cor={corPrim} />

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

      {/* Página: Timeline (substitui ou complementa Cronograma) */}
      {extras.timeline?.visivel && extras.timeline.marcos.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
          <SectionTitle
            titulo={extras.timeline.titulo}
            subtitulo={extras.timeline.subtitulo}
            cor={corPrim}
          />
          <View style={styles.timelineWrap}>
            {extras.timeline.marcos.map((m, idx) => {
              const concluido = m.status === "concluido";
              const ativo = m.status === "em_andamento";
              const ultimo = idx === extras.timeline!.marcos.length - 1;
              return (
                <View key={m.id} style={styles.marcoBox}>
                  {/* Linha vertical conectando os marcadores */}
                  {!ultimo && (
                    <View
                      style={[
                        styles.marcoLinha,
                        { backgroundColor: hexAlpha(corPrim, 0.25) },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.marcoCirculo,
                      {
                        backgroundColor: concluido ? corPrim : ativo ? hexAlpha(corPrim, 0.15) : "#FFFFFF",
                        borderColor: concluido || ativo ? corPrim : "#D4D4DE",
                      },
                    ]}
                  >
                    <Text style={[styles.marcoCirculoTexto, { color: concluido ? "#FFFFFF" : corPrim }]}>
                      {concluido ? "✓" : ativo ? "●" : "○"}
                    </Text>
                  </View>
                  <View style={styles.marcoConteudo}>
                    <Text style={[styles.marcoPeriodo, { color: corPrim }]}>{m.periodo}</Text>
                    <Text style={styles.marcoTitulo}>{m.titulo}</Text>
                    {m.descricao && <Text style={styles.marcoDescricao}>{m.descricao}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* Página: Garantias */}
      {extras.garantias?.visivel && extras.garantias.garantias.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
          <SectionTitle
            titulo={extras.garantias.titulo}
            subtitulo={extras.garantias.subtitulo}
            cor={corPrim}
          />
          <View style={styles.garantiaGrid}>
            {extras.garantias.garantias.map((g) => (
              <View
                key={g.id}
                style={[
                  styles.garantiaBox,
                  { borderColor: hexAlpha(corPrim, 0.18), backgroundColor: hexAlpha(corPrim, 0.03) },
                ]}
              >
                <View style={[styles.garantiaIconeWrap, { backgroundColor: hexAlpha(corPrim, 0.1) }]}>
                  <Text style={styles.garantiaIcone}>{g.icone}</Text>
                </View>
                <Text style={styles.garantiaTitulo}>{g.titulo}</Text>
                {g.descricao && <Text style={styles.garantiaDescricao}>{g.descricao}</Text>}
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* Página: Cases */}
      {extras.cases?.visivel && extras.cases.cases.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
          <SectionTitle
            titulo={extras.cases.titulo}
            subtitulo={extras.cases.subtitulo}
            cor={corPrim}
          />
          <View>
            {extras.cases.cases.map((c, idx) => (
              <View
                key={c.id}
                style={[
                  styles.cardBox,
                  {
                    borderLeftColor: corPrim,
                    marginTop: idx === 0 ? 4 : 12,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  {c.metricaPrincipal && (
                    <View style={[styles.cardMetricaChip, { backgroundColor: hexAlpha(corPrim, 0.1) }]}>
                      <Text style={[styles.cardMetricaTexto, { color: corPrim }]}>{c.metricaPrincipal}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitulo}>{c.cliente}</Text>
                    {c.segmento && <Text style={styles.cardSub}>{c.segmento}</Text>}
                  </View>
                </View>
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
          <SectionTitle
            titulo={extras.kpis.titulo}
            subtitulo={extras.kpis.subtitulo}
            cor={corPrim}
          />
          <View style={styles.kpiGrid}>
            {extras.kpis.kpis.map((k) => (
              <View
                key={k.id}
                style={[
                  styles.kpiCardPdf,
                  { borderColor: hexAlpha(corPrim, 0.18), backgroundColor: hexAlpha(corPrim, 0.03) },
                ]}
              >
                <Text style={styles.kpiLabelPdf}>{k.label}</Text>
                <View style={styles.kpiValorRow}>
                  {k.valorAtual && (
                    <>
                      <Text style={styles.kpiAtualPdf}>{k.valorAtual}</Text>
                      <Text style={[styles.kpiArrow, { color: corPrim }]}>→</Text>
                    </>
                  )}
                  <Text style={[styles.kpiMetaPdf, { color: corPrim }]}>{k.valorMeta}</Text>
                </View>
                {k.variacao && (
                  <View style={styles.kpiVariacaoChip}>
                    <Text style={styles.kpiVariacaoPdf}>{k.variacao}</Text>
                  </View>
                )}
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
          <SectionTitle
            titulo={extras.pacotes.titulo}
            subtitulo={extras.pacotes.subtitulo}
            cor={corPrim}
          />
          <View style={styles.pacoteGrid}>
            {extras.pacotes.pacotes.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.pacoteBoxPdf,
                  p.destaque && {
                    borderColor: corPrim,
                    borderWidth: 1.5,
                    backgroundColor: hexAlpha(corPrim, 0.05),
                  },
                ]}
              >
                {p.destaque ? (
                  <View style={[styles.pacoteBadgeWrap, { backgroundColor: corPrim }]}>
                    <Text style={styles.pacoteBadgeText}>RECOMENDADO</Text>
                  </View>
                ) : (
                  // Spacer pra alinhar topos quando há um pacote em destaque na linha
                  <View style={styles.pacoteBadgeSpacer} />
                )}
                {p.subtitulo && <Text style={styles.pacoteSubPdf}>{p.subtitulo}</Text>}
                <Text style={styles.pacoteNomePdf}>{p.nome}</Text>
                <Text style={[styles.pacoteValorPdf, { color: corPrim }]}>{p.valor}</Text>
                <View style={[styles.pacoteDivisor, { backgroundColor: hexAlpha(corPrim, 0.15) }]} />
                <View>
                  {p.features.map((f, idx) => (
                    <View key={idx} style={styles.pacoteFeatureRow}>
                      <Text
                        style={[
                          styles.pacoteFeatureIcone,
                          {
                            color: f.incluso ? corPrim : "#A8A8B8",
                          },
                        ]}
                      >
                        {f.incluso ? "✓" : "—"}
                      </Text>
                      <Text
                        style={[
                          styles.pacoteFeaturePdf,
                          f.destaque && { fontWeight: 700, color: "#1F1F2D" },
                          !f.incluso && { color: "#A8A8B8", textDecoration: "line-through" },
                        ]}
                      >
                        {f.texto}
                      </Text>
                    </View>
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
          <SectionTitle
            titulo={extras.equipe.titulo}
            subtitulo={extras.equipe.subtitulo}
            cor={corPrim}
          />
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

      {/* Página: Assinatura digital (se proposta aceita) */}
      {proposta.status === "ACEITA" && (proposta.aceiteNome || proposta.aceiteCpfCnpj) && (
        <Page size="A4" style={styles.page}>
          <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
          <SectionTitle
            titulo="Aceite digital"
            subtitulo="Esta proposta foi aceita digitalmente. Registro com validade jurídica abaixo."
            cor={corPrim}
          />
          <View style={[styles.assinaturaBox, { borderColor: corPrim, backgroundColor: hexAlpha(corPrim, 0.03) }]}>
            <View style={[styles.assinaturaBadge, { backgroundColor: "#10B981" }]}>
              <Text style={styles.assinaturaBadgeIcone}>✓</Text>
              <Text style={styles.assinaturaBadgeTexto}>PROPOSTA ACEITA</Text>
            </View>
            <Text style={[styles.assinaturaTitulo, { color: corPrim }]}>SIGNATÁRIO</Text>
            {proposta.aceiteNome && <Text style={styles.assinaturaNome}>{proposta.aceiteNome}</Text>}
            {proposta.aceiteCpfCnpj && (
              <Text style={styles.assinaturaDoc}>
                {formatarDocPdf(proposta.aceiteCpfCnpj)}
              </Text>
            )}
            <View style={[styles.assinaturaSep, { backgroundColor: hexAlpha(corPrim, 0.3) }]} />
            <Text style={styles.assinaturaMeta}>
              Aceito em{" "}
              {proposta.aceitaEm
                ? new Date(proposta.aceitaEm).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </Text>
            {proposta.aceiteIp && (
              <Text style={styles.assinaturaMeta}>IP {proposta.aceiteIp}</Text>
            )}
            <Text style={[styles.assinaturaMetaLegal, { color: hexAlpha("#000000", 0.5) }]}>
              Manifestação de vontade conforme Marco Civil da Internet (Lei 12.965/2014)
            </Text>
          </View>
          <PageFooter />
        </Page>
      )}

      {/* Página: FAQ */}
      {extras.faq?.visivel && extras.faq.perguntas.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader numero={proposta.numero} cliente={proposta.clienteNome} cor={corPrim} />
          <SectionTitle
            titulo={extras.faq.titulo}
            subtitulo={extras.faq.subtitulo}
            cor={corPrim}
          />
          <View>
            {extras.faq.perguntas.map((f) => (
              <View key={f.id} style={styles.faqItem}>
                <View style={styles.faqHeader}>
                  <View style={[styles.faqDot, { backgroundColor: corPrim }]} />
                  <Text style={styles.faqPergunta}>{f.pergunta}</Text>
                </View>
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
  return Buffer.concat(chunks);
}

// ─── Componentes auxiliares (legacy) ─────────────────────────────

/**
 * Header de página de conteúdo: barra de cor fina no topo (continuidade
 * da marca/capa) + linha sutil com proposta e cliente.
 */
function PageHeader({ numero, cliente, cor }: { numero: string; cliente: string; cor: string }) {
  return (
    <>
      <View style={[styles.pageAccentBar, { backgroundColor: cor }]} fixed />
      <View style={styles.pageHeader} fixed>
        <Text style={[styles.pageHeaderBrand, { color: cor }]}>Proposta {numero}</Text>
        <Text style={styles.pageHeaderCliente}>{cliente}</Text>
      </View>
    </>
  );
}

/**
 * Título de seção redesenhado: número da seção (eyebrow) opcional,
 * H1 grande sem border-bottom feia, subtítulo logo abaixo.
 */
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
          {eyebrow && (
            <Text style={[styles.sectionEyebrow, { color: cor }]}>{eyebrow}</Text>
          )}
          <Text style={styles.sectionTitulo}>{titulo}</Text>
          {subtitulo && <Text style={styles.sectionSubtitulo}>{subtitulo}</Text>}
        </View>
      </View>
    </View>
  );
}

/** Formata CPF/CNPJ pra exibição no PDF (módulo standalone — não pode importar lib client). */
function formatarDocPdf(s: string): string {
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return s;
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

// ─── Design tokens ───────────────────────────────────────────────
// Paleta neutra refinada e espaçamento consistente em múltiplos de 4pt.
const C = {
  ink: "#16161D",          // títulos principais
  inkSoft: "#2A2A35",      // corpo
  body: "#4A4A5C",         // texto secundário
  muted: "#8B8B9D",        // metadados, labels
  light: "#C9C9D4",        // ícones light, linhas sutis
  bg: "#FFFFFF",           // fundo de página
  cardBg: "#FAFAFB",       // fundo de card neutro
  cardBgSoft: "#F4F4F8",   // fundo de card mais escuro
  border: "#EBEBF1",       // borda card
  borderLight: "#F2F2F6",  // borda muito sutil
  capaBg: "#0B0B12",       // fundo da capa (mais profundo)
  capaText: "#FFFFFF",
  capaMuted: "#A0A0B0",
  capaBorder: "#1F1F2A",
};

const styles = StyleSheet.create({
  // ═══════════════ CAPA ═══════════════
  // Sem padding na Page → hero preenche 100%. position: relative ancora absolute.
  capa: {
    backgroundColor: C.capaBg,
    color: C.capaText,
    position: "relative",
    fontFamily: "Inter",
  },
  // Accent bar fina no topo (continuidade visual com o resto do PDF)
  capaAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  capaInner: {
    flex: 1,
    padding: 64,
    paddingTop: 80,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  capaHero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    objectFit: "cover",
  },
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
  brandSub: { fontSize: 8, color: C.capaMuted, textTransform: "uppercase", letterSpacing: 2.5, marginLeft: 4 },
  capaCenter: { marginTop: 60 },
  capaTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  capaTagDot: { width: 6, height: 6, borderRadius: 3 },
  capaNumero: { fontSize: 9, color: C.capaMuted, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 },
  capaTitulo: { fontSize: 38, fontWeight: 800, color: C.capaText, lineHeight: 1.15, letterSpacing: -0.5 },
  capaSeparador: { width: 56, height: 3, marginTop: 28, marginBottom: 28, borderRadius: 2 },
  capaPara: { fontSize: 9, color: C.capaMuted, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 },
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
  },
  // Barra fina colorida no topo de cada página (continuidade da capa)
  pageAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
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

  // ═══════════════ SECTION TITLE (novo) ═══════════════
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
  sectionTitulo: {
    fontSize: 26,
    fontWeight: 800,
    color: C.ink,
    lineHeight: 1.15,
    letterSpacing: -0.4,
  },
  sectionSubtitulo: {
    fontSize: 11,
    color: C.body,
    marginTop: 6,
    lineHeight: 1.5,
  },

  // ═══════════════ TIPOGRAFIA DE CONTEÚDO ═══════════════
  h1Inline: { fontSize: 15, fontWeight: 700, color: C.ink, marginTop: 14, marginBottom: 6, lineHeight: 1.3 },
  h2: { fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 12, marginBottom: 4, lineHeight: 1.3 },
  h3: { fontSize: 11, fontWeight: 700, color: C.body, marginTop: 10, marginBottom: 2, lineHeight: 1.3 },
  p: { fontSize: 11, color: C.inkSoft, marginBottom: 8, lineHeight: 1.55 },
  bullet: { fontSize: 11, color: C.inkSoft, marginBottom: 5, paddingLeft: 12, lineHeight: 1.5 },

  // ═══════════════ INVESTIMENTO BOX ═══════════════
  investBox: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 18,
    padding: 20,
    backgroundColor: "#F8F4FE",
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  investItem: { flex: 1 },
  investLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 },
  investValor: { fontSize: 20, fontWeight: 800, marginTop: 6, lineHeight: 1.1, letterSpacing: -0.3 },

  // ═══════════════ CASES ═══════════════
  cardBox: {
    padding: 18,
    borderRadius: 10,
    backgroundColor: C.cardBg,
    borderLeftWidth: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  cardMetricaChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  cardMetricaTexto: { fontSize: 18, fontWeight: 800, lineHeight: 1, letterSpacing: -0.3 },
  cardTitulo: { fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.3 },
  cardSub: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 3, fontWeight: 600 },
  cardTexto: { fontSize: 11, color: C.inkSoft, fontWeight: 600, lineHeight: 1.4 },
  cardDescricao: { fontSize: 9.5, color: C.body, marginTop: 6, lineHeight: 1.55 },

  // ═══════════════ KPIs ═══════════════
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  kpiCardPdf: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    width: "31%",
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiLabelPdf: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, textAlign: "center", fontWeight: 600 },
  kpiValorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kpiAtualPdf: { fontSize: 11, color: C.muted, textDecoration: "line-through", fontWeight: 600, lineHeight: 1.1 },
  kpiArrow: { fontSize: 11, fontWeight: 700 },
  kpiMetaPdf: { fontSize: 22, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.3 },
  kpiVariacaoChip: {
    marginTop: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: "#E6F9F0",
    borderRadius: 6,
  },
  kpiVariacaoPdf: { fontSize: 8.5, color: "#10A86A", fontWeight: 700, letterSpacing: 0.3 },

  // ═══════════════ PACOTES ═══════════════
  pacoteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  pacoteBoxPdf: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    width: "31.5%",
    backgroundColor: "#FFFFFF",
  },
  // Badge "RECOMENDADO" como pill colorido no topo do card destaque
  pacoteBadgeWrap: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  pacoteBadgeText: { fontSize: 7, fontWeight: 800, color: "#FFFFFF", letterSpacing: 1.5 },
  // Spacer pra alinhar topos de cards sem destaque com os com destaque
  pacoteBadgeSpacer: { height: 18, marginBottom: 10 },
  pacoteSubPdf: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 },
  pacoteNomePdf: { fontSize: 16, fontWeight: 700, color: C.ink, marginTop: 4, lineHeight: 1.2, letterSpacing: -0.2 },
  pacoteValorPdf: { fontSize: 18, fontWeight: 800, marginTop: 6, lineHeight: 1.15, letterSpacing: -0.3 },
  pacoteDivisor: { height: 1, marginTop: 14, marginBottom: 12 },
  pacoteFeatureRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 6 },
  pacoteFeatureIcone: { fontSize: 9, fontWeight: 700, lineHeight: 1.4, width: 10 },
  pacoteFeaturePdf: { fontSize: 8.5, color: C.body, lineHeight: 1.45, flex: 1 },

  // ═══════════════ EQUIPE ═══════════════
  equipeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8, justifyContent: "center" },
  membroBox: { width: "28%", alignItems: "center", textAlign: "center", marginBottom: 16 },
  membroFotoPdf: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, marginBottom: 8, objectFit: "cover" },
  membroFotoFallbackPdf: { alignItems: "center", justifyContent: "center", backgroundColor: "#F8F4FE" },
  membroNomePdf: { fontSize: 11, fontWeight: 700, color: C.ink, lineHeight: 1.2 },
  membroCargoPdf: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 3, fontWeight: 600 },
  membroBioPdf: { fontSize: 9, color: C.body, marginTop: 6, lineHeight: 1.5, textAlign: "center" },

  // ═══════════════ FAQ ═══════════════
  faqItem: {
    padding: 14,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  faqHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  faqDot: { width: 6, height: 6, borderRadius: 3 },
  faqPergunta: { fontSize: 11, fontWeight: 700, color: C.ink, flex: 1, lineHeight: 1.3 },
  faqResposta: { fontSize: 10, color: C.body, marginTop: 6, marginLeft: 14, lineHeight: 1.55 },

  // ═══════════════ TIMELINE ═══════════════
  timelineWrap: { marginTop: 4 },
  marcoBox: { flexDirection: "row", marginBottom: 16, gap: 14, alignItems: "flex-start", position: "relative" },
  // Linha vertical conectando os marcadores
  marcoLinha: {
    position: "absolute",
    left: 15,
    top: 30,
    width: 2,
    bottom: -16,
    borderRadius: 1,
  },
  marcoCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  marcoCirculoTexto: { fontSize: 14, fontWeight: 800 },
  marcoConteudo: { flex: 1, paddingTop: 3 },
  marcoPeriodo: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 },
  marcoTitulo: { fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.3 },
  marcoDescricao: { fontSize: 9.5, color: C.body, marginTop: 4, lineHeight: 1.55 },

  // ═══════════════ GARANTIAS ═══════════════
  garantiaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  garantiaBox: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    width: "48.5%",
    alignItems: "center",
    textAlign: "center",
    minHeight: 110,
  },
  // Ícone em "bolinha" de fundo (chip arredondado) — fica mais polido
  garantiaIconeWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  garantiaIcone: { fontSize: 22, lineHeight: 1 },
  garantiaTitulo: { fontSize: 11, fontWeight: 700, color: C.ink, lineHeight: 1.3 },
  garantiaDescricao: { fontSize: 9, color: C.body, marginTop: 6, lineHeight: 1.5, textAlign: "center" },

  // ═══════════════ ASSINATURA DIGITAL ═══════════════
  assinaturaBox: {
    marginTop: 12,
    padding: 28,
    paddingTop: 32,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    position: "relative",
  },
  // Badge verde "PROPOSTA ACEITA" no topo da caixa
  assinaturaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginBottom: 18,
  },
  assinaturaBadgeIcone: { fontSize: 9, color: "#FFFFFF", fontWeight: 800 },
  assinaturaBadgeTexto: { fontSize: 8, color: "#FFFFFF", fontWeight: 800, letterSpacing: 1.5 },
  assinaturaTitulo: { fontSize: 8.5, fontWeight: 700, letterSpacing: 2, marginBottom: 10 },
  assinaturaNome: { fontSize: 20, fontWeight: 800, color: C.ink, letterSpacing: -0.3 },
  assinaturaDoc: { fontSize: 12, fontFamily: "Courier", color: C.body, marginTop: 8 },
  assinaturaSep: { width: 60, height: 1, marginVertical: 18 },
  assinaturaMeta: { fontSize: 9, color: C.body, marginTop: 4, textAlign: "center" },
  assinaturaMetaLegal: { fontSize: 8, marginTop: 14, textAlign: "center", fontStyle: "italic" },
});
