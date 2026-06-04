"use client";
/**
 * Tab Calendário do Portal do Cliente.
 *
 * Cards de posts com:
 *  - Título, formato, data, status
 *  - Legenda/briefing colapsável
 *  - Comentários anteriores (cliente + SAL)
 *  - Botões "Aprovar" e "Pedir ajuste" (se permissão)
 *
 * Status visíveis: COPY_PRONTA, DESIGN_PRONTO, AGENDADO, PUBLICADO.
 * Rascunhos não chegam aqui (filtrado no backend).
 */
import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarDays, List, CheckCircle2, MessageSquare, ChevronLeft, ChevronRight, Loader2, FileText, Link2, Video, Hash, Inbox, Trash2, Clock } from "lucide-react";
import { BlockRenderer } from "@/components/editor";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BotaoEnviar,
  EnviarConteudoDialog,
  MinhasSubmissoes,
  type Submissao,
} from "@/components/portal-enviar-conteudo";
import { BotaoAnexarArte, AnexarArteDialog } from "@/components/portal-anexar-arte";

type Comentario = {
  id: string;
  tipo: "APROVOU" | "PEDIU_AJUSTE";
  texto: string | null;
  createdAt: string;
};

type Arquivo = {
  id: string;
  tipo: "IMAGEM" | "VIDEO" | "DOCUMENTO" | "LINK_EXTERNO";
  url: string;
  nome: string | null;
  legenda: string | null;
  ordem: number;
  enviadoPorCliente?: boolean;
};

type Post = {
  id: string;
  titulo: string;
  legenda: string | null;
  pilar: string | null;
  formato: string;
  status: string;
  dataPublicacao: string;
  hashtags: string[];
  cta: string | null;
  arquivos: Arquivo[];
  comentarios: Comentario[];
};

const STATUS_LABEL: Record<string, string> = {
  COPY_PRONTA: "Aguardando aprovação",
  DESIGN_PRONTO: "Em produção (arte)",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
};

/**
 * Tokens visuais por status (soft, legível claro+escuro). `dot` = bg de
 * bolinha; `chip` = chip soft (bg translúcido + texto + borda); `badge` = a
 * Badge outline (texto + borda); `tile` = mini-card de data (bg + texto +
 * borda). Tudo via utilitárias Tailwind com /alpha — sem hex hardcoded que
 * destoe no tema claro.
 */
