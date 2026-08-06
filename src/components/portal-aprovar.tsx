"use client";
/**
 * Hub 2.0 F5 — aba "Aprovar" do portal (a ação nº 1 do cliente).
 *
 * Fila de aprovação em primeira classe: o cliente abre o portal e vê
 * na hora o que espera o OK dele — sem procurar dentro de "Conteúdo".
 *
 * Zero fetch próprio: reusa `pendencias` que o shell já carrega do
 * /resumo (contagens + até 6 itens leves). A ação de aprovar acontece
 * no Modo Revisão (stories fullscreen), que já existe — aqui é a porta
 * de entrada clara pra ele.
 */
import { ClipboardCheck, ChevronRight, PartyPopper, Megaphone, Image as ImageIcon } from "lucide-react";
import type { PendenciaItem } from "@/components/portal-cliente";

export function PortalAprovar({
  corMarca,
  pendencias,
  onRevisar,
}: {
  corMarca: string;
  pendencias: { posts: number; criativos: number; itens: PendenciaItem[] };
  onRevisar: () => void;
}) {
  const total = pendencias.posts + pendencias.criativos;

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3 p5-card">
        <div
          className="mx-auto h-14 w-14 rounded-full flex items-center justify-center"
          style={{ background: `${corMarca}18` }}
        >
          <PartyPopper className="h-7 w-7" style={{ color: corMarca }} />
        </div>
        <h2 className="font-display text-lg font-bold">Tudo em dia!</h2>
        <p className="text-[13px] text-muted-foreground max-w-[36ch] mx-auto">
          Nenhum item esperando sua aprovação agora. Quando a SAL preparar algo novo, ele aparece
          aqui — e você aprova com um toque.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Herói: número + CTA único */}
      <div className="rounded-2xl border border-border bg-card p-6 p5-card">
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-display text-2xl font-bold shrink-0 p5-float"
            style={{ background: corMarca }}
          >
            {total > 9 ? "9+" : total}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[16px] font-bold leading-tight">
              {total === 1 ? "1 item espera seu OK" : `${total} itens esperam seu OK`}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {pendencias.posts > 0 && `${pendencias.posts} de conteúdo`}
              {pendencias.posts > 0 && pendencias.criativos > 0 && " · "}
              {pendencias.criativos > 0 && `${pendencias.criativos} de anúncio`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRevisar}
          className="touch-feedback mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[13.5px] font-bold text-white p5-float hover:opacity-90"
          style={{ background: corMarca }}
        >
          <ClipboardCheck className="h-4 w-4" />
          Revisar agora — um por vez
        </button>
        <p className="text-[10.5px] text-muted-foreground text-center mt-2">
          Você vê cada item em tela cheia e aprova ou pede ajuste com um toque.
        </p>
      </div>

      {/* Lista dos itens (leve — nomes e datas) */}
      {pendencias.itens.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden p5-card">
          <ul className="divide-y divide-border/60">
            {pendencias.itens.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  onClick={onRevisar}
                  className="touch-feedback w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
                >
                  <span
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${corMarca}14` }}
                  >
                    {item.kind === "post" ? (
                      <ImageIcon className="h-4 w-4" style={{ color: corMarca }} />
                    ) : (
                      <Megaphone className="h-4 w-4" style={{ color: corMarca }} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold truncate">{item.titulo}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.kind === "post" ? "Conteúdo" : "Anúncio"}
                      {item.quando && ` · ${item.quando}`}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
