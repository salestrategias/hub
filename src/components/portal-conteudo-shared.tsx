"use client";
/**
 * Portal v4 — peças compartilhadas da aba Conteúdo e do Modo Revisão.
 *
 * Antes, posts (portal-calendario) e criativos (portal-criativos) duplicavam
 * carrossel, dialogs de aprovar/comentar e mapas de status. Este módulo
 * unifica tudo em cima de um tipo `ItemConteudo` (post | criativo):
 *
 *  - tipos + labels + tokens visuais de status
 *  - `estadoAprovacao()` — a máquina de estados que o cliente entende:
 *    "Aguardando você" → "Com a SAL" → "Aprovado" (+ acompanhamento)
 *  - <ArtesCarrossel>       — swipe + setas + dots (com remover opcional)
 *  - <ThreadComentarios>    — conversa completa (não só o 1º de cada tipo)
 *  - <AprovarDialog> / <PedirAjusteDialog> — genéricos pros dois tipos
 *  - <RemoverArteDialog>    — substitui o window.confirm nativo
 *
 * Sem <style jsx>; só tokens Tailwind (regra permanente do Hub).
 */
import { useState } from "react";
import {
  CheckCircle2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Link2,
  Inbox,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchPortal } from "@/lib/portal-fetch";

// ─── Tipos ─────────────────────────────────────────────────────────────
export type Comentario = {
  id: string;
  tipo: "APROVOU" | "PEDIU_AJUSTE";
  texto: string | null;
  createdAt: string;
};

export type Arquivo = {
  id: string;
  tipo: "IMAGEM" | "VIDEO" | "DOCUMENTO" | "LINK_EXTERNO";
  url: string;
  nome: string | null;
  legenda: string | null;
  ordem: number;
  enviadoPorCliente?: boolean;
};

export type PostPortal = {
  kind: "post";
  id: string;
  titulo: string;
  legenda: string | null;
  pilar: string | null;
  formato: string;
  status: string;
  dataPublicacao: string;
  updatedAt: string;
  hashtags: string[];
  cta: string | null;
  arquivos: Arquivo[];
  comentarios: Comentario[];
};

export type CriativoPortal = {
  kind: "criativo";
  id: string;
  titulo: string;
  status: string;
  updatedAt: string;
  plataforma: string;
  formato: string;
  textoPrincipal: string | null;
  headline: string | null;
  descricao: string | null;
  ctaBotao: string | null;
  urlDestino: string | null;
  publicoAlvo: string | null;
  inicio: string | null;
  fim: string | null;
  arquivos: Arquivo[];
  comentarios: Comentario[];
};

export type ItemConteudo = PostPortal | CriativoPortal;

// ─── Labels ────────────────────────────────────────────────────────────
export const STATUS_LABEL_POST: Record<string, string> = {
  COPY_PRONTA: "Aguardando aprovação",
  DESIGN_PRONTO: "Em produção (arte)",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
};

export const STATUS_LABEL_CRIATIVO: Record<string, string> = {
  EM_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  NO_AR: "No ar",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
};

export const FORMATO_LABEL_POST: Record<string, string> = {
  FEED: "Post estático",
  CARROSSEL: "Carrossel",
  REELS: "Reels / Vídeo",
  STORIES: "Stories",
};

export const PLATAFORMA_LABEL: Record<string, string> = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  TIKTOK_ADS: "TikTok Ads",
  YOUTUBE_ADS: "YouTube Ads",
  LINKEDIN_ADS: "LinkedIn Ads",
};

export const FORMATO_LABEL_CRIATIVO: Record<string, string> = {
  POST_IMAGEM: "Post imagem",
  POST_VIDEO: "Post vídeo",
  CARROSSEL: "Carrossel",
  COLLECTION: "Collection",
  STORY: "Story",
  REELS_AD: "Reels Ad",
  RESPONSIVE_DISPLAY: "Display responsivo",
  SEARCH_AD: "Search Ad",
  PERFORMANCE_MAX: "Performance Max",
};

export function statusLabel(item: ItemConteudo): string {
  return item.kind === "post"
    ? STATUS_LABEL_POST[item.status] ?? item.status
    : STATUS_LABEL_CRIATIVO[item.status] ?? item.status;
}

