"use client";
import { useCallback, useEffect, useState } from "react";
import { BlockRenderer } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, XCircle, FileText, Mic, CheckSquare } from "lucide-react";

type ShareData =
  | { tipo: "NOTA" | "BRIEFING"; titulo: string; pasta: string; tags: string[]; conteudo: string; atualizadoEm: string; podeBaixarPdf: boolean }
  | {
      tipo: "REUNIAO";
      titulo: string;
      data: string;
      cliente: string | null;
      resumoIA: string | null;
      notasLivres: string | null;
      actionItems: Array<{ texto: string; responsavel: string | null; prazo: string | null; concluido: boolean }>;
      podeBaixarPdf: boolean;
    };

export function SharePublica({ token }: { token: string }) {
  const [data, setData] = useState<ShareData | null>(null);
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
        const res = await fetch(`/api/p/share/${token}`, opts);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error ?? "Falha ao carregar");
        }
        const d = await res.json();
        if (d.precisaSenha) {
          setPrecisaSenha(true);
          setLoading(false);
          return;
        }
        setData(d);
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

  if (precisaSenha) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="h-14 w-14 rounded-full bg-sal-600/15 text-sal-400 flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Conteúdo protegido</h1>
            <p className="text-sm text-muted-foreground mt-2">Digite a senha pra continuar.</p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              onKeyDown={(e) =>
                e.key === "Enter" && senha.trim() && (setAutenticando(true), carregar(senha))
              }
              autoFocus
            />
            <Button
              onClick={() => {
                setAutenticando(true);
                carregar(senha);
              }}
              disabled={autenticando || !senha.trim()}
              className="w-full"
            >
              {autenticando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar"}
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
          <h1 className="font-display text-xl font-semibold">Conteúdo não disponível</h1>
          <p className="text-sm text-muted-foreground">{erro}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">
      {data.tipo === "REUNIAO" ? <ConteudoReuniao data={data} /> : <ConteudoNota data={data} />}
      <footer className="mt-20 pt-6 border-t border-border text-center text-[10.5px] text-muted-foreground">
        Compartilhado via SAL Hub · {new Date().toLocaleDateString("pt-BR")}
      </footer>
    </div>
  );
}

function ConteudoNota({
  data,
}: {
  data: Extract<ShareData, { tipo: "NOTA" | "BRIEFING" }>;
}) {
  const Icon = data.tipo === "BRIEFING" ? FileText : FileText;
  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
          <Badge variant="outline" className="text-[10px]">{data.pasta}</Badge>
          {data.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
          ))}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{data.titulo}</h1>
        <p className="text-[11px] text-muted-foreground font-mono">
          Atualizado em {new Date(data.atualizadoEm).toLocaleDateString("pt-BR")}
        </p>
      </header>
      <div className="prose-sal">
        <BlockRenderer value={data.conteudo} />
      </div>
    </article>
  );
}

function ConteudoReuniao({
  data,
}: {
  data: Extract<ShareData, { tipo: "REUNIAO" }>;
}) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
            <Mic className="h-4 w-4" />
          </div>
          <Badge variant="outline" className="text-[10px]">Reunião</Badge>
          {data.cliente && <span className="text-[11px] text-muted-foreground">· {data.cliente}</span>}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{data.titulo}</h1>
        <p className="text-[11px] text-muted-foreground font-mono">
          {new Date(data.data).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>

      {data.resumoIA && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">Resumo</h2>
          <BlockRenderer value={data.resumoIA} />
        </section>
      )}

      {data.actionItems.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">Action items</h2>
          <ul className="space-y-2">
            {data.actionItems.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <CheckSquare className={`h-4 w-4 mt-0.5 shrink-0 ${a.concluido ? "text-emerald-400" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <span className={a.concluido ? "line-through text-muted-foreground" : ""}>{a.texto}</span>
                  {(a.responsavel || a.prazo) && (
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {a.responsavel}{a.responsavel && a.prazo ? " · " : ""}{a.prazo}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.notasLivres && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">Notas</h2>
          <BlockRenderer value={data.notasLivres} />
        </section>
      )}
    </article>
  );
}
