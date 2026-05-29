"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XCircle, Lock, Download, Loader2 } from "lucide-react";
import {
  DiagnosticoDocumento,
  type DiagnosticoDocumentoData,
} from "@/components/diagnostico-documento";

/**
 * Apresentação pública do diagnóstico (modo leitura/apresentação).
 *
 * Espelha o espírito de `proposta-publica.tsx`: este componente detém a busca
 * de dados (via `/api/p/diagnostico/{token}`), senha, expiração e estados de
 * loading/erro, e delega o RENDER do documento a `<DiagnosticoDocumento>` —
 * o mesmo componente reusado pela página de print (`/p/diagnostico/print/[id]`),
 * garantindo que a web e o PDF (Chromium) fiquem idênticos.
 *
 * O chrome interativo (botão "Baixar PDF") é passado via `children`.
 */

type DiagnosticoPublicaData = DiagnosticoDocumentoData;

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

  return (
    <DiagnosticoDocumento diag={diag}>
      {/* Chrome interativo: botão "Baixar PDF" (default engine = Chromium). */}
      <a
        href={`/api/diagnosticos/${diag.id}/pdf?token=${token}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-black/[0.03]"
        style={{ borderColor: hexAlpha(cor, 0.35), color: cor }}
      >
        <Download className="h-3.5 w-3.5" /> Baixar PDF
      </a>
    </DiagnosticoDocumento>
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
