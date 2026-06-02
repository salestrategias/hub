"use client";
/**
 * DiagnosticoDocumento — corpo "documento" puro do diagnóstico.
 *
 * Extraído de `diagnostico-publica.tsx` pra ser reusado por:
 *  - a página pública (`diagnostico-publica.tsx`) — com chrome interativo
 *    (botão "Baixar PDF") passado via `children`.
 *  - a página de print (`/p/diagnostico/print/[id]`) — render limpo A4 pro
 *    Chromium headless converter em PDF fiel à web (`modoApresentacao`).
 *
 * Renderiza o MESMO HTML+CSS da pública (capa + sumário + seções), mantendo
 * pública e print pixel-idênticas, sem duplicação.
 *
 * Quando `modoApresentacao` é true:
 *  - não renderiza `children` (botão "Baixar PDF" fica de fora);
 *  - quando `print` também é true, injeta CSS de print (A4, fundo branco,
 *    print-color-adjust) via `<style dangerouslySetInnerHTML>` — JAMAIS
 *    `<style jsx>` (dá panic no SWC styled-jsx durante o build).
 */
import { BlockRenderer } from "@/components/editor";
import {
  type BlocoKpis,
  type BlocoTimeline,
  type BlocoCases,
  type BlocoGarantias,
  type BlocoEquipe,
  type BlocoFaq,
  type BlocoPacotes,
} from "@/lib/proposta-blocos";
import {
  KpisPublico,
  TimelinePublico,
  CasesPublico,
  GarantiasPublico,
  EquipePublico,
  FaqPublico,
  PacotesPublico,
} from "@/components/proposta-publica-blocos";
import { secaoEhEstruturada, type SecaoDados } from "@/lib/diagnostico-secoes";

export type SecaoPublica = {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
  /** Payload dos blocos visuais estruturados (kpis/timeline/cases/etc.). */
  dados?: SecaoDados;
};

export type DiagnosticoDocumentoData = {
  id: string;
  numero: string;
  titulo: string;
  clienteNome: string;
  logoUrl: string | null;
  corPrimaria: string | null;
  capaImagemUrl: string | null;
  secoes: SecaoPublica[];
  status: "RASCUNHO" | "PRONTO" | "ENVIADO" | "VISTO" | "ARQUIVADO";
  enviadoEm: string | null;
  shareExpiraEm: string | null;
  autorNome: string | null;
  autorEmail: string | null;
};