// ─── Tokens visuais por status (soft, legível claro+escuro) ────────────
export type StatusUI = { dot: string; chip: string; badge: string; tile: string };
const UI_AMBAR: StatusUI = {
  dot: "bg-amber-500",
  chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/25",
  badge: "text-amber-600 dark:text-amber-400 border-amber-500/40",
  tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
};
const UI_VIOLETA: StatusUI = {
  dot: "bg-violet-500",
  chip: "bg-violet-500/12 text-violet-600 dark:text-violet-400 border border-violet-500/25",
  badge: "text-violet-600 dark:text-violet-400 border-violet-500/40",
  tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
};
const UI_CEU: StatusUI = {
  dot: "bg-sky-500",
  chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400 border border-sky-500/25",
  badge: "text-sky-600 dark:text-sky-400 border-sky-500/40",
  tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
};
const UI_VERDE: StatusUI = {
  dot: "bg-emerald-500",
  chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
  badge: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
  tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};
const UI_ROSA: StatusUI = {
  dot: "bg-rose-500",
  chip: "bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/25",
  badge: "text-rose-600 dark:text-rose-400 border-rose-500/40",
  tile: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
};
const UI_NEUTRO: StatusUI = {
  dot: "bg-muted-foreground/40",
  chip: "bg-muted text-muted-foreground border border-border",
  badge: "text-muted-foreground border-border",
  tile: "bg-muted text-muted-foreground border-border",
};

const STATUS_UI: Record<string, StatusUI> = {
  // posts
  COPY_PRONTA: UI_AMBAR,
  DESIGN_PRONTO: UI_VIOLETA,
  AGENDADO: UI_CEU,
  PUBLICADO: UI_VERDE,
  // criativos
  EM_APROVACAO: UI_AMBAR,
  APROVADO: UI_VERDE,
  RECUSADO: UI_ROSA,
  NO_AR: UI_VERDE,
  PAUSADO: UI_CEU,
  ENCERRADO: UI_NEUTRO,
};

export function statusUI(status: string): StatusUI {
  return STATUS_UI[status] ?? UI_NEUTRO;
}

// ─── Estado de aprovação (a máquina que o cliente entende) ─────────────
export type EstadoAprovacao =
  | "aguardando_voce" // pendente e a bola está com o cliente
  | "com_a_sal" // cliente pediu ajuste e a SAL ainda não mexeu
  | "aprovado" // cliente aprovou
  | "acompanhando"; // demais status (agendado, publicado, no ar...)

const STATUS_PENDENTE = new Set(["COPY_PRONTA", "EM_APROVACAO"]);

/**
 * Deriva o estado a partir de status + comentários + updatedAt.
 * Heurística do "Com a SAL": se o último evento do cliente foi um pedido
 * de ajuste e o item NÃO foi editado depois disso, a bola está com a
 * agência (esconde os botões de aprovar). Qualquer edição da SAL depois
 * do pedido devolve o item pra "Aguardando você".
 */
export function estadoAprovacao(item: ItemConteudo): EstadoAprovacao {
  if (STATUS_PENDENTE.has(item.status)) {
    const ultimo = item.comentarios[0]; // vem ordenado desc do backend
    if (
      ultimo?.tipo === "PEDIU_AJUSTE" &&
      new Date(item.updatedAt).getTime() <= new Date(ultimo.createdAt).getTime()
    ) {
      return "com_a_sal";
    }
    return "aguardando_voce";
  }
  const aprovou = item.comentarios.find((c) => c.tipo === "APROVOU");
  if (aprovou) return "aprovado";
  return "acompanhando";
}

/** Itens em que o cliente PODE agir agora (alimenta fila do Modo Revisão). */
export function aguardandoCliente(item: ItemConteudo): boolean {
  return estadoAprovacao(item) === "aguardando_voce";
}

