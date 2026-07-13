"use client";
/**
 * Portal v4 — MODO REVISÃO: fila de aprovação item a item.
 *
 * Em vez de caçar cards na lista, o cliente toca "Revisar" e percorre os
 * conteúdos pendentes um por um, em tela cheia: arte grande, legenda,
 * dois botões fixos no rodapé (Aprovar / Pedir ajuste) e "Pular". Barra
 * de progresso em cima; tela de "tudo revisado" no final.
 *
 * Self-contained: busca posts + criativos ao abrir (dados frescos),
 * filtra o que está "aguardando você" e age direto nos endpoints de
 * aprovar/comentar. Ao fechar, avisa o pai pra recarregar listas/badges.
 *
 * Renderiza via createPortal(document.body) — imune a containing blocks
 * de backdrop-filter (lição do drawer mobile). Trava o scroll do body.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, MessageSquare, X, Loader2, PartyPopper, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { BlockRenderer } from "@/components/editor";
import { fetchPortal } from "@/lib/portal-fetch";
import {
  type ItemConteudo,
  type PostPortal,
  type CriativoPortal,
  aguardandoCliente,
  aprovarItem,
  pedirAjusteItem,
  ArtesCarrossel,
  FORMATO_LABEL_POST,
  PLATAFORMA_LABEL,
} from "@/components/portal-conteudo-shared";

type Perms = {
  verCalendario: boolean;
  verCriativos: boolean;
  podeAprovarPosts: boolean;
  podeAprovarCriativos: boolean;
  podeComentar: boolean;
};

export function PortalRevisao({
  token,
  permissoes,
  onFechar,
}: {
  token: string;
  permissoes: Perms;
  /** Chamado ao sair (X, fim da fila). `agiu` = aprovou/pediu ajuste em ≥1. */
  onFechar: (agiu: boolean) => void;
}) {
  const [fila, setFila] = useState<ItemConteudo[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [feitos, setFeitos] = useState(0);
  const [agindo, setAgindo] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [textoAjuste, setTextoAjuste] = useState("");

  // Trava o scroll do body enquanto o overlay está aberto.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Busca dados frescos ao abrir.
  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const [resPosts, resCriativos] = await Promise.all([
          permissoes.verCalendario && permissoes.podeAprovarPosts
            ? fetchPortal(`/api/p/cliente/${token}/calendario`)
            : Promise.resolve(null),
          permissoes.verCriativos && permissoes.podeAprovarCriativos
            ? fetchPortal(`/api/p/cliente/${token}/criativos`)
            : Promise.resolve(null),
        ]);
        const posts: ItemConteudo[] = [];
        const criativos: ItemConteudo[] = [];
        if (resPosts?.ok) {
          const data = await resPosts.json().catch(() => null);
          if (Array.isArray(data)) posts.push(...data.map((p) => ({ ...p, kind: "post" as const })));
        }
        if (resCriativos?.ok) {
          const data = await resCriativos.json().catch(() => null);
          if (Array.isArray(data))
            criativos.push(...data.map((c) => ({ ...c, kind: "criativo" as const })));
        }
        if (cancelado) return;
        // Fila: pendentes, posts por data crescente primeiro, depois anúncios.
        const pendentes = [...posts, ...criativos].filter(aguardandoCliente);
        setFila(pendentes);
      } catch {
        if (!cancelado) setFila([]);
      }
    }
    void carregar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const atual = fila?.[indice] ?? null;
  const total = fila?.length ?? 0;
  const acabou = fila !== null && indice >= total;

  const meta = useMemo(() => {
    if (!atual) return null;
    if (atual.kind === "post") {
      const p = atual as PostPortal;
      return {
        chips: [
          "Orgânico",
          FORMATO_LABEL_POST[p.formato] ?? p.formato,
          new Date(p.dataPublicacao).toLocaleDateString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
          }),
        ],
      };
    }
    const c = atual as CriativoPortal;
    return {
      chips: ["Anúncio", PLATAFORMA_LABEL[c.plataforma] ?? c.plataforma],
    };
  }, [atual]);

  function proximo() {
    setAjustando(false);
    setTextoAjuste("");
    setIndice((i) => i + 1);
  }

  async function aprovar() {
    if (!atual || agindo) return;
    setAgindo(true);
    try {
      const ok = await aprovarItem(token, atual);
      if (!ok) return;
      setFeitos((f) => f + 1);
      toast.success("Aprovado!");
      proximo();
    } finally {
      setAgindo(false);
    }
  }

  async function enviarAjuste() {
    if (!atual || agindo) return;
    if (textoAjuste.trim().length < 3) {
      toast.error("Escreva um pouco mais pra SAL entender o ajuste");
      return;
    }
    setAgindo(true);
    try {
      const ok = await pedirAjusteItem(token, atual, textoAjuste.trim());
      if (!ok) return;
      setFeitos((f) => f + 1);
      toast.success("Pedido enviado!");
      proximo();
    } finally {
      setAgindo(false);
    }
  }

  const conteudo = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Modo revisão de conteúdo"
    >
      {/* Header: título + progresso + fechar */}
      <header className="safe-area-inset-top border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-sm font-semibold leading-tight">Revisar conteúdo</h1>
            {total > 0 && !acabou && (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {Math.min(indice + 1, total)} de {total}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onFechar(feitos > 0)}
            className="touch-feedback flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar revisão"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Barra de progresso */}
        {total > 0 && (
          <div className="h-1 w-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(Math.min(indice, total) / total) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Corpo */}
      {fila === null ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : acabou || total === 0 ? (
        <TelaFim total={total} feitos={feitos} onFechar={() => onFechar(feitos > 0)} />
      ) : atual ? (
        <>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 py-4 space-y-3 pb-6">
              {atual.arquivos.length > 0 && (
                <ArtesCarrossel arquivos={atual.arquivos} compacto />
              )}
              <div className="space-y-1.5">
                <h2 className="font-display text-base font-semibold leading-snug">{atual.titulo}</h2>
                {meta && (
                  <div className="flex flex-wrap gap-1.5">
                    {meta.chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {atual.kind === "post" ? (
                <>
                  {(atual as PostPortal).legenda && (
                    <div className="rounded-lg bg-muted/30 border border-border p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                        Legenda
                      </div>
                      <BlockRenderer
                        value={(atual as PostPortal).legenda!}
                        className="text-[13px] leading-relaxed"
                      />
                    </div>
                  )}
                  {(atual as PostPortal).cta && (
                    <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                        Chamada pra ação
                      </div>
                      <div className="text-[12.5px] font-medium leading-snug">
                        {(atual as PostPortal).cta}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {(atual as CriativoPortal).textoPrincipal && (
                    <div className="rounded-lg bg-muted/30 border border-border p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                        Texto do anúncio
                      </div>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                        {(atual as CriativoPortal).textoPrincipal}
                      </p>
                    </div>
                  )}
                  {(atual as CriativoPortal).headline && (
                    <div className="rounded-lg bg-muted/30 border border-border p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                        Título do anúncio
                      </div>
                      <p className="text-[13px] font-medium leading-snug">
                        {(atual as CriativoPortal).headline}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Caixa de ajuste inline (aparece ao tocar "Pedir ajuste") */}
              {ajustando && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    O que você quer ajustar?
                  </div>
                  <Textarea
                    value={textoAjuste}
                    onChange={(e) => setTextoAjuste(e.target.value)}
                    placeholder="Quanto mais específico, mais rápido a SAL resolve."
                    rows={4}
                    autoFocus
                    className="text-base sm:text-sm min-h-[100px] bg-background"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAjustando(false);
                        setTextoAjuste("");
                      }}
                      className="h-10 flex-1 touch-feedback"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={enviarAjuste}
                      disabled={agindo || textoAjuste.trim().length < 3}
                      className="h-10 flex-1 touch-feedback"
                    >
                      {agindo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      Enviar pedido
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Rodapé fixo: as duas decisões grandes + pular */}
          {!ajustando && (
            <footer className="border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
              <div className="mx-auto max-w-2xl px-4 py-3 space-y-2">
                <div className="flex gap-2">
                  {permissoes.podeComentar && (
                    <Button
                      variant="outline"
                      onClick={() => setAjustando(true)}
                      disabled={agindo}
                      className="h-12 flex-1 text-sm touch-feedback"
                    >
                      <MessageSquare className="h-4 w-4" /> Pedir ajuste
                    </Button>
                  )}
                  <Button
                    onClick={aprovar}
                    disabled={agindo}
                    className="h-12 flex-1 text-sm touch-feedback bg-emerald-600 text-white hover:bg-emerald-600/90"
                  >
                    {agindo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Aprovar
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={proximo}
                  disabled={agindo}
                  className="touch-feedback mx-auto flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Decidir depois <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </footer>
          )}
        </>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(conteudo, document.body);
}

function TelaFim({
  total,
  feitos,
  onFechar,
}: {
  total: number;
  feitos: number;
  onFechar: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-3">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
          <PartyPopper className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </span>
        <h2 className="font-display text-lg font-semibold">
          {total === 0
            ? "Nada esperando você"
            : feitos === 0
              ? "Fila encerrada"
              : "Tudo revisado!"}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {total === 0
            ? "Quando a SAL mandar conteúdo novo pra aprovação, ele aparece aqui."
            : feitos === 0
              ? "Você deixou pra decidir depois — os conteúdos continuam na aba Conteúdo."
              : `Você revisou ${feitos} ${feitos === 1 ? "conteúdo" : "conteúdos"}. A SAL já foi avisada.`}
        </p>
        <Button onClick={onFechar} className="h-11 w-full touch-feedback">
          Voltar ao portal
        </Button>
      </div>
    </div>
  );
}
