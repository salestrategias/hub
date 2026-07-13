"use client";
/**
 * Portal v4 — cards de conteúdo (post e criativo) da aba Conteúdo.
 *
 * Novidades vs. v3:
 *  - Estado sem ambiguidade: "Aguardando você" mostra os botões grandes;
 *    depois de pedir ajuste o card vira "Com a SAL" e os botões primários
 *    SOMEM (ficam só links discretos de aprovar mesmo assim / comentar).
 *  - Thread completa de comentários (não só o 1º de cada tipo).
 *  - Remoção de arte com dialog próprio (adeus window.confirm).
 *  - Jargão traduzido: "Copy / Legenda" → "Legenda", pilar não vaza.
 */
import { useState } from "react";
import { CheckCircle2, MessageSquare, Clock, Hash, Hourglass } from "lucide-react";
import { BlockRenderer } from "@/components/editor";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ExternalLink, Target } from "lucide-react";
import { fetchPortal } from "@/lib/portal-fetch";
import {
  type ItemConteudo,
  type PostPortal,
  type CriativoPortal,
  type Arquivo,
  ArtesCarrossel,
  ThreadComentarios,
  estadoAprovacao,
  statusLabel,
  statusUI,
  dataCurta,
  FORMATO_LABEL_POST,
  FORMATO_LABEL_CRIATIVO,
  PLATAFORMA_LABEL,
  RemoverArteDialog,
} from "@/components/portal-conteudo-shared";
import { BotaoAnexarArte, AnexarArteDialog } from "@/components/portal-anexar-arte";

