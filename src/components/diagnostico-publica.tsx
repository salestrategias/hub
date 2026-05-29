"use client";
import { useCallback, useEffect, useState } from "react";
import { BlockRenderer } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XCircle, Lock, Download, Loader2 } from "lucide-react";

/**
 * Apresentação pública do diagnóstico (modo leitura/apresentação).
 *
 * Espelha o espírito de `proposta-publica.tsx`, mas o diagnóstico:
 *  - é só leitura elegante (sem aceite/recusa — não é contrato);
 *  - renderiza as seções VISÍVEIS na ordem (o server já filtra/ordena);
 *  - tem visual de "documento" (superfície clara), independente do tema do app.
 *
 * O registro de view + senha + expiração ficam no endpoint
 * `/api/p/diagnostico/{token}`.
 */

type SecaoPublica = {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
};

type DiagnosticoPublicaData = {
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

export function DiagnosticoPublica({ token }: { token: string }) {
  const [diag, setDiag] = useState<DiagnosticoPublicaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaSenha, setPrecisaSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [autenticando, setAutenticando] = useState(false);

  const carregar = useCallback(
    async (senhaProvida?: string) => {
      setLoading(true);
      setErro(null);
      try {
        const opts: RequestInit = senhaProvida
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ senha: senhaProvida }),
            }
          : { method: "GET" };
        const res = await fetch(`/api/p/diagnostico/${token}`, opts);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error ?? "Falha ao carregar");
        }
        const data = await res.json();
        if (data.precisaSenha) {
          setPrecisaSenha(true);
          setLoading(false);
          return;
        }
        setDiag(data);
        setPrecisaSenha(false);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      } finally {
        setLoading(false);
        setAutenticando(false);
      }
    },
    [token]
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function tentarSenha() {
    if (!senha.trim()) return;
    setAutenticando(true);
    await carregar(senha);
  }

  // ─── Estados ─────────────────────────────────────────────────

  if (precisaSenha) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="h-14 w-14 rounded-full bg-sal-600/15 text-sal-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Diagnóstico protegido</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Este diagnóstico foi enviado com senha. Digite-a abaixo pra continuar.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              onKeyDown={(e) => e.key === "Enter" && tentarSenha()}
              autoFocus
            />
            <Button onClick={tentarSenha} disabled={autenticando} className="w-full">
              {autenticando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar diagnóstico"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sal-400" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <XCircle className="h-12 w-12 text-rose-400 mx-auto" />
          <h1 className="font-display text-xl font-semibold">Não foi possível abrir o diagnóstico</h1>
          <p className="text-sm text-muted-foreground">{erro}</p>
          <p className="text-[11px] text-muted-foreground/70">
            Se você acha que isso é um erro, entre em contato com quem enviou o link.
          </p>
        </div>
      </div>
    );
  }

  if (!diag) return null;

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
    <div className="min-h-screen" style={{ background: "#FBFAF8", color: "#16161D" }}>
      {/* Barra superior fina com a cor do diagnóstico */}
      <div style={{ height: 4, background: cor }} />

      {/* Top bar: logo + baixar PDF */}
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
        <a
          href={`/api/diagnosticos/${diag.id}/pdf?token=${token}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-black/[0.03]"
          style={{ borderColor: hexAlpha(cor, 0.35), color: cor }}
        >
          <Download className="h-3.5 w-3.5" /> Baixar PDF
        </a>
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
                    <span
                      className="font-mono text-[11px] tabular-nums"
                      style={{ color: cor }}
                    >
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
          Diagnóstico estratégico · <span className="font-semibold">SAL Estratégias de Marketing</span>
        </p>
        {diag.autorEmail && <p className="mt-1">{diag.autorEmail}</p>}
      </footer>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Cor hex + alpha → rgba(). Fallback no roxo SAL se hex inválido. */
function hexAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return `rgba(126, 48, 225, ${alpha})`;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 0xff}, ${(v >> 8) & 0xff}, ${v & 0xff}, ${alpha})`;
}

/** Detecta se uma seção BlockNote tem texto renderizável (pra esconder vazias). */
function temTexto(conteudo: string): boolean {
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
