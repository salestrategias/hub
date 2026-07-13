"use client";
/**
 * MODO REVISÃO v5 — stories (padrão do protótipo aprovado).
 *
 * Imersivo e sempre escuro (como stories do Instagram): barra de
 * progresso SEGMENTADA no topo (um segmento por item), arte grande,
 * legenda logo abaixo, dois botões fixos no rodapé (Pedir ajuste /
 * Aprovar) e "Decidir depois". Fim de fila = check animado.
 *
 * Lógica do v4 mantida: busca posts + criativos ao abrir (dados
 * frescos), filtra o que está "aguardando você", age direto nos
 * endpoints de aprovar/comentar. Ao fechar, avisa o pai pra recarregar.
 *
 * createPortal(document.body) + scroll lock (lição do drawer mobile).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, MessageSquare, X, Loader2, ArrowRight, Check } from "lucide-react";
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

const FUNDO = "#0D0A16";
const PAINEL = "#1A1428";

export function PortalRevisao({
  token,
  clienteNome,
  corMarca,
  permissoes,
  onFechar,
}: {
  token: string;
  clienteNome: string;
  corMarca: string;
  permissoes: Perms;
  /** Chamado ao sair (X, fim da fila). `agiu` = decidiu ≥1 item. */
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
        setFila([...posts, ...criativos].filter(aguardandoCliente));
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

  const chips: string[] = atual
    ? atual.kind === "post"
      ? [
          "Orgânico",
          FORMATO_LABEL_POST[(atual as PostPortal).formato] ?? (atual as PostPortal).formato,
          new Date((atual as PostPortal).dataPublicacao).toLocaleDateString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
          }),
        ]
      : ["Anúncio", PLATAFORMA_LABEL[(atual as CriativoPortal).plataforma] ?? (atual as CriativoPortal).plataforma]
    : [];

  const conteudo = (
    <div
      className="fixed inset-0 z-50 flex flex-col text-white"
      style={{ background: FUNDO }}
      role="dialog"
      aria-modal="true"
      aria-label="Modo revisão de conteúdo"
    >
      {/* Progresso segmentado (stories) */}
      {total > 0 && !acabou && (
        <div className="safe-area-inset-top flex gap-[5px] px-3.5 pt-3.5">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className="h-[3.5px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full bg-white transition-all duration-300"
                style={{ width: i < indice ? "100%" : i === indice ? "45%" : "0%" }}
              />
            </span>
          ))}
        </div>
      )}

      {/* Topo: marca + título + fechar */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-extrabold text-white"
          style={{ background: corMarca }}
        >
          {clienteNome.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[12.5px] font-bold">Revisar conteúdo</div>
          {total > 0 && !acabou && (
            <div className="text-[10.5px] opacity-60 tabular-nums">
              {Math.min(indice + 1, total)} de {total}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onFechar(feitos > 0)}
          className="touch-feedback ml-auto flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
          aria-label="Fechar revisão"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Corpo */}
      {fila === null ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: corMarca }} />
        </div>
      ) : acabou || total === 0 ? (
        <TelaFim total={total} feitos={feitos} corMarca={corMarca} onFechar={() => onFechar(feitos > 0)} />
      ) : atual ? (
        <>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl space-y-3.5 px-4 pb-6">
              {atual.arquivos.length > 0 && <ArtesCarrossel arquivos={atual.arquivos} compacto />}

              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-white/14 px-2.5 py-1 text-[10.5px] font-bold"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <h2 className="font-display text-[19px] font-extrabold leading-snug tracking-tight">
                  {atual.titulo}
                </h2>
              </div>

              {atual.kind === "post" ? (
                <>
                  {(atual as PostPortal).legenda && (
                    <div className="rounded-2xl p-3.5" style={{ background: PAINEL }}>
                      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-white/50">
                        Legenda
                      </div>
                      <BlockRenderer
                        value={(atual as PostPortal).legenda!}
                        className="text-[13.5px] leading-relaxed text-white/85"
                      />
                    </div>
                  )}
                  {(atual as PostPortal).cta && (
                    <div
                      className="rounded-2xl px-3.5 py-2.5"
                      style={{ background: PAINEL, borderLeft: `4px solid ${corMarca}` }}
                    >
                      <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-[.08em]" style={{ color: corMarca }}>
                        Chamada pra ação
                      </div>
                      <div className="text-[13px] font-bold leading-snug">{(atual as PostPortal).cta}</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {(atual as CriativoPortal).textoPrincipal && (
                    <div className="rounded-2xl p-3.5" style={{ background: PAINEL }}>
                      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-white/50">
                        Texto do anúncio
                      </div>
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">
                        {(atual as CriativoPortal).textoPrincipal}
                      </p>
                    </div>
                  )}
                  {(atual as CriativoPortal).headline && (
                    <div className="rounded-2xl p-3.5" style={{ background: PAINEL }}>
                      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-white/50">
                        Título do anúncio
                      </div>
                      <p className="text-[13.5px] font-bold leading-snug">
                        {(atual as CriativoPortal).headline}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Caixa de ajuste inline */}
              {ajustando && (
                <div className="space-y-2.5 rounded-2xl p-3.5" style={{ background: PAINEL }}>
                  <div className="text-[12px] font-bold text-amber-400">O que você quer ajustar?</div>
                  <Textarea
                    value={textoAjuste}
                    onChange={(e) => setTextoAjuste(e.target.value)}
                    placeholder="Quanto mais específico, mais rápido a SAL resolve."
                    rows={4}
                    autoFocus
                    className="min-h-[100px] rounded-xl border-white/15 bg-black/40 text-base text-white placeholder:text-white/35 sm:text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAjustando(false);
                        setTextoAjuste("");
                      }}
                      className="touch-feedback h-11 flex-1 rounded-full bg-white/10 text-[13.5px] font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={enviarAjuste}
                      disabled={agindo || textoAjuste.trim().length < 3}
                      className="touch-feedback flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13.5px] font-extrabold text-white disabled:opacity-50"
                      style={{ background: corMarca }}
                    >
                      {agindo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      Enviar pedido
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Rodapé fixo */}
          {!ajustando && (
            <footer className="pb-[env(safe-area-inset-bottom)]" style={{ background: FUNDO }}>
              <div className="mx-auto max-w-2xl space-y-2 px-4 py-3">
                <div className="flex gap-2.5">
                  {permissoes.podeComentar && (
                    <button
                      type="button"
                      onClick={() => setAjustando(true)}
                      disabled={agindo}
                      className="touch-feedback flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 text-[14.5px] font-bold"
                    >
                      <MessageSquare className="h-4 w-4" /> Pedir ajuste
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={aprovar}
                    disabled={agindo}
                    className="touch-feedback flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-500 text-[14.5px] font-extrabold text-white"
                  >
                    {agindo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Aprovar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={proximo}
                  disabled={agindo}
                  className="touch-feedback mx-auto flex items-center gap-1 text-[12px] font-medium text-white/55 hover:text-white/80"
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
  corMarca,
  onFechar,
}: {
  total: number;
  feitos: number;
  corMarca: string;
  onFechar: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-sm space-y-3.5 text-center">
        <span className="p5-pop mx-auto flex h-[86px] w-[86px] items-center justify-center rounded-full bg-emerald-500">
          <Check className="h-11 w-11 text-white" strokeWidth={3} />
        </span>
        <h2 className="font-display text-[22px] font-extrabold tracking-tight">
          {total === 0 ? "Nada esperando você" : feitos === 0 ? "Fila encerrada" : "Tudo revisado!"}
        </h2>
        <p className="text-[13.5px] leading-relaxed text-white/70">
          {total === 0
            ? "Quando a SAL mandar conteúdo novo pra aprovação, ele aparece aqui."
            : feitos === 0
              ? "Você deixou pra decidir depois — os conteúdos continuam na aba Conteúdo."
              : `Você decidiu ${feitos} ${feitos === 1 ? "conteúdo" : "conteúdos"}. A SAL já foi avisada e segue com a produção.`}
        </p>
        <button
          type="button"
          onClick={onFechar}
          className="touch-feedback mx-auto mt-1 block rounded-full px-8 py-3.5 text-[14px] font-extrabold text-white"
          style={{ background: corMarca }}
        >
          Voltar ao portal
        </button>
      </div>
    </div>
  );
}
