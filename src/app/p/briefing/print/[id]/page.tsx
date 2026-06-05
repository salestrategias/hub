import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { verifyPrintToken } from "@/lib/print-token";
import { normalizarPerguntas, type BriefingPergunta } from "@/lib/briefing";

export const dynamic = "force-dynamic";

/**
 * Página de PRINT do briefing — documento A4 limpo e profissional com as
 * RESPOSTAS, pro Chromium headless (puppeteer-core) imprimir em PDF.
 *
 * Espelha o print da proposta (`/p/proposta/print/[id]`):
 *   - server component, `force-dynamic`;
 *   - AUTH DUPLA → `?t=<token>` HMAC efêmero (assinado pela rota de PDF) OU
 *     sessão NextAuth válida (Marcelo logado pré-visualiza). Sem nenhum dos
 *     dois → notFound() (assim o Chromium com token não cai no login).
 *
 * Render: cabeçalho (logo SAL + título + cliente + data) e, por SEÇÃO, cada
 * pergunta com sua resposta formatada por tipo (CAIXAS→lista, SIM_NAO, DATA
 * pt-BR, LINK/UPLOAD→texto do link, vazio→"—"). ZERO `<style jsx>`: o CSS de
 * print vai em `<style dangerouslySetInnerHTML>` (mesmo padrão da proposta).
 */
