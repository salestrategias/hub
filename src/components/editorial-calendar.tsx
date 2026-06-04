"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths, subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { postSchema, type PostInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import {
  ChevronLeft, ChevronRight, Inbox, Plus,
  Instagram, Facebook, Linkedin, Youtube, ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RevisaoEstado } from "@/components/revisao-conteudo";
import { RichTextField } from "@/components/editor";
import { PostSheet } from "@/components/sheets/post-sheet";
import { useEntitySheet } from "@/components/entity-sheet";
import type { EditorBlock as PartialBlock } from "@/components/editor/types";
import { cn } from "@/lib/utils";

type Post = {
  id: string;
  titulo: string;
  legenda: string | null;
  pilar: string | null;
  formato: "FEED" | "STORIES" | "REELS" | "CARROSSEL";
  status: "RASCUNHO" | "COPY_PRONTA" | "DESIGN_PRONTO" | "AGENDADO" | "PUBLICADO";
  dataPublicacao: string;
  clienteId: string;
  clienteNome: string;
  googleEventId: string | null;
  origem: "SAL" | "CLIENTE";
  revisao: RevisaoEstado;
  /** Canais/redes onde o post sai (multi-canal estilo mLabs/Etus). */
  canais: string[];
  /** 1ª arte (imagem) do post, se houver — usada como mini-thumb no card. */
  thumbUrl?: string | null;
};

/* ──────────────────────────────────────────────────────────────────────────
 * Canais (multi-canal) — catálogo canal→ícone+cor+label.
 * Instagram/Facebook/LinkedIn/YouTube usam ícones do lucide. TikTok NÃO
 * existe no lucide → SVG inline (logo simplificada, currentColor).
 * ────────────────────────────────────────────────────────────────────────── */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M16.5 3c.36 2.2 1.76 3.86 3.9 4.06v2.5c-1.34.08-2.55-.26-3.86-1.02v5.9c0 3.6-2.65 5.86-5.7 5.56-2.6-.26-4.5-2.42-4.34-5.06.16-2.62 2.4-4.6 5.06-4.34.2.02.4.06.6.12v2.66a3 3 0 0 0-.78-.16c-1.18-.1-2.16.78-2.2 1.94a2.02 2.02 0 0 0 2 2.1c1.12.04 2.06-.86 2.06-1.98V3h3.26Z" />
    </svg>
  );
}

type CanalDef = { value: string; label: string; cor: string; Icon: (p: { className?: string }) => JSX.Element };

const CANAIS: CanalDef[] = [
  { value: "INSTAGRAM", label: "Instagram", cor: "#E1306C", Icon: ({ className }) => <Instagram className={className} /> },
  { value: "FACEBOOK", label: "Facebook", cor: "#1877F2", Icon: ({ className }) => <Facebook className={className} /> },
  { value: "LINKEDIN", label: "LinkedIn", cor: "#0A66C2", Icon: ({ className }) => <Linkedin className={className} /> },
  { value: "TIKTOK", label: "TikTok", cor: "#111827", Icon: ({ className }) => <TikTokIcon className={className} /> },
  { value: "YOUTUBE", label: "YouTube", cor: "#FF0000", Icon: ({ className }) => <Youtube className={className} /> },
];
const CANAL_MAP: Record<string, CanalDef> = Object.fromEntries(CANAIS.map((c) => [c.value, c]));

/** Fileira de ícones de canal (pequenos) — usada nos cards. */
function CanalIcons({ canais, size = "h-3 w-3" }: { canais: string[]; size?: string }) {
  if (!canais?.length) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {canais.map((c) => {
        const def = CANAL_MAP[c];
        if (!def) return null;
        return (
          <span key={c} title={def.label} style={{ color: def.cor }} className="inline-flex">
            <def.Icon className={size} />
          </span>
        );
      })}
    </span>
  );
}