type StatusUI = { dot: string; chip: string; badge: string; tile: string };
const STATUS_UI: Record<string, StatusUI> = {
  COPY_PRONTA: {
    dot: "bg-amber-500",
    chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/25",
    badge: "text-amber-600 dark:text-amber-400 border-amber-500/40",
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  DESIGN_PRONTO: {
    dot: "bg-violet-500",
    chip: "bg-violet-500/12 text-violet-600 dark:text-violet-400 border border-violet-500/25",
    badge: "text-violet-600 dark:text-violet-400 border-violet-500/40",
    tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  },
  AGENDADO: {
    dot: "bg-sky-500",
    chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400 border border-sky-500/25",
    badge: "text-sky-600 dark:text-sky-400 border-sky-500/40",
    tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  PUBLICADO: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
    badge: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
};
const STATUS_UI_FALLBACK: StatusUI = {
  dot: "bg-muted-foreground/40",
  chip: "bg-muted text-muted-foreground border border-border",
  badge: "text-muted-foreground border-border",
  tile: "bg-muted text-muted-foreground border-border",
};
function statusUI(status: string): StatusUI {
  return STATUS_UI[status] ?? STATUS_UI_FALLBACK;
}

const FORMATO_LABEL: Record<string, string> = {
  FEED: "Post estático",
  CARROSSEL: "Carrossel",
  REELS: "Reels / Vídeo",
  STORIES: "Stories",
};

type CalView = "lista" | "calendario";
const VIEW_STORAGE_KEY = "portal-cal-view";
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// ─── Helpers de data ───────────────────────────────────────────────────
// A grade usa data LOCAL (getDate/getMonth) — consistente com a lista e o
// cabeçalho do PostCard, que já interpretam dataPublicacao em local time.
// (database-calendar usa UTC porque lá a data é date-only; aqui o backend
//  manda ISO com hora, então casamos com o resto do componente.)
/** "YYYY-MM-DD" (local) a partir de uma data ISO/string. */
function isoDia(data: string | Date): string {
  const d = typeof data === "string" ? new Date(data) : data;
  return isoLocal(d.getFullYear(), d.getMonth(), d.getDate());
}
/** "YYYY-MM-DD" do par (ano, mês 0-based, dia). */
function isoLocal(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
/** Label "junho 2026" do mês exibido (local). */
function rotuloMes(ano: number, mes: number): string {
  return new Date(ano, mes, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}
/** "DD/MM" curto a partir de uma data ISO. */
function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function PortalCalendario({
  token,
  podeAprovar,
  podeComentar,
  podeEnviar,
  onPendenciasMudaram,
}: {
  token: string;
  podeAprovar: boolean;
  podeComentar: boolean;
  podeEnviar: boolean;
  /** Avisa o portal pra recarregar a contagem de pendências (badges). */
  onPendenciasMudaram?: () => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [comentando, setComentando] = useState<Post | null>(null);
  const [aprovando, setAprovando] = useState<Post | null>(null);
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [view, setView] = useState<CalView>("lista");

  // Restaura a preferência de view (lista/calendário) do localStorage.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(VIEW_STORAGE_KEY);
      if (salvo === "lista" || salvo === "calendario") setView(salvo);
    } catch {
      /* localStorage indisponível — mantém default */
    }
  }, []);

  function trocarView(v: CalView) {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* ignora */
    }
  }

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/p/cliente/${token}/calendario`);
      const data = await res.json();
      if (Array.isArray(data)) setPosts(data);
    } finally {
      setLoading(false);
    }
  }

  async function carregarSubmissoes() {
    if (!podeEnviar) return;
    try {
      const res = await fetch(`/api/p/cliente/${token}/posts`);
      const data = await res.json();
      if (Array.isArray(data)) setSubmissoes(data);
    } catch {
      /* silencioso — submissões são complementares */
    }
  }

  useEffect(() => {
    void carregar();
    void carregarSubmissoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Abre o dialog de aprovação (confirma + comentário opcional). */
  function aprovar(post: Post) {
    setAprovando(post);
  }

  function aposAprovar() {
    setAprovando(null);
    carregar();
    onPendenciasMudaram?.();
  }

  if (loading) {
    return <CalendarioSkeleton />;
  }

  // Agrupa por mês
  const grupos = new Map<string, Post[]>();
  for (const p of posts) {
    const d = new Date(p.dataPublicacao);
    const chave = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const arr = grupos.get(chave) ?? [];
    arr.push(p);
    grupos.set(chave, arr);
  }

  return (
    <div className="space-y-5">
      {/* Enviar post pra revisão (caminho inverso — só se habilitado) */}
      {podeEnviar && <BotaoEnviar modo="post" onClick={() => setEnviando(true)} />}

      {/* Toggle Lista ↔ Calendário (só faz sentido se há conteúdo) */}
      {posts.length > 0 && (
        <div className="flex items-center justify-end">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => trocarView("lista")}
              aria-pressed={view === "lista"}
              className={`touch-feedback flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                view === "lista"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => trocarView("calendario")}
              aria-pressed={view === "calendario"}
              className={`touch-feedback flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                view === "calendario"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendário
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo produzido pela SAL */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum conteúdo pra mostrar agora.</p>
            <p className="text-[11px] text-muted-foreground/70">
              Quando a SAL produzir conteúdo novo pra aprovação, aparece aqui.
            </p>
          </CardContent>
        </Card>
      ) : view === "calendario" ? (
        <CalendarioGrade
          posts={posts}
          podeAprovar={podeAprovar}
          podeComentar={podeComentar}
          podeEnviar={podeEnviar}
          token={token}
          onAprovar={aprovar}
          onComentar={setComentando}
          onAlterado={carregar}
        />
      ) : (
        Array.from(grupos.entries()).map(([mes, postsMes]) => (
          <section key={mes} className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground capitalize">
              {mes}
            </h2>
            <div className="space-y-2">
              {postsMes.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  podeAprovar={podeAprovar}
                  podeComentar={podeComentar}
                  podeEnviar={podeEnviar}
                  token={token}
                  onAprovar={() => aprovar(p)}
                  onComentar={() => setComentando(p)}
                  onAlterado={carregar}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Submissões do próprio cliente (separadas visualmente da SAL) */}
      {podeEnviar && <MinhasSubmissoes modo="post" submissoes={submissoes} />}

      {aprovando && (
        <AprovarDialog
          token={token}
          post={aprovando}
          podeComentar={podeComentar}
          onClose={() => setAprovando(null)}
          onSuccess={aposAprovar}
        />
      )}

      {comentando && (
        <ComentarDialog
          token={token}
          post={comentando}
          onClose={() => setComentando(null)}
          onSuccess={() => {
            setComentando(null);
            carregar();
            onPendenciasMudaram?.();
          }}
        />
      )}

      {enviando && (
        <EnviarConteudoDialog
          modo="post"
          token={token}
          onClose={() => setEnviando(false)}
          onSuccess={() => {
            setEnviando(false);
            carregarSubmissoes();
          }}
        />
      )}
    </div>
  );
}

/**
 * View grade/mês do portal. Espelha o padrão leve de database-calendar
 * (grade própria, sem libs pesadas — bom pro mobile). Posts viram chips
 * coloridos por status no dia; tocar num dia seleciona e mostra os posts
 * dele como o MESMO PostCard de detalhe/aprovação usado na lista.
 */
function CalendarioGrade({
  posts,
  podeAprovar,
  podeComentar,
  podeEnviar,
  token,
  onAprovar,
  onComentar,
  onAlterado,
}: {
  posts: Post[];
  podeAprovar: boolean;
  podeComentar: boolean;
  podeEnviar: boolean;
  token: string;
  onAprovar: (post: Post) => void;
  onComentar: (post: Post) => void;
  onAlterado: () => void;
}) {
  // Posts por dia ("YYYY-MM-DD").
  const porDia = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of posts) {
      const k = isoDia(p.dataPublicacao);
      const arr = m.get(k);
      if (arr) arr.push(p);
      else m.set(k, [p]);
    }
    return m;
  }, [posts]);

  const hoje = new Date();
  const hojeIso = isoLocal(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  // Mês inicial: o do próximo post a partir de hoje, senão o do 1º post, senão hoje.
  const inicio = useMemo(() => {
    const datas = posts.map((p) => p.dataPublicacao).sort();
    const alvo = datas.find((d) => isoDia(d) >= hojeIso) ?? datas[0];
    if (!alvo) return { ano: hoje.getFullYear(), mes: hoje.getMonth() };
    const d = new Date(alvo);
    return { ano: d.getFullYear(), mes: d.getMonth() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const [cursor, setCursor] = useState<{ ano: number; mes: number }>(inicio);
  const [diaSel, setDiaSel] = useState<string | null>(null);

  function irMes(delta: number) {
    setDiaSel(null);
    setCursor((c) => {
      const d = new Date(c.ano, c.mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }
  function irHoje() {
    setCursor({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
    setDiaSel(porDia.has(hojeIso) ? hojeIso : null);
  }

  // Monta as células da grade (semanas começando no domingo). Datas LOCAIS.
  const primeiroDiaSemana = new Date(cursor.ano, cursor.mes, 1).getDay();
  const diasNoMes = new Date(cursor.ano, cursor.mes + 1, 0).getDate();
  const totalCelulas = Math.ceil((primeiroDiaSemana + diasNoMes) / 7) * 7;
  type Celula = { iso: string; dia: number; doMes: boolean };
  const celulas: Celula[] = [];
  for (let i = 0; i < totalCelulas; i++) {
    const offset = i - primeiroDiaSemana;
    const d = new Date(cursor.ano, cursor.mes, 1 + offset);
    celulas.push({
      iso: isoLocal(d.getFullYear(), d.getMonth(), d.getDate()),
      dia: d.getDate(),
      doMes: d.getMonth() === cursor.mes,
    });
  }

  const postsDoDia = diaSel ? porDia.get(diaSel) ?? [] : [];

  return (
    <div className="space-y-3">
      {/* Navegação de mês + label "junho 2026". */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-display text-base font-semibold capitalize truncate">
            {rotuloMes(cursor.ano, cursor.mes)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => irMes(-1)}
            className="touch-feedback h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={irHoje}
            className="touch-feedback h-8 px-3 flex items-center rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => irMes(1)}
            className="touch-feedback h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grade do mês. */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="px-1 py-1.5 text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celulas.map((cel) => (
            <DiaCelula
              key={cel.iso}
              iso={cel.iso}
              dia={cel.dia}
              doMes={cel.doMes}
              ehHoje={cel.iso === hojeIso}
              selecionado={cel.iso === diaSel}
              posts={porDia.get(cel.iso) ?? []}
              onSelecionar={() => setDiaSel((atual) => (atual === cel.iso ? null : cel.iso))}
            />
          ))}
        </div>
      </div>

      {/* Legenda de status (pontos coloridos). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
        {Object.entries(STATUS_LABEL).map(([st, label]) => (
          <span key={st} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${statusUI(st).dot}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Agenda do dia selecionado — reusa o PostCard de detalhe/aprovação. */}
      {diaSel && (
        <section className="space-y-2 pt-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {new Date(diaSel + "T00:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
            {postsDoDia.length > 0 ? ` · ${postsDoDia.length}` : ""}
          </h2>
          {postsDoDia.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-[12px] text-muted-foreground">
                Nenhum conteúdo neste dia.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {postsDoDia.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  podeAprovar={podeAprovar}
                  podeComentar={podeComentar}
                  podeEnviar={podeEnviar}
                  token={token}
                  onAprovar={() => onAprovar(p)}
                  onComentar={() => onComentar(p)}
                  onAlterado={onAlterado}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Uma célula (dia) da grade ─────────────────────────────────────────
function DiaCelula({
  iso,
  dia,
  doMes,
  ehHoje,
  selecionado,
  posts,
  onSelecionar,
}: {
  iso: string;
  dia: number;
  doMes: boolean;
  ehHoje: boolean;
  selecionado: boolean;
  posts: Post[];
  onSelecionar: () => void;
}) {
  const temPosts = posts.length > 0;
  return (
    <button
      type="button"
      onClick={onSelecionar}
      aria-label={`${dia} — ${temPosts ? `${posts.length} conteúdo(s)` : "sem conteúdo"}`}
      aria-pressed={selecionado}
      className={`touch-feedback group/dia relative min-h-[64px] sm:min-h-[88px] border-b border-r border-border p-1 text-left transition-colors [&:nth-child(7n)]:border-r-0 ${
        doMes ? "bg-background" : "bg-muted/20"
      } ${selecionado ? "ring-2 ring-inset ring-primary/60 bg-primary/5" : "hover:bg-muted/40"}`}
    >
      {/* Número do dia. */}
      <div className="flex items-center justify-center sm:justify-start px-0.5 pt-0.5">
        <span
          className={`text-[12px] tabular-nums ${
            ehHoje
              ? "h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
              : doMes
                ? "text-foreground/80"
                : "text-muted-foreground/40"
          }`}
        >
          {dia}
        </span>
      </div>

      {/* Mobile (< sm): pontos coloridos por status. */}
      {temPosts && (
        <div className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
          {posts.slice(0, 4).map((p) => (
            <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${statusUI(p.status).dot}`} />
          ))}
          {posts.length > 4 && (
            <span className="text-[8px] leading-none text-muted-foreground">+{posts.length - 4}</span>
          )}
        </div>
      )}

      {/* Desktop (>= sm): chips com título, cor por status. */}
      {temPosts && (
        <div className="mt-1 hidden sm:block space-y-1">
          {posts.slice(0, 3).map((p) => (
            <span
              key={p.id}
              className={`block w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${statusUI(p.status).chip}`}
              title={p.titulo}
            >
              {p.titulo}
            </span>
          ))}
          {posts.length > 3 && (
            <span className="block px-1.5 text-[10px] text-muted-foreground">
              +{posts.length - 3} mais
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/** Skeleton de carregamento (em vez de só um spinner). */
function CalendarioSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PostCard({
  post,
  podeAprovar,
  podeComentar,
  podeEnviar,
  token,
  onAprovar,
  onComentar,
  onAlterado,
}: {
  post: Post;
  podeAprovar: boolean;
  podeComentar: boolean;
  podeEnviar: boolean;
  token: string;
  onAprovar: () => void;
  onComentar: () => void;
  onAlterado: () => void;
}) {
  const [anexando, setAnexando] = useState(false);
  const data = new Date(post.dataPublicacao);
  const ui = statusUI(post.status);
  const aprovavel = post.status === "COPY_PRONTA" && podeAprovar;
  // `comentarios` vem ordenado desc (mais recente primeiro).
  const aprovacao = post.comentarios.find((c) => c.tipo === "APROVOU");
  const ultimoAjuste = post.comentarios.find((c) => c.tipo === "PEDIU_AJUSTE");
  // Estado de aprovação do cliente (claro): aprovado, ajuste pedido, ou
  // aguardando. "Aguardando" só faz sentido enquanto está em COPY_PRONTA.
  const aguardando = post.status === "COPY_PRONTA" && !aprovacao;
  const temArtes = post.arquivos.length > 0;

  async function removerArte(arquivoId: string) {
    if (!confirm("Remover esta arte que você anexou?")) return;
    const res = await fetch(`/api/p/cliente/${token}/posts/${post.id}/arquivos/${arquivoId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? "Falha ao remover");
      return;
    }
    toast.success("Arte removida");
    onAlterado();
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 flex items-start gap-3">
          <div className={`shrink-0 w-12 h-12 rounded-lg border flex flex-col items-center justify-center ${ui.tile}`}>
            <span className="text-[9px] uppercase font-semibold">
              {data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
            </span>
            <span className="text-lg font-mono font-semibold leading-none">
              {data.getDate()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-sm leading-tight">{post.titulo}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${ui.badge}`}>
                {STATUS_LABEL[post.status] ?? post.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {FORMATO_LABEL[post.formato] ?? post.formato}
              </Badge>
              {post.pilar && (
                <span className="text-[10px] text-muted-foreground">· {post.pilar}</span>
              )}
            </div>
          </div>
        </div>

        {/* Carrossel de artes (se tiver) */}
        {temArtes && (
          <ArtesCarrossel
            arquivos={post.arquivos}
            onRemover={podeEnviar ? removerArte : undefined}
          />
        )}

        <div className="px-4 pb-4 space-y-3">
          {post.legenda && (
            <div className="rounded-md bg-muted/30 border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Copy / Legenda
              </div>
              <BlockRenderer value={post.legenda} className="text-[12.5px] leading-relaxed" />
            </div>
          )}

          {/* Hashtags */}
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

          {/* CTA */}
          {post.cta && (
            <div className="rounded-md border-l-4 border-l-primary bg-primary/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                Chamada pra ação
              </div>
              <div className="text-[12.5px] font-medium leading-snug">{post.cta}</div>
            </div>
          )}

          {/* Estado de aprovação do cliente — claro e datado */}
          {(aprovacao || ultimoAjuste || aguardando) && (
            <div className="space-y-1.5 border-t border-border/40 pt-3">
              {aprovacao && (
                <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Aprovado por você em {dataCurta(aprovacao.createdAt)}
                  </div>
                  {aprovacao.texto && (
                    <p className="mt-1 text-[12px] leading-snug whitespace-pre-wrap text-foreground/90">
                      {aprovacao.texto}
                    </p>
                  )}
                </div>
              )}
              {!aprovacao && aguardando && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5 shrink-0" /> Aguardando sua aprovação
                </div>
              )}
              {ultimoAjuste && (
                <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-2">
                  <div className="flex items-center gap-1.5 text-[10.5px] text-amber-600 dark:text-amber-400 font-medium mb-1">
                    <MessageSquare className="h-3 w-3" /> Ajuste solicitado
                    <span className="text-muted-foreground/70 ml-auto">
                      {dataCurta(ultimoAjuste.createdAt)}
                    </span>
                  </div>
                  <p className="text-[12px] leading-snug whitespace-pre-wrap">{ultimoAjuste.texto}</p>
                </div>
              )}
            </div>
          )}

          {/* Ações — touch targets 44px em mobile, 36px em desktop */}
          {(aprovavel || podeComentar || podeEnviar) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {aprovavel && (
                <Button
                  onClick={onAprovar}
                  className="flex-1 h-11 sm:h-9 text-sm sm:text-xs touch-feedback bg-emerald-600 text-white hover:bg-emerald-600/90"
                >
                  <CheckCircle2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Aprovar
                </Button>
              )}
              {podeComentar && (
                <Button variant="outline" onClick={onComentar} className="flex-1 h-11 sm:h-9 text-sm sm:text-xs touch-feedback">
                  <MessageSquare className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Pedir ajuste
                </Button>
              )}
              {podeEnviar && <BotaoAnexarArte onClick={() => setAnexando(true)} />}
            </div>
          )}
        </div>
      </CardContent>

      {anexando && (
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
    </Card>
  );
}

/**
 * Carrossel de arquivos do post. Swipe touch em mobile, setas em
 * desktop. IMAGEM e VIDEO renderizam inline; DOCUMENTO/LINK_EXTERNO
 * viram link estilizado.
 */
function ArtesCarrossel({
  arquivos,
  onRemover,
}: {
  arquivos: Arquivo[];
  /** Se definido, mostra selo + botão remover nas artes que o cliente anexou. */
  onRemover?: (arquivoId: string) => void;
}) {
  const [atual, setAtual] = useState(0);
  const total = arquivos.length;
  // `atual` pode ficar fora do range se uma arte for removida — clampa.
  const idx = Math.min(atual, total - 1);
  const arquivoAtual = arquivos[idx];
  const doCliente = !!arquivoAtual?.enviadoPorCliente;

  function anterior() {
    setAtual((a) => (a - 1 + total) % total);
  }
  function proximo() {
    setAtual((a) => (a + 1) % total);
  }

  // Swipe touch
  const [touchStart, setTouchStart] = useState<number | null>(null);
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
    <div className="bg-muted/20 border-y border-border" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="relative aspect-square sm:aspect-[4/5] max-h-[600px] flex items-center justify-center bg-muted select-none">
        {arquivoAtual.tipo === "IMAGEM" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={arquivoAtual.url}
            alt={arquivoAtual.nome ?? ""}
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

        {/* Setas — visíveis em desktop sempre; em mobile só se >1 arte (touch target 40px) */}
        {total > 1 && (
          <>
            <button
              onClick={anterior}
              className="touch-feedback absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
            <button
              onClick={proximo}
              className="touch-feedback absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition"
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          </>
        )}

        {/* Indicadores (dots) — maiores em mobile pra clicar fácil */}
        {total > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm">
            {arquivos.map((_, i) => (
              <button
                key={i}
                onClick={() => setAtual(i)}
                className={`h-2 sm:h-1.5 rounded-full transition-all ${
                  i === idx ? "w-7 bg-white" : "w-2 sm:w-1.5 bg-white/50"
                }`}
                aria-label={`Ir pra slide ${i + 1}`}
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
                onClick={() => onRemover(arquivoAtual.id)}
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

      {/* Legenda do slide atual */}
      {arquivoAtual.legenda && (
        <div className="px-4 py-2 text-[11.5px] text-muted-foreground bg-muted/40">
          <span className="font-medium text-foreground">
            {arquivoAtual.nome ?? `Slide ${idx + 1}`}:
          </span>{" "}
          {arquivoAtual.legenda}
        </div>
      )}

      {/* Contador */}
      {total > 1 && (
        <div className="px-4 py-1.5 text-[10.5px] text-muted-foreground/70 text-center">
          {idx + 1} de {total} {total === 1 ? "arte" : "artes"} · arraste pra navegar
        </div>
      )}
    </div>
  );
}


function ComentarDialog({
  token,
  post,
  onClose,
  onSuccess,
}: {
  token: string;
  post: Post;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (texto.trim().length < 3) {
      toast.error("Mensagem muito curta");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/p/cliente/${token}/post/${post.id}/comentar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao enviar");
        return;
      }
      toast.success("Pedido enviado! SAL foi notificada.");
      onSuccess();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dialog-bottom-sheet">
        {/* Handle visual de bottom sheet em mobile */}
        <div className="sm:hidden flex justify-center -mt-1 mb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-base">Pedir ajuste</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 truncate">{post.titulo}</p>
        </DialogHeader>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva o ajuste que você gostaria — quanto mais específico, mais rápido a SAL resolve."
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

/**
 * Dialog de aprovação de post. Confirma a aprovação e, se o cliente pode
 * comentar, permite um comentário OPCIONAL que acompanha a aprovação
 * ("pode subir", "ficou ótimo"). Posta em /aprovar com { texto? }.
 */
function AprovarDialog({
  token,
  post,
  podeComentar,
  onClose,
  onSuccess,
}: {
  token: string;
  post: Post;
  podeComentar: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function aprovar() {
    setEnviando(true);
    try {
      const comentario = texto.trim();
      const res = await fetch(`/api/p/cliente/${token}/post/${post.id}/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comentario ? { texto: comentario } : {}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao aprovar");
        return;
      }
      toast.success("Aprovado! SAL foi notificada.");
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
          <DialogTitle className="text-base">Aprovar post</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 truncate">{post.titulo}</p>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          A SAL será notificada e pode prosseguir pra produção da arte.
        </p>
        {podeComentar && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Comentário (opcional)
            </label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Quer deixar um recado? Ex: 'Ficou ótimo, pode publicar.'"
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