export default async function BriefingPrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  // ── Auth dupla (token de print OU sessão) ───────────────────────────
  const tokenValido = verifyPrintToken(params.id, searchParams.t);
  if (!tokenValido) {
    const session = await auth();
    if (!session?.user?.id) notFound();
  }

  const briefing = await prisma.briefing.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      titulo: true,
      perguntas: true,
      respostas: true,
      clienteNome: true,
      status: true,
      respondidoEm: true,
    },
  });
  if (!briefing) notFound();

  const perguntas = normalizarPerguntas(briefing.perguntas);
  const respostas =
    briefing.respostas && typeof briefing.respostas === "object" && !Array.isArray(briefing.respostas)
      ? (briefing.respostas as Record<string, string | string[]>)
      : {};

  // Agrupa por seção preservando a ordem de aparição (sem seção → "Geral").
  const secoes = agruparPorSecao(perguntas);

  const dataDoc = briefing.respondidoEm ?? new Date();
  const dataStr = dataDoc.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* CSS de print/documento — dangerouslySetInnerHTML (NUNCA <style jsx>). */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @page { size: A4; margin: 0; }
        html, body {
          background: #FFFFFF;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .bf-doc {
          font-family: "Plus Jakarta Sans", "Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          color: #2A2A35;
          max-width: 760px;
          margin: 0 auto;
          padding: 8px 4px 24px;
          line-height: 1.55;
          font-size: 13px;
        }
        .bf-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 18px;
          margin-bottom: 24px;
          border-bottom: 2px solid #16161D;
        }
        .bf-logo { height: 34px; width: auto; }
        .bf-eyebrow {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #8B8B9D;
          margin: 0 0 4px;
        }
        .bf-titulo {
          font-size: 22px;
          font-weight: 800;
          color: #16161D;
          letter-spacing: -0.4px;
          line-height: 1.15;
          margin: 0;
        }
        .bf-meta {
          text-align: right;
          font-size: 11px;
          color: #6A6A7A;
          white-space: nowrap;
          padding-top: 2px;
        }
        .bf-meta strong { color: #2A2A35; font-weight: 700; }
        .bf-secao { margin-bottom: 22px; break-inside: avoid; }
        .bf-secao-titulo {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: #2D1D7A;
          padding-bottom: 7px;
          margin: 0 0 12px;
          border-bottom: 1px solid #EBEBF1;
        }
        .bf-item {
          padding: 0 0 13px;
          margin-bottom: 13px;
          border-bottom: 1px solid #F4F4F8;
          break-inside: avoid;
        }
        .bf-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .bf-pergunta {
          font-size: 12.5px;
          font-weight: 700;
          color: #16161D;
          margin: 0 0 4px;
          line-height: 1.35;
        }
        .bf-resposta {
          font-size: 13px;
          color: #3A3A48;
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .bf-resposta-vazia { color: #B4B4C0; }
        .bf-lista { margin: 2px 0 0; padding-left: 18px; }
        .bf-lista li { margin-bottom: 2px; }
        .bf-link { color: #2D1D7A; word-break: break-all; }
        .bf-footer {
          margin-top: 28px;
          padding-top: 12px;
          border-top: 1px solid #EBEBF1;
          font-size: 10px;
          color: #9A9AA8;
          text-align: center;
          letter-spacing: 0.3px;
        }
      `,
        }}
      />

      <div className="bf-doc">
        <header className="bf-header">
          <div>
            <p className="bf-eyebrow">Briefing</p>
            <h1 className="bf-titulo">{briefing.titulo}</h1>
          </div>
          <div className="bf-meta">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sal-logo.svg" alt="SAL Estratégias de Marketing" className="bf-logo" />
            {briefing.clienteNome && (
              <div style={{ marginTop: 8 }}>
                <strong>{briefing.clienteNome}</strong>
              </div>
            )}
            <div style={{ marginTop: briefing.clienteNome ? 2 : 8 }}>{dataStr}</div>
          </div>
        </header>

        {secoes.length === 0 ? (
          <p className="bf-resposta bf-resposta-vazia">Este briefing não tem perguntas.</p>
        ) : (
          secoes.map((s) => (
            <section key={s.titulo} className="bf-secao">
              <h2 className="bf-secao-titulo">{s.titulo}</h2>
              {s.perguntas.map((p) => (
                <div key={p.id} className="bf-item">
                  <p className="bf-pergunta">{p.pergunta || "(sem texto)"}</p>
                  <RespostaFormatada pergunta={p} valor={respostas[p.id]} />
                </div>
              ))}
            </section>
          ))
        )}

        <footer className="bf-footer">
          SAL Estratégias de Marketing · Briefing
          {briefing.clienteNome ? ` — ${briefing.clienteNome}` : ""}
        </footer>
      </div>
    </>
  );
}

// ─── Render de resposta por tipo ────────────────────────────────────────
function RespostaFormatada({
  pergunta,
  valor,
}: {
  pergunta: BriefingPergunta;
  valor: string | string[] | undefined;
}) {
  const vazio =
    valor == null || (Array.isArray(valor) ? valor.length === 0 : String(valor).trim() === "");
  if (vazio) {
    return <p className="bf-resposta bf-resposta-vazia">—</p>;
  }

  // CAIXAS (múltipla seleção) → lista. Aceita array ou string única defensiva.
  if (pergunta.tipo === "CAIXAS") {
    const itens = Array.isArray(valor) ? valor : [String(valor)];
    return (
      <ul className="bf-resposta bf-lista">
        {itens.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    );
  }

  const texto = Array.isArray(valor) ? valor.join(", ") : String(valor);

  // DATA → pt-BR (valor vem como yyyy-mm-dd do input date).
  if (pergunta.tipo === "DATA") {
    return <p className="bf-resposta">{formatarDataBR(texto)}</p>;
  }

  // LINK / UPLOAD → mostra o link/URL como texto. UPLOAD pode guardar uma
  // dataURL (arquivo embutido) — nesse caso mostra um rótulo, não o blob.
  if (pergunta.tipo === "LINK" || pergunta.tipo === "UPLOAD") {
    if (texto.startsWith("data:")) {
      return <p className="bf-resposta">Arquivo anexado</p>;
    }
    return (
      <p className="bf-resposta">
        <span className="bf-link">{texto}</span>
      </p>
    );
  }

  return <p className="bf-resposta">{texto}</p>;
}

// ─── Helpers ────────────────────────────────────────────────────────────
type SecaoDoc = { titulo: string; perguntas: BriefingPergunta[] };

/** Agrupa perguntas por `secao` (blocos contíguos), sem seção → "Geral". */
function agruparPorSecao(perguntas: BriefingPergunta[]): SecaoDoc[] {
  const secoes: SecaoDoc[] = [];
  for (const p of perguntas) {
    const titulo = p.secao ?? "Geral";
    const ultima = secoes[secoes.length - 1];
    if (ultima && ultima.titulo === titulo) {
      ultima.perguntas.push(p);
    } else {
      secoes.push({ titulo, perguntas: [p] });
    }
  }
  return secoes;
}

/** yyyy-mm-dd (ou ISO) → dd/mm/aaaa. Faz parse local pra não deslocar o dia. */
function formatarDataBR(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? s : dt.toLocaleDateString("pt-BR");
}