/** Seletor de canais (chips toggleáveis) — usado no criar e no editar. */
function CanaisSelector({
  value, onChange,
}: { value: string[]; onChange: (next: string[]) => void }) {
  function toggle(canal: string) {
    onChange(value.includes(canal) ? value.filter((c) => c !== canal) : [...value, canal]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {CANAIS.map((c) => {
        const on = value.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => toggle(c.value)}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              on
                ? "border-transparent text-white"
                : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            style={on ? { backgroundColor: c.cor } : undefined}
          >
            <c.Icon className="h-3.5 w-3.5" />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

const STATUS_COR: Record<Post["status"], string> = {
  RASCUNHO: "#64748B",
  COPY_PRONTA: "#3B82F6",
  DESIGN_PRONTO: "#8B5CF6",
  AGENDADO: "#F59E0B",
  PUBLICADO: "#10B981",
};

const STATUS_LABEL: Record<Post["status"], string> = {
  RASCUNHO: "Rascunho",
  COPY_PRONTA: "Copy pronta",
  DESIGN_PRONTO: "Design pronto",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
};

const FORMATO_LABEL: Record<Post["formato"], string> = {
  FEED: "Feed",
  STORIES: "Stories",
  REELS: "Reels",
  CARROSSEL: "Carrossel",
};

type View = "mes" | "semana" | "lista" | "feed";
const VIEW_STORAGE_KEY = "salhub.editorial.view";
const VIEWS: View[] = ["mes", "semana", "lista", "feed"];

function isPendente(p: Post) {
  return p.origem === "CLIENTE" && p.revisao === "PENDENTE";
}

export function EditorialCalendarClient({
  posts, clientes,
}: { posts: Post[]; clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroCanal, setFiltroCanal] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [creating, setCreating] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [view, setView] = useState<View>("mes");
  const [cursor, setCursor] = useState<Date>(() => new Date());

  // Edição via Sheet (peek mode) — URL state via ?post=<id>
  const sheet = useEntitySheet("post");

  // Persiste a view escolhida no localStorage (lê no mount).
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_STORAGE_KEY);
      if (v && (VIEWS as string[]).includes(v)) setView(v as View);
    } catch {
      /* ignore */
    }
  }, []);
  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  }

  // Fila de revisão = submetido pelo cliente + ainda pendente.
  const pendentesRevisao = posts.filter(isPendente);

  const filtrados = useMemo(
    () =>
      posts.filter((p) =>
        (!filtroCliente || p.clienteId === filtroCliente) &&
        (!filtroStatus || p.status === filtroStatus) &&
        (!filtroCanal || p.canais.includes(filtroCanal)) &&
        (!soPendentes || isPendente(p))
      ),
    [posts, filtroCliente, filtroStatus, filtroCanal, soPendentes]
  );

  function abrirPost(id: string) {
    sheet.open(id);
  }
  function criarEm(date: Date) {
    setDefaultDate(date);
    setCreating(true);
  }

  return (
    <div className="space-y-4">
      {/* Barra de controles: filtros + toggle de view + novo post */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filtroCliente} onValueChange={(v) => setFiltroCliente(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="RASCUNHO">Rascunho</SelectItem>
              <SelectItem value="COPY_PRONTA">Copy pronta</SelectItem>
              <SelectItem value="DESIGN_PRONTO">Design pronto</SelectItem>
              <SelectItem value="AGENDADO">Agendado</SelectItem>
              <SelectItem value="PUBLICADO">Publicado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCanal} onValueChange={(v) => setFiltroCanal(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              {CANAIS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="inline-flex items-center gap-2">
                    <span style={{ color: c.cor }} className="inline-flex"><c.Icon className="h-3.5 w-3.5" /></span>
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={soPendentes ? "default" : "outline"}
            onClick={() => setSoPendentes((v) => !v)}
            disabled={pendentesRevisao.length === 0 && !soPendentes}
          >
            <Inbox className="h-4 w-4" />
            Pendentes de revisão
            {pendentesRevisao.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[10px] border-amber-500/40 text-amber-500">
                {pendentesRevisao.length}
              </Badge>
            )}
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle view={view} onChange={changeView} />
          <Button onClick={() => criarEm(new Date())}>
            <Plus className="h-4 w-4" /> Novo post
          </Button>
        </div>
      </div>

      {/* Navegação de período — só Mês/Semana (Lista e Feed são globais) */}
      {(view === "mes" || view === "semana") && (
        <PeriodNav view={view} cursor={cursor} onCursor={setCursor} />
      )}

      {/* Corpo do calendário */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {view === "mes" && (
          <MonthView cursor={cursor} posts={filtrados} onOpen={abrirPost} onCreate={criarEm} />
        )}
        {view === "semana" && (
          <WeekView cursor={cursor} posts={filtrados} onOpen={abrirPost} onCreate={criarEm} />
        )}
        {view === "lista" && (
          <ListView posts={filtrados} onOpen={abrirPost} onCreate={criarEm} />
        )}
        {view === "feed" && (
          <FeedView
            posts={filtrados}
            clienteId={filtroCliente}
            clientes={clientes}
            onOpen={abrirPost}
            onPickCliente={setFiltroCliente}
          />
        )}
      </div>

      {creating && (
        <NovoPostDialog
          open={creating}
          onOpenChange={setCreating}
          clientes={clientes}
          defaultDate={defaultDate}
        />
      )}

      <PostSheet
        postId={sheet.id}
        open={sheet.isOpen}
        onOpenChange={(o) => {
          if (!o) sheet.close();
          // Refresh ao fechar — calendário precisa refletir mudanças de
          // status, data, etc
          if (!o) router.refresh();
        }}
        clientes={clientes}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Toggle de view (Mês / Semana / Lista)
 * ────────────────────────────────────────────────────────────────────────── */
function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { value: View; label: string }[] = [
    { value: "mes", label: "Mês" },
    { value: "semana", label: "Semana" },
    { value: "lista", label: "Lista" },
    { value: "feed", label: "Feed" },
  ];
  return (
    <div className="inline-flex items-center rounded-lg bg-secondary p-1">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            view === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Navegação de período (◀ Mês de Ano ▶ + Hoje)
 * ────────────────────────────────────────────────────────────────────────── */
function PeriodNav({
  view, cursor, onCursor,
}: { view: View; cursor: Date; onCursor: (d: Date) => void }) {
  const isMes = view === "mes";
  const label = isMes
    ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
    : (() => {
        const ws = startOfWeek(cursor, { weekStartsOn: 0 });
        const we = endOfWeek(cursor, { weekStartsOn: 0 });
        const sameMonth = isSameMonth(ws, we);
        return sameMonth
          ? `${format(ws, "d", { locale: ptBR })}–${format(we, "d 'de' MMMM yyyy", { locale: ptBR })}`
          : `${format(ws, "d 'de' MMM", { locale: ptBR })} – ${format(we, "d 'de' MMM yyyy", { locale: ptBR })}`;
      })();

  function prev() {
    onCursor(isMes ? subMonths(cursor, 1) : subWeeks(cursor, 1));
  }
  function next() {
    onCursor(isMes ? addMonths(cursor, 1) : addWeeks(cursor, 1));
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-9 w-9" onClick={prev} aria-label="Anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-9 w-9" onClick={next} aria-label="Próximo">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="text-base font-semibold capitalize min-w-[180px]">{label}</div>
      <Button variant="outline" size="sm" onClick={() => onCursor(new Date())}>
        Hoje
      </Button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers de agrupamento
 * ────────────────────────────────────────────────────────────────────────── */
function postsDoDia(posts: Post[], dia: Date): Post[] {
  return posts
    .filter((p) => isSameDay(new Date(p.dataPublicacao), dia))
    .sort((a, b) => +new Date(a.dataPublicacao) - +new Date(b.dataPublicacao));
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ──────────────────────────────────────────────────────────────────────────
 * Card de post (compacto — usado no Mês)
 * ────────────────────────────────────────────────────────────────────────── */
function PostCardMini({ post, onOpen }: { post: Post; onOpen: (id: string) => void }) {
  const cor = STATUS_COR[post.status];
  const pendente = isPendente(post);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(post.id); }}
      title={`${post.clienteNome} · ${post.titulo}`}
      className={cn(
        "group/card w-full text-left flex items-center gap-1.5 rounded-md pl-1.5 pr-1 py-1 bg-secondary/60 hover:bg-secondary transition-colors border border-transparent",
        pendente && "ring-1 ring-amber-500/60 bg-amber-500/10"
      )}
    >
      <span
        className="h-3.5 w-1 rounded-full shrink-0"
        style={{ backgroundColor: cor }}
        title={STATUS_LABEL[post.status]}
      />
      {post.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbUrl} alt="" className="h-4 w-4 rounded object-cover shrink-0" />
      )}
      <span className="flex-1 min-w-0 truncate text-[11px] leading-tight">
        {post.origem === "CLIENTE" && <span title="Enviado pelo cliente">📥 </span>}
        <span className="text-muted-foreground">{post.clienteNome}</span>
        <span className="mx-1 text-muted-foreground/40">·</span>
        <span className="font-medium">{post.titulo}</span>
      </span>
      <CanalIcons canais={post.canais} size="h-2.5 w-2.5" />
      <span className="shrink-0 text-[9px] font-medium text-muted-foreground/80 tabular-nums">
        {format(new Date(post.dataPublicacao), "HH:mm")}
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Card de post (rico — usado em Semana e Lista)
 * ────────────────────────────────────────────────────────────────────────── */
function PostCardFull({
  post, onOpen, showDate = false,
}: { post: Post; onOpen: (id: string) => void; showDate?: boolean }) {
  const cor = STATUS_COR[post.status];
  const pendente = isPendente(post);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(post.id); }}
      className={cn(
        "w-full text-left flex items-stretch gap-2.5 rounded-lg p-2 bg-secondary/50 hover:bg-secondary hover:shadow-sm transition-all border border-border/60",
        pendente && "ring-1 ring-amber-500/60 border-amber-500/40 bg-amber-500/[0.07]"
      )}
    >
      <span className="w-1 rounded-full shrink-0" style={{ backgroundColor: cor }} />
      {post.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] font-medium text-muted-foreground tabular-nums">
            {format(new Date(post.dataPublicacao), showDate ? "dd/MM HH:mm" : "HH:mm")}
          </span>
          {post.origem === "CLIENTE" && (
            <span className="text-[10px] text-sky-500" title="Enviado pelo cliente">📥</span>
          )}
          {pendente && (
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-amber-500/40 text-amber-500">
              revisar
            </Badge>
          )}
        </div>
        <div className="text-[13px] font-semibold truncate leading-tight">{post.titulo}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground truncate">{post.clienteNome}</span>
          <Badge
            variant="outline"
            className="text-[9px] py-0 px-1.5"
            style={{ color: cor, borderColor: `${cor}55` }}
          >
            {FORMATO_LABEL[post.formato]}
          </Badge>
          <CanalIcons canais={post.canais} size="h-3 w-3" />
        </div>
      </div>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * VIEW: MÊS — grade 7 colunas, células com cards empilhados + "+N"
 * ────────────────────────────────────────────────────────────────────────── */
const MAX_CARDS_MES = 3;

function MonthView({
  cursor, posts, onOpen, onCreate,
}: { cursor: Date; posts: Post[]; onOpen: (id: string) => void; onCreate: (d: Date) => void }) {
  const dias = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  // Estado local: quais dias estão "expandidos" (mostrando todos os cards).
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  function toggleDia(key: string) {
    setExpandido((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  return (
    <div>
      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Grade de dias. Mobile: rola horizontalmente com largura mínima. */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[760px] auto-rows-fr">
          {dias.map((dia) => {
            const key = dia.toISOString();
            const doMes = isSameMonth(dia, cursor);
            const hoje = isToday(dia);
            const lista = postsDoDia(posts, dia);
            const aberto = expandido.has(key);
            const visiveis = aberto ? lista : lista.slice(0, MAX_CARDS_MES);
            const resto = lista.length - visiveis.length;
            return (
              <div
                key={key}
                onClick={() => onCreate(dia)}
                className={cn(
                  "min-h-[118px] border-b border-r border-border p-1.5 flex flex-col gap-1 cursor-pointer transition-colors hover:bg-muted/40",
                  !doMes && "bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between px-0.5">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center text-[11.5px] font-semibold h-5 min-w-5 px-1 rounded-full",
                      !doMes && "text-muted-foreground/40",
                      hoje && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(dia, "d")}
                  </span>
                  {lista.length > 0 && (
                    <span className="text-[9px] text-muted-foreground/60 font-medium">{lista.length}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {visiveis.map((p) => (
                    <PostCardMini key={p.id} post={p} onOpen={onOpen} />
                  ))}
                  {resto > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleDia(key); }}
                      className="text-[10px] font-medium text-muted-foreground hover:text-foreground text-left px-1.5 py-0.5 rounded hover:bg-secondary transition-colors"
                    >
                      +{resto} {resto === 1 ? "post" : "posts"}
                    </button>
                  )}
                  {aberto && lista.length > MAX_CARDS_MES && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleDia(key); }}
                      className="text-[10px] font-medium text-muted-foreground hover:text-foreground text-left px-1.5 py-0.5 rounded hover:bg-secondary transition-colors"
                    >
                      recolher
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * VIEW: SEMANA — 7 colunas, posts ordenados por horário, mais espaço
 * ────────────────────────────────────────────────────────────────────────── */
function WeekView({
  cursor, posts, onOpen, onCreate,
}: { cursor: Date; posts: Post[]; onOpen: (id: string) => void; onCreate: (d: Date) => void }) {
  const dias = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    const end = endOfWeek(cursor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 min-w-[860px] auto-rows-fr">
        {dias.map((dia) => {
          const hoje = isToday(dia);
          const lista = postsDoDia(posts, dia);
          return (
            <div
              key={dia.toISOString()}
              className="border-r border-border last:border-r-0 flex flex-col min-h-[460px]"
            >
              <div
                className={cn(
                  "px-2 py-2 border-b border-border text-center sticky top-0 bg-card",
                  hoje && "bg-primary/5"
                )}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {WEEKDAYS[dia.getDay()]}
                </div>
                <div
                  className={cn(
                    "inline-flex items-center justify-center text-sm font-semibold h-7 min-w-7 px-1.5 rounded-full mt-0.5",
                    hoje && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(dia, "d")}
                </div>
              </div>
              <div
                onClick={() => onCreate(dia)}
                className="flex-1 p-1.5 flex flex-col gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                {lista.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground/40 text-center mt-3 select-none">
                    +
                  </span>
                ) : (
                  lista.map((p) => <PostCardFull key={p.id} post={p} onOpen={onOpen} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * VIEW: LISTA — cronológica, agrupada por dia
 * ────────────────────────────────────────────────────────────────────────── */
function ListView({
  posts, onOpen, onCreate,
}: { posts: Post[]; onOpen: (id: string) => void; onCreate: (d: Date) => void }) {
  // Agrupa por dia (ordem cronológica ascendente).
  const grupos = useMemo(() => {
    const ordenados = [...posts].sort(
      (a, b) => +new Date(a.dataPublicacao) - +new Date(b.dataPublicacao)
    );
    const map = new Map<string, { dia: Date; itens: Post[] }>();
    for (const p of ordenados) {
      const d = new Date(p.dataPublicacao);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, { dia: d, itens: [] });
      map.get(key)!.itens.push(p);
    }
    return Array.from(map.values());
  }, [posts]);

  if (grupos.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Nenhum post no filtro atual.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {grupos.map(({ dia, itens }) => {
        const hoje = isToday(dia);
        return (
          <div key={dia.toISOString()} className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center justify-center text-sm font-bold h-8 min-w-8 px-1.5 rounded-lg",
                    hoje ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  )}
                >
                  {format(dia, "d")}
                </span>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold capitalize">
                    {format(dia, "EEEE", { locale: ptBR })}
                  </div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {format(dia, "MMMM yyyy", { locale: ptBR })}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCreate(dia)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-secondary transition-colors"
              >
                <Plus className="h-3 w-3" /> post
              </button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {itens.map((p) => (
                <PostCardFull key={p.id} post={p} onOpen={onOpen} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * VIEW: FEED — preview do feed do Instagram (grid 3 colunas).
 * Exige um cliente selecionado. Mostra as artes (1ª imagem) dos posts que
 * ocupam o grid (FEED/CARROSSEL/REELS — Stories não entram no feed), na
 * ordem do Instagram: mais recente primeiro.
 * ────────────────────────────────────────────────────────────────────────── */
const FORMATOS_FEED: Post["formato"][] = ["FEED", "CARROSSEL", "REELS"];

function FeedView({
  posts, clienteId, clientes, onOpen, onPickCliente,
}: {
  posts: Post[];
  clienteId: string;
  clientes: { id: string; nome: string }[];
  onOpen: (id: string) => void;
  onPickCliente: (id: string) => void;
}) {
  // Feed = posts do cliente que ocupam o grid, mais recente primeiro.
  // (useMemo no topo — antes de qualquer return — pelas Rules of Hooks.)
  const cliente = clientes.find((c) => c.id === clienteId);
  const grid = useMemo(
    () =>
      clienteId
        ? posts
            .filter((p) => p.clienteId === clienteId && FORMATOS_FEED.includes(p.formato))
            .sort((a, b) => +new Date(b.dataPublicacao) - +new Date(a.dataPublicacao))
        : [],
    [posts, clienteId]
  );

  // Sem cliente escolhido → pede pra escolher um (feed é por perfil).
  if (!clienteId) {
    return (
      <div className="py-16 px-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Instagram className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-sm font-semibold">Escolha um cliente pra ver o feed</div>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
          A pré-visualização do feed mostra como as artes vão ficar no perfil
          do Instagram — por isso precisa de um cliente.
        </p>
        {clientes.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {clientes.slice(0, 8).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPickCliente(c.id)}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[12px] font-medium hover:bg-secondary hover:text-foreground transition-colors"
              >
                {c.nome}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (grid.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Nenhum post de feed para {cliente?.nome ?? "este cliente"} no filtro atual.
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      {/* Mini-cabeçalho estilo perfil */}
      <div className="mb-3 flex items-center gap-2 px-1">
        <Instagram className="h-4 w-4 text-muted-foreground" />
        <span className="text-[13px] font-semibold">{cliente?.nome ?? "Feed"}</span>
        <span className="text-[11px] text-muted-foreground">· prévia do feed ({grid.length})</span>
      </div>
      {/* Grid 3 colunas, células quadradas — igual ao Instagram. */}
      <div className="mx-auto grid max-w-[640px] grid-cols-3 gap-0.5 sm:gap-1">
        {grid.map((p) => (
          <FeedCell key={p.id} post={p} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function FeedCell({ post, onOpen }: { post: Post; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(post.id)}
      title={`${post.titulo} · ${format(new Date(post.dataPublicacao), "dd/MM")}`}
      className="group relative aspect-square overflow-hidden bg-secondary/60 hover:opacity-95 transition-opacity"
    >
      {post.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbUrl} alt={post.titulo} className="h-full w-full object-cover" />
      ) : (
        // Sem arte → placeholder com ícone + título.
        <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center">
          <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
          <span className="line-clamp-2 text-[10px] font-medium text-muted-foreground">
            {post.titulo}
          </span>
        </span>
      )}
      {/* Selo de formato (CARROSSEL/REELS) no canto, como o Instagram. */}
      {post.formato !== "FEED" && (
        <span className="absolute right-1 top-1 rounded bg-black/55 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white">
          {FORMATO_LABEL[post.formato]}
        </span>
      )}
      {/* Overlay no hover: ícones de canal + horário. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <CanalIcons canais={post.canais} size="h-2.5 w-2.5" />
        <span className="text-[8.5px] font-medium text-white tabular-nums">
          {format(new Date(post.dataPublicacao), "dd/MM")}
        </span>
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dialog de criação de post.
 * Edição vive no PostSheet (peek mode) — esse dialog é só pra criar.
 * ────────────────────────────────────────────────────────────────────────── */
function NovoPostDialog({
  open, onOpenChange, clientes, defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientes: { id: string; nome: string }[];
  defaultDate?: Date | null;
}) {
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<PostInput>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      titulo: "",
      legenda: "",
      pilar: "",
      formato: "FEED",
      status: "RASCUNHO",
      canais: [],
      clienteId: clientes[0]?.id ?? "",
      dataPublicacao: defaultDate ?? new Date(),
    },
  });

  async function onSubmit(values: PostInput) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    toast.success("Post criado");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Novo post</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5"><Label>Título*</Label><Input {...register("titulo")} /></div>
          <div className="space-y-1.5">
            <Label>Legenda</Label>
            <RichTextField
              value={watch("legenda") ?? ""}
              onChange={(blocks: PartialBlock[]) => setValue("legenda", JSON.stringify(blocks))}
              placeholder="Copy do post — / abre blocos, @ menciona entidades..."
              minHeight="100px"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Canais</Label>
            <CanaisSelector
              value={watch("canais") ?? []}
              onChange={(next) => setValue("canais", next)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Pilar</Label><Input {...register("pilar")} placeholder="Ex: Educacional, Vendas" /></div>
            <div className="space-y-1.5">
              <Label>Cliente*</Label>
              <Select value={watch("clienteId")} onValueChange={(v) => setValue("clienteId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select value={watch("formato")} onValueChange={(v) => setValue("formato", v as PostInput["formato"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEED">Feed</SelectItem>
                  <SelectItem value="STORIES">Stories</SelectItem>
                  <SelectItem value="REELS">Reels</SelectItem>
                  <SelectItem value="CARROSSEL">Carrossel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as PostInput["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                  <SelectItem value="COPY_PRONTA">Copy pronta</SelectItem>
                  <SelectItem value="DESIGN_PRONTO">Design pronto</SelectItem>
                  <SelectItem value="AGENDADO">Agendado</SelectItem>
                  <SelectItem value="PUBLICADO">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Data de publicação*</Label>
              <Input type="datetime-local" {...register("dataPublicacao")} />
            </div>
          </div>
          {watch("status") === "AGENDADO" && (
            <p className="text-xs text-muted-foreground">Ao salvar como Agendado, um evento será criado na sua Google Agenda.</p>
          )}
          <DialogFooter className="justify-between">
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