export function ConteudoCard({
  item,
  token,
  podeAprovar,
  podeComentar,
  podeEnviar,
  onAprovar,
  onPedirAjuste,
  onAlterado,
}: {
  item: ItemConteudo;
  token: string;
  podeAprovar: boolean;
  podeComentar: boolean;
  podeEnviar: boolean;
  onAprovar: (item: ItemConteudo) => void;
  onPedirAjuste: (item: ItemConteudo) => void;
  onAlterado: () => void;
}) {
  const [anexando, setAnexando] = useState(false);
  const [removendoArte, setRemovendoArte] = useState<Arquivo | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const ui = statusUI(item.status);
  const estado = estadoAprovacao(item);
  const aguardaVoce = estado === "aguardando_voce" && podeAprovar;
  const comASal = estado === "com_a_sal";
  const ehPost = item.kind === "post";
  const post = ehPost ? (item as PostPortal) : null;
  const criativo = !ehPost ? (item as CriativoPortal) : null;

  async function removerArte(arquivo: Arquivo) {
    if (!post) return;
    setRemovendo(true);
    try {
      const res = await fetchPortal(
        `/api/p/cliente/${token}/posts/${post.id}/arquivos/${arquivo.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao remover");
        return;
      }
      toast.success("Arte removida");
      setRemovendoArte(null);
      onAlterado();
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 flex items-start gap-3">
          {ehPost ? (
            <div className={`shrink-0 w-12 h-12 rounded-xl border flex flex-col items-center justify-center ${ui.tile}`}>
              <span className="text-[9px] uppercase font-semibold">
                {new Date(post!.dataPublicacao)
                  .toLocaleDateString("pt-BR", { month: "short" })
                  .replace(".", "")}
              </span>
              <span className="text-lg font-mono font-semibold leading-none">
                {new Date(post!.dataPublicacao).getDate()}
              </span>
            </div>
          ) : (
            <div className={`shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center ${ui.tile}`}>
              <Target className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-sm leading-tight">{item.titulo}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${ui.badge}`}>
                {statusLabel(item)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {ehPost ? "Orgânico" : "Anúncio"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {ehPost
                  ? FORMATO_LABEL_POST[item.formato] ?? item.formato
                  : PLATAFORMA_LABEL[criativo!.plataforma] ?? criativo!.plataforma}
              </Badge>
            </div>
          </div>
        </div>

        {/* Carrossel de artes */}
        {item.arquivos.length > 0 && (
          <ArtesCarrossel
            arquivos={item.arquivos}
            onRemover={ehPost && podeEnviar ? (a) => setRemovendoArte(a) : undefined}
          />
        )}

        <div className="px-4 pb-4 pt-3 space-y-3">
          {/* Corpo por tipo */}
          {ehPost ? (
            <CorpoPost post={post!} />
          ) : (
            <CorpoCriativo criativo={criativo!} />
          )}

          {/* Estado + conversa */}
          {(item.comentarios.length > 0 || estado !== "acompanhando") && (
            <div className="space-y-2 border-t border-border/40 pt-3">
              {estado === "aguardando_voce" && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5 shrink-0" /> Aguardando sua aprovação
                </div>
              )}
              {comASal && (
                <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                    <Hourglass className="h-3.5 w-3.5 shrink-0" />
                    Com a SAL — seu pedido de ajuste está sendo feito
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                    Quando a SAL atualizar o conteúdo, ele volta pra sua aprovação.
                  </p>
                </div>
              )}
              {estado === "aprovado" && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Aprovado por você
                  {item.comentarios.find((c) => c.tipo === "APROVOU") &&
                    ` em ${dataCurta(item.comentarios.find((c) => c.tipo === "APROVOU")!.createdAt)}`}
                </div>
              )}
              <ThreadComentarios comentarios={item.comentarios} />
            </div>
          )}

          {/* Ações — só quando a bola está com o cliente */}
          {aguardaVoce && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                onClick={() => onAprovar(item)}
                className="flex-1 h-11 sm:h-9 text-sm sm:text-xs touch-feedback bg-emerald-600 text-white hover:bg-emerald-600/90"
              >
                <CheckCircle2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Aprovar
              </Button>
              {podeComentar && (
                <Button
                  variant="outline"
                  onClick={() => onPedirAjuste(item)}
                  className="flex-1 h-11 sm:h-9 text-sm sm:text-xs touch-feedback"
                >
                  <MessageSquare className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Pedir ajuste
                </Button>
              )}
              {ehPost && podeEnviar && <BotaoAnexarArte onClick={() => setAnexando(true)} />}
            </div>
          )}

          {/* Com a SAL: ações rebaixadas a links discretos */}
          {comASal && (podeAprovar || podeComentar) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
              {podeAprovar && (
                <button
                  type="button"
                  onClick={() => onAprovar(item)}
                  className="touch-feedback text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Aprovar mesmo assim
                </button>
              )}
              {podeComentar && (
                <button
                  type="button"
                  onClick={() => onPedirAjuste(item)}
                  className="touch-feedback text-[11.5px] font-medium text-muted-foreground hover:underline"
                >
                  Adicionar outro comentário
                </button>
              )}
              {ehPost && podeEnviar && (
                <button
                  type="button"
                  onClick={() => setAnexando(true)}
                  className="touch-feedback text-[11.5px] font-medium text-muted-foreground hover:underline"
                >
                  Anexar arte
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {anexando && post && (
        <AnexarArteDialog
          token={token}
          postId={post.id}
          postTitulo={post.titulo}
          onClose={() => setAnexando(false)}
          onSuccess={() => {
            setAnexando(false);
            onAlterado();
          }}
        />
      )}

      {removendoArte && (
        <RemoverArteDialog
          nomeArte={removendoArte.nome}
          removendo={removendo}
          onClose={() => setRemovendoArte(null)}
          onConfirmar={() => removerArte(removendoArte)}
        />
      )}
    </Card>
  );
}

// ─── Corpo específico de post ──────────────────────────────────────────
function CorpoPost({ post }: { post: PostPortal }) {
  return (
    <>
      {post.legenda && (
        <div className="rounded-lg bg-muted/30 border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Legenda
          </div>
          <BlockRenderer value={post.legenda} className="text-[12.5px] leading-relaxed" />
        </div>
      )}

      {post.hashtags.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
            <Hash className="h-3 w-3" /> Hashtags
          </div>
          <div className="flex flex-wrap gap-1">
            {post.hashtags.map((t) => (
              <span
                key={t}
                className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {post.cta && (
        <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
            Chamada pra ação
          </div>
          <div className="text-[12.5px] font-medium leading-snug">{post.cta}</div>
        </div>
      )}
    </>
  );
}

// ─── Corpo específico de criativo ──────────────────────────────────────
function CorpoCriativo({ criativo }: { criativo: CriativoPortal }) {
  return (
    <>
      {criativo.textoPrincipal && (
        <div className="rounded-lg bg-muted/30 border border-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Texto do anúncio
          </div>
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{criativo.textoPrincipal}</p>
        </div>
      )}

      {(criativo.headline || criativo.descricao) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {criativo.headline && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Título do anúncio
              </div>
              <p className="text-[12.5px] font-medium leading-snug">{criativo.headline}</p>
            </div>
          )}
          {criativo.descricao && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Descrição
              </div>
              <p className="text-[12.5px] leading-snug">{criativo.descricao}</p>
            </div>
          )}
        </div>
      )}

      {(criativo.ctaBotao || criativo.urlDestino) && (
        <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 px-3 py-2 space-y-1">
          {criativo.ctaBotao && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                Botão do anúncio
              </div>
              <div className="text-[12.5px] font-medium leading-snug">{criativo.ctaBotao}</div>
            </div>
          )}
          {criativo.urlDestino && (
            <a
              href={criativo.urlDestino}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] text-primary hover:underline flex items-center gap-1 break-all"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {criativo.urlDestino}
            </a>
          )}
        </div>
      )}

      {criativo.publicoAlvo && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
            <Target className="h-3 w-3" /> Público-alvo
          </div>
          <p className="text-[12px] text-muted-foreground leading-snug whitespace-pre-wrap">
            {criativo.publicoAlvo}
          </p>
        </div>
      )}
    </>
  );
}
