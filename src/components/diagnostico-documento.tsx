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

export type SecaoPublica = {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
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
  const secoes = diag.secoes.filter((s) => temTexto(s.conteudo));
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

      {/* Sumário navegável (se houver várias seções) */}
      {secoes.length > 2 && (
        <nav className="max-w-3xl mx-auto px-6 sm:px-8 mb-10">
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "#ECE9E3", background: "#FFFFFF" }}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-neutral-400 mb-3">
              Neste diagnóstico
            </p>
            <ol className="space-y-1.5">
              {secoes.map((s, i) => (
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

      {/* Seções */}
      <main className="max-w-3xl mx-auto px-6 sm:px-8 pb-24 space-y-14">
        {secoes.map((s, i) => (
          <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-8">
            <div className="flex items-baseline gap-3 mb-4">
              <span
                className="font-mono text-[12px] font-semibold tabular-nums"
                style={{ color: cor }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight leading-tight">
                {s.titulo}
              </h2>
            </div>
            <div className="diagnostico-secao-conteudo pl-0 sm:pl-8 text-[15px] leading-relaxed">
              <BlockRenderer value={s.conteudo} />
            </div>
          </section>
        ))}

        {secoes.length === 0 && (
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