/** "DD/MM" curto a partir de uma data ISO. */
export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ─── Carrossel de artes (um só pros dois tipos) ────────────────────────
export function ArtesCarrossel({
  arquivos,
  onRemover,
  compacto = false,
}: {
  arquivos: Arquivo[];
  /** Se definido, mostra selo + remover nas artes que o cliente anexou. */
  onRemover?: (arquivo: Arquivo) => void;
  /** No Modo Revisão a moldura é mais alta/limpa. */
  compacto?: boolean;
}) {
  const [atual, setAtual] = useState(0);
  // Swipe touch — hook declarado antes de qualquer return (regra de hooks).
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const total = arquivos.length;
  // `atual` pode ficar fora do range se uma arte for removida — clampa.
  const idx = Math.min(atual, total - 1);
  const arquivoAtual = arquivos[idx];
  const doCliente = !!arquivoAtual?.enviadoPorCliente;

  if (!arquivoAtual) return null;

  function anterior() {
    setAtual((a) => (a - 1 + total) % total);
  }
  function proximo() {
    setAtual((a) => (a + 1) % total);
  }

  function onTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const delta = e.changedTouches[0].clientX - touchStart;
    if (delta > 50) anterior();
    else if (delta < -50) proximo();
    setTouchStart(null);
  }

  return (
    <div
      className={compacto ? "" : "bg-muted/20 border-y border-border"}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={`relative flex items-center justify-center bg-muted select-none ${
          compacto ? "aspect-[4/5] max-h-[52dvh] rounded-xl overflow-hidden" : "aspect-square sm:aspect-[4/5] max-h-[600px]"
        }`}
      >
        {arquivoAtual.tipo === "IMAGEM" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={arquivoAtual.url}
            alt={arquivoAtual.nome ?? "Arte do conteúdo"}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="max-h-full max-w-full object-contain"
          />
        ) : arquivoAtual.tipo === "VIDEO" ? (
          <video
            src={arquivoAtual.url}
            controls
            preload="metadata"
            playsInline
            className="max-h-full max-w-full"
          />
        ) : (
          <a
            href={arquivoAtual.url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 p-6 hover:text-primary active:scale-95 transition"
          >
            {arquivoAtual.tipo === "DOCUMENTO" ? (
              <FileText className="h-12 w-12" />
            ) : (
              <Link2 className="h-12 w-12" />
            )}
            <span className="text-xs underline break-all max-w-[280px] text-center">
              {arquivoAtual.nome ?? arquivoAtual.url}
            </span>
          </a>
        )}

        {total > 1 && (
          <>
            <button
              onClick={anterior}
              className="touch-feedback absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition"
              aria-label="Arte anterior"
            >
              <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
            <button
              onClick={proximo}
              className="touch-feedback absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition"
              aria-label="Próxima arte"
            >
              <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          </>
        )}

        {total > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm">
            {arquivos.map((_, i) => (
              <button
                key={i}
                onClick={() => setAtual(i)}
                className={`h-2 sm:h-1.5 rounded-full transition-all ${
                  i === idx ? "w-7 bg-white" : "w-2 sm:w-1.5 bg-white/50"
                }`}
                aria-label={`Ir pra arte ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Selo "sua arte" + remover — só nas artes que o cliente anexou */}
        {doCliente && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <Inbox className="h-3 w-3" /> Sua arte
            </span>
            {onRemover && (
              <button
                type="button"
                onClick={() => onRemover(arquivoAtual)}
                className="touch-feedback inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-rose-600/80"
                aria-label="Remover sua arte"
                title="Remover sua arte"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {arquivoAtual.legenda && (
        <div className="px-4 py-2 text-[11.5px] text-muted-foreground bg-muted/40">
          <span className="font-medium text-foreground">
            {arquivoAtual.nome ?? `Arte ${idx + 1}`}:
          </span>{" "}
          {arquivoAtual.legenda}
        </div>
      )}

      {total > 1 && !compacto && (
        <div className="px-4 py-1.5 text-[10.5px] text-muted-foreground/70 text-center">
          {idx + 1} de {total} artes · arraste pra navegar
        </div>
      )}
    </div>
  );
}

// ─── Thread de comentários (conversa completa) ─────────────────────────
export function ThreadComentarios({ comentarios }: { comentarios: Comentario[] }) {
  if (comentarios.length === 0) return null;
  // Backend manda desc; conversa lê melhor em ordem cronológica.
  const ordenados = [...comentarios].reverse();
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Conversa ({ordenados.length})
      </div>
      <ol className="space-y-1.5">
        {ordenados.map((c) => {
          const aprovou = c.tipo === "APROVOU";
          return (
            <li
              key={c.id}
              className={`rounded-lg border p-2.5 ${
                aprovou
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-amber-500/5 border-amber-500/20"
              }`}
            >
              <div
                className={`flex items-center gap-1.5 text-[10.5px] font-medium ${
                  aprovou
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {aprovou ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                ) : (
                  <MessageSquare className="h-3 w-3 shrink-0" />
                )}
                {aprovou ? "Você aprovou" : "Você pediu ajuste"}
                <span className="ml-auto font-normal text-muted-foreground/70">
                  {dataCurta(c.createdAt)}
                </span>
              </div>
              {c.texto && (
                <p className="mt-1 text-[12px] leading-snug whitespace-pre-wrap text-foreground/90">
                  {c.texto}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Endpoints por tipo ────────────────────────────────────────────────
function urlAcao(token: string, item: ItemConteudo, acao: "aprovar" | "comentar"): string {
  const base = item.kind === "post" ? "post" : "criativo";
  return `/api/p/cliente/${token}/${base}/${item.id}/${acao}`;
}

/** Aprova direto (sem dialog) — usado no Modo Revisão. */
export async function aprovarItem(
  token: string,
  item: ItemConteudo,
  texto?: string
): Promise<boolean> {
  const res = await fetchPortal(urlAcao(token, item, "aprovar"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(texto?.trim() ? { texto: texto.trim() } : {}),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    toast.error(d?.error ?? "Falha ao aprovar");
    return false;
  }
  return true;
}

/** Envia pedido de ajuste — usado nos dialogs e no Modo Revisão. */
export async function pedirAjusteItem(
  token: string,
  item: ItemConteudo,
  texto: string
): Promise<boolean> {
  const res = await fetchPortal(urlAcao(token, item, "comentar"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    toast.error(d?.error ?? "Falha ao enviar");
    return false;
  }
  return true;
}

// ─── Dialogs genéricos (post OU criativo) ──────────────────────────────
export function AprovarDialog({
  token,
  item,
  podeComentar,
  onClose,
  onSuccess,
}: {
  token: string;
  item: ItemConteudo;
  podeComentar: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function aprovar() {
    setEnviando(true);
    try {
      const ok = await aprovarItem(token, item, podeComentar ? texto : undefined);
      if (!ok) return;
      toast.success("Aprovado! A SAL foi avisada.");
      onSuccess();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dialog-bottom-sheet">
        <div className="sm:hidden flex justify-center -mt-1 mb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-base">
            {item.kind === "post" ? "Aprovar conteúdo" : "Aprovar anúncio"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 truncate">{item.titulo}</p>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {item.kind === "post"
            ? "A SAL é avisada na hora e segue pra produção da arte."
            : `A SAL é avisada e o anúncio segue pra publicação no ${
                PLATAFORMA_LABEL[(item as CriativoPortal).plataforma] ?? "canal combinado"
              }.`}
        </p>
        {podeComentar && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Recado (opcional)
            </label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex: 'Ficou ótimo, pode publicar.'"
              rows={3}
              className="text-base sm:text-sm min-h-[80px]"
            />
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 sm:h-9 touch-feedback">
            Cancelar
          </Button>
          <Button
            onClick={aprovar}
            disabled={enviando}
            className="h-11 sm:h-9 touch-feedback bg-emerald-600 text-white hover:bg-emerald-600/90"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PedirAjusteDialog({
  token,
  item,
  onClose,
  onSuccess,
}: {
  token: string;
  item: ItemConteudo;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (texto.trim().length < 3) {
      toast.error("Escreva um pouco mais pra SAL entender o ajuste");
      return;
    }
    setEnviando(true);
    try {
      const ok = await pedirAjusteItem(token, item, texto);
      if (!ok) return;
      toast.success("Pedido enviado! A SAL foi avisada.");
      onSuccess();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dialog-bottom-sheet">
        <div className="sm:hidden flex justify-center -mt-1 mb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-base">Pedir ajuste</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 truncate">{item.titulo}</p>
        </DialogHeader>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva o ajuste — quanto mais específico, mais rápido a SAL resolve."
          rows={5}
          autoFocus
          className="text-base sm:text-sm min-h-[120px]"
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 sm:h-9 touch-feedback">
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={enviando || texto.trim().length < 3}
            className="h-11 sm:h-9 touch-feedback"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Enviar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação de remoção de arte — no lugar do window.confirm nativo. */
export function RemoverArteDialog({
  nomeArte,
  onConfirmar,
  onClose,
  removendo,
}: {
  nomeArte: string | null;
  onConfirmar: () => void;
  onClose: () => void;
  removendo: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dialog-bottom-sheet">
        <div className="sm:hidden flex justify-center -mt-1 mb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-base">Remover sua arte?</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {nomeArte ? `"${nomeArte}" ` : "Esta arte "}sai do conteúdo. Dá pra anexar de novo depois.
          </p>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 sm:h-9 touch-feedback">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmar}
            disabled={removendo}
            className="h-11 sm:h-9 touch-feedback"
          >
            {removendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