export function DiagnosticoDocumento({
  diag,
  modoApresentacao = false,
  print = false,
  children,
}: {
  diag: DiagnosticoDocumentoData;
  /** Esconde chrome interativo (usado pela página de print). */
  modoApresentacao?: boolean;
  /** Aplica CSS de print (A4, fundo branco). Só faz sentido com modoApresentacao. */
  print?: boolean;
  /** Chrome interativo da pública (botão "Baixar PDF"). */
  children?: React.ReactNode;
}) {
  const cor = diag.corPrimaria ?? "#7E30E1";
  // Itens que efetivamente aparecem, na ordem: seções de TEXTO com conteúdo +
  // blocos visuais estruturados com itens. Texto vazio e bloco vazio somem.
  const itens = diag.secoes.filter(secaoAparece);
  // Só as seções de TEXTO entram na numeração + no sumário "Neste diagnóstico"
  // (os blocos visuais são quebras visuais, não capítulos narrativos).
  const secoesTexto = itens.filter((s) => !secaoEhEstruturada(s.tipo));
  const dataFmt = diag.enviadoEm
    ? new Date(diag.enviadoEm).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div
      className={modoApresentacao ? "diagnostico-print" : undefined}
      style={{ minHeight: "100vh", background: "#FBFAF8", color: "#16161D" }}
    >
      {/* Barra superior fina com a cor do diagnóstico */}
      <div style={{ height: 4, background: cor }} />

      {/* Top bar: logo + chrome interativo (botão "Baixar PDF") — só na pública */}
      <div className="max-w-3xl mx-auto px-6 sm:px-8 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {diag.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={diag.logoUrl} alt="" className="h-8 max-w-[160px] object-contain" />
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xl font-bold tracking-wide" style={{ color: cor }}>
                SAL
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">
                Estratégias de Marketing
              </span>
            </div>
          )}
        </div>
        {!modoApresentacao && children}
      </div>

      {/* Capa / cabeçalho do documento */}
      <header className="max-w-3xl mx-auto px-6 sm:px-8 pt-14 pb-10">
        <div className="flex items-center gap-2 mb-5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: cor }}
          >
            Diagnóstico estratégico {diag.numero}
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight">
          {diag.titulo}
        </h1>
        <div className="mt-7 h-[3px] w-14 rounded-full" style={{ background: cor }} />
        <p className="mt-7 text-[11px] uppercase tracking-[0.18em] text-neutral-500">Preparado para</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{diag.clienteNome}</p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-neutral-500">
          {diag.autorNome && <span>Por {diag.autorNome}</span>}
          {dataFmt && <span>{dataFmt}</span>}
        </div>
      </header>

      {/* Hero opcional */}
      {diag.capaImagemUrl && (
        <div className="max-w-3xl mx-auto px-6 sm:px-8 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={diag.capaImagemUrl}
            alt=""
            className="w-full rounded-2xl object-cover max-h-[360px]"
          />
        </div>
      )}

      {/* Sumário navegável (só as seções de TEXTO — os blocos visuais são
          quebras visuais, não capítulos narrativos numerados) */}
      {secoesTexto.length > 2 && (
        <nav className="max-w-3xl mx-auto px-6 sm:px-8 mb-10">
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "#ECE9E3", background: "#FFFFFF" }}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-neutral-400 mb-3">
              Neste diagnóstico
            </p>
            <ol className="space-y-1.5">
              {secoesTexto.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#sec-${s.id}`}
                    className="group flex items-baseline gap-3 text-[13.5px] hover:opacity-80"
                  >
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: cor }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-medium">{s.titulo}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      )}

      {/* Corpo: itera os itens na ordem. Seção de texto → bloco numerado;
          bloco visual → componente de render reusado da proposta (tema claro
          via CSS abaixo). A numeração só conta as seções de texto. */}
      <main className="max-w-3xl mx-auto px-6 sm:px-8 pb-24 space-y-14">
        {(() => {
          let n = 0; // contador só das seções de texto (numeração do sumário)
          return itens.map((s) => {
            if (secaoEhEstruturada(s.tipo)) {
              return (
                <div key={s.id} className="diag-bloco">
                  {renderBlocoEstruturado(s)}
                </div>
              );
            }
            n += 1;
            return (
              <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-8">
                <div className="flex items-baseline gap-3 mb-4">
                  <span
                    className="font-mono text-[12px] font-semibold tabular-nums"
                    style={{ color: cor }}
                  >
                    {String(n).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight leading-tight">
                    {s.titulo}
                  </h2>
                </div>
                <div className="diagnostico-secao-conteudo pl-0 sm:pl-8 text-[15px] leading-relaxed">
                  <BlockRenderer value={s.conteudo} />
                </div>
              </section>
            );
          });
        })()}

        {itens.length === 0 && (
          <p className="text-center text-neutral-400 py-20">
            Este diagnóstico ainda está sendo preparado.
          </p>
        )}
      </main>

      {/* Rodapé */}
      <footer
        className="border-t py-8 text-center text-[11.5px] text-neutral-400"
        style={{ borderColor: "#ECE9E3" }}
      >
        <p>
          Diagnóstico estratégico ·{" "}
          <span className="font-semibold">SAL Estratégias de Marketing</span>
        </p>
        {diag.autorEmail && <p className="mt-1">{diag.autorEmail}</p>}
      </footer>

      {/* ──────────────────────────────────────────────────────────────
          BLOCOS VISUAIS — tema CLARO (o diagnóstico é um documento creme).
          Os componentes reusados (`proposta-publica-blocos`) emitem as MESMAS
          classes da proposta (.bloco, .pacotes-grid, .kpi-card, etc.), mas lá
          o tema é escuro. Aqui re-estilizamos sob `.diag-bloco` pro fundo claro,
          herdando a cor primária via `--cor-primaria`.
          ⚠️ `<style dangerouslySetInnerHTML>` — JAMAIS `<style jsx>`.
          ────────────────────────────────────────────────────────────── */}
      <style
        dangerouslySetInnerHTML={{
          __html: blocoEstruturadoCss(cor),
        }}
      />

      {/* ──────────────────────────────────────────────────────────────
          MODO PRINT (documento limpo pro Chromium headless → PDF)
          Só injetado quando `print` é true (página /p/diagnostico/print/[id]).
          - preserva o fundo creme e as cores (print-color-adjust);
          - evita cortar seções/sumário no meio entre páginas A4.
          ⚠️ `<style dangerouslySetInnerHTML>` — JAMAIS `<style jsx>`.
          ────────────────────────────────────────────────────────────── */}
      {print && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
          html, body, .diagnostico-print {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #FBFAF8;
            margin: 0;
            padding: 0;
          }
          .diagnostico-print section,
          .diagnostico-print nav,
          .diagnostico-print header,
          .diagnostico-print footer {
            break-inside: avoid;
          }
          /* Blocos visuais: não corta cards no meio entre páginas A4 e
             desliga hover/animação que não faz sentido no papel. */
          .diagnostico-print .diag-bloco .pacote,
          .diagnostico-print .diag-bloco .case-card,
          .diagnostico-print .diag-bloco .kpi-card,
          .diagnostico-print .diag-bloco .garantia-card,
          .diagnostico-print .diag-bloco .membro-card,
          .diagnostico-print .diag-bloco .faq-item {
            break-inside: avoid;
            transition: none;
            transform: none;
          }
          .diagnostico-print .diag-bloco .timeline-pulse { animation: none; }
        `,
          }}
        />
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Detecta se uma seção BlockNote tem texto renderizável (pra esconder vazias). */
export function temTexto(conteudo: string): boolean {
  const t = (conteudo ?? "").trim();
  if (!t) return false;
  if (!t.startsWith("[")) return t.length > 0;
  try {
    const blocks = JSON.parse(t) as Array<{ content?: unknown }>;
    return blocks.some((b) => temConteudoInline(b.content));
  } catch {
    return true; // não-parseável mas não-vazio → mostra
  }
}

function temConteudoInline(content: unknown): boolean {
  if (typeof content === "string") return content.trim().length > 0;
  if (Array.isArray(content)) {
    return content.some((seg) => {
      if (typeof seg === "string") return seg.trim().length > 0;
      if (seg && typeof seg === "object") {
        const s = seg as { text?: string; content?: unknown };
        if (typeof s.text === "string" && s.text.trim()) return true;
        return temConteudoInline(s.content);
      }
      return false;
    });
  }
  return false;
}

// ─── Blocos visuais estruturados ────────────────────────────────────

/**
 * Uma seção aparece no documento? Texto → precisa ter conteúdo renderizável.
 * Bloco visual → precisa ter ao menos um item (senão é uma casca vazia).
 */
function secaoAparece(s: SecaoPublica): boolean {
  if (!secaoEhEstruturada(s.tipo)) return temTexto(s.conteudo);
  return blocoTemItens(s.dados);
}

/** O `dados` de um bloco visual tem ao menos um item pra renderizar? */
function blocoTemItens(dados: SecaoDados | undefined): boolean {
  const d = dados as Record<string, unknown> | undefined;
  if (!d) return false;
  const itens =
    (d.kpis as unknown[]) ??
    (d.marcos as unknown[]) ??
    (d.cases as unknown[]) ??
    (d.garantias as unknown[]) ??
    (d.membros as unknown[]) ??
    (d.perguntas as unknown[]) ??
    (d.pacotes as unknown[]);
  return Array.isArray(itens) && itens.length > 0;
}

/**
 * Despacha a seção estruturada pro componente de RENDER reusado da proposta.
 * Força `visivel: true` (a visibilidade já foi resolvida no nível da seção —
 * o `dados.visivel` legado pode estar `false` e esconderia o bloco à toa).
 */
function renderBlocoEstruturado(s: SecaoPublica): React.ReactNode {
  const base = (s.dados ?? {}) as Record<string, unknown>;
  const dados = { ...base, visivel: true };
  switch (s.tipo) {
    case "kpis":
      return <KpisPublico bloco={dados as unknown as BlocoKpis} />;
    case "timeline":
      return <TimelinePublico bloco={dados as unknown as BlocoTimeline} />;
    case "cases":
      return <CasesPublico bloco={dados as unknown as BlocoCases} />;
    case "garantias":
      return <GarantiasPublico bloco={dados as unknown as BlocoGarantias} />;
    case "equipe":
      return <EquipePublico bloco={dados as unknown as BlocoEquipe} />;
    case "faq":
      return <FaqPublico bloco={dados as unknown as BlocoFaq} />;
    case "pacotes":
      return <PacotesPublico bloco={dados as unknown as BlocoPacotes} />;
    default:
      return null;
  }
}

/**
 * CSS dos blocos visuais no TEMA CLARO do diagnóstico. Reescreve as classes
 * que `proposta-publica-blocos` emite (escuras na proposta) pra cartões claros
 * sobre fundo creme. Tudo escopado em `.diag-bloco` pra não vazar.
 */
function blocoEstruturadoCss(cor: string): string {
  return `
    .diag-bloco { --cor-primaria: ${cor}; }
    /* O <section className="bloco"> da proposta tem padding/fundo escuro;
       no diagnóstico ele é só um wrapper transparente dentro da coluna. */
    .diag-bloco .bloco {
      background: transparent;
      color: #16161D;
      padding: 0;
    }
    .diag-bloco .bloco-inner { max-width: 100%; margin: 0; }
    .diag-bloco .bloco-titulo {
      font-size: 24px;
      font-weight: 800;
      color: #16161D;
      letter-spacing: -0.02em;
      margin: 0 0 6px 0;
    }
    .diag-bloco .bloco-subtitulo { color: #6b6b76; font-size: 14px; margin: 0 0 24px 0; }

    /* Cartões: claros, borda sutil creme, sombra leve. */
    .diag-bloco .pacote,
    .diag-bloco .case-card,
    .diag-bloco .kpi-card,
    .diag-bloco .garantia-card,
    .diag-bloco .faq-item {
      background: #FFFFFF;
      border: 1px solid #ECE9E3;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .diag-bloco .pacote:hover,
    .diag-bloco .case-card:hover,
    .diag-bloco .kpi-card:hover,
    .diag-bloco .garantia-card:hover { border-color: ${cor}; }

    /* Tipografia escura dentro dos cartões. */
    .diag-bloco .pacote-nome,
    .diag-bloco .case-cliente,
    .diag-bloco .membro-nome,
    .diag-bloco .garantia-titulo,
    .diag-bloco .timeline-titulo,
    .diag-bloco .pacote-feature-destaque,
    .diag-bloco .faq-pergunta { color: #16161D; }
    .diag-bloco .pacote-feature { color: #3a3a42; }
    .diag-bloco .case-resultado { color: #2a2a31; }
    .diag-bloco .case-descricao,
    .diag-bloco .membro-bio,
    .diag-bloco .timeline-descricao,
    .diag-bloco .garantia-descricao,
    .diag-bloco .faq-resposta { color: #6b6b76; }
    .diag-bloco .pacote-x { color: #b0b0b8; }

    /* Acentos herdam a cor primária (já via var). FAQ aberta com fundo tênue. */
    .diag-bloco .faq-item-aberta { background: ${cor}0D; border-color: ${cor}; }
    .diag-bloco .timeline-marker { background: #F2EFE9; border-color: #E0DCD3; color: #9a9aa2; }
    .diag-bloco .timeline-vertical::before,
    .diag-bloco .timeline-line { background: #E0DCD3; }
    .diag-bloco .membro-linkedin { color: ${cor}; border-color: #ECE9E3; }
    .diag-bloco .membro-linkedin:hover { background: #F7F5F1; }
  `;
}
