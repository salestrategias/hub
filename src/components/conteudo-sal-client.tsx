"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import type { PostStatus, FormatoSAL } from "@prisma/client";
import type { EditorBlock as PartialBlock } from "@/components/editor/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";
import { useEntitySheet } from "@/components/entity-sheet";
import { ConteudoSalSheet } from "@/components/sheets/conteudo-sal-sheet";
import {
  Plus,
  CalendarDays,
  Kanban,
  LayoutGrid,
  Instagram,
  Linkedin,
  Youtube,
  Music2,
  Mail,
  FileText,
  Megaphone,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ConteudoSAL = {
  id: string;
  titulo: string;
  copy: string | null;
  briefing: string | null;
  formato: FormatoSAL;
  status: PostStatus;
  pilar: string | null;
  dataPublicacao: string;
  url: string | null;
  googleEventId: string | null;
};

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const FORMATO_LABEL: Record<FormatoSAL, string> = {
  INSTAGRAM_FEED: "Instagram Feed",
  INSTAGRAM_STORIES: "Instagram Stories",
  INSTAGRAM_REELS: "Instagram Reels",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  NEWSLETTER: "Newsletter",
  BLOG_POST: "Blog post",
  AD_CREATIVE: "Ad creative",
};

const FORMATO_ICON: Record<FormatoSAL, React.ComponentType<{ className?: string }>> = {
  INSTAGRAM_FEED: Instagram,
  INSTAGRAM_STORIES: Instagram,
  INSTAGRAM_REELS: Instagram,
  LINKEDIN: Linkedin,
  TIKTOK: Music2,
  YOUTUBE: Youtube,
  NEWSLETTER: Mail,
  BLOG_POST: FileText,
  AD_CREATIVE: Megaphone,
};

const STATUS_COR: Record<PostStatus, string> = {
  RASCUNHO: "#64748B",
  COPY_PRONTA: "#3B82F6",
  DESIGN_PRONTO: "#8B5CF6",
  AGENDADO: "#F59E0B",
  PUBLICADO: "#10B981",
};

const STATUS_LABEL: Record<PostStatus, string> = {
  RASCUNHO: "Rascunho",
  COPY_PRONTA: "Copy pronta",
  DESIGN_PRONTO: "Design pronto",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
};

const STATUS_ORDEM: PostStatus[] = ["RASCUNHO", "COPY_PRONTA", "DESIGN_PRONTO", "AGENDADO", "PUBLICADO"];

type Vista = "calendar" | "kanban" | "pilar";

export function ConteudoSalClient({ initial }: { initial: ConteudoSAL[] }) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("calendar");
  const [filtroFormato, setFiltroFormato] = useState<FormatoSAL | "TODOS">("TODOS");
  const [filtroPilar, setFiltroPilar] = useState<string>("TODOS");
  const [criando, setCriando] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const sheet = useEntitySheet("conteudo");

  const filtrados = useMemo(() => {
    return initial.filter((c) => {
      if (filtroFormato !== "TODOS" && c.formato !== filtroFormato) return false;
      if (filtroPilar !== "TODOS" && c.pilar !== filtroPilar) return false;
      return true;
    });
  }, [initial, filtroFormato, filtroPilar]);

  // Pilares únicos pra dropdown
  const pilaresUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const c of initial) {
      if (c.pilar) set.add(c.pilar);
    }
    return Array.from(set).sort();
  }, [initial]);

  if (initial.length === 0) {
    return (
      <>
        <EmptyState
          icon={Sparkles}
          titulo="Sem conteúdos planejados ainda"
          descricao="Crie o planejamento editorial da própria SAL — Instagram, LinkedIn, newsletter, blog, ads. Workflow rascunho → copy → design → agendado → publicado, igual ao editorial dos clientes mas separado pra não misturar."
          acaoLabel="Criar primeira peça"
          acaoIcon={Plus}
          acaoOnClick={() => {
            setDefaultDate(new Date());
            setCriando(true);
          }}
        />
        {criando && <NovoConteudoDialog open={criando} onOpenChange={setCriando} defaultDate={defaultDate} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: filtros + view toggle + novo */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
          <TabsList>
            <TabsTrigger value="calendar">
              <CalendarDays className="h-3 w-3 mr-1.5" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="kanban">
              <Kanban className="h-3 w-3 mr-1.5" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="pilar">
              <LayoutGrid className="h-3 w-3 mr-1.5" /> Por pilar
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 ml-auto items-center">
          <Select value={filtroFormato} onValueChange={(v) => setFiltroFormato(v as FormatoSAL | "TODOS")}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Formato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos formatos</SelectItem>
              {(Object.keys(FORMATO_LABEL) as FormatoSAL[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FORMATO_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {pilaresUnicos.length > 0 && (
            <Select value={filtroPilar} onValueChange={setFiltroPilar}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Pilar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos pilares</SelectItem>
                {pilaresUnicos.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={() => {
              setDefaultDate(new Date());
              setCriando(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova peça
          </Button>
        </div>
      </div>

      {/* Vista escolhida */}
      {vista === "calendar" && (
        <ViewCalendar
          itens={filtrados}
          onSelectEvent={(id) => sheet.open(id)}
          onSelectSlot={(date) => {
            setDefaultDate(date);
            setCriando(true);
          }}
        />
      )}
      {vista === "kanban" && (
        <ViewKanban itens={filtrados} onSelect={(id) => sheet.open(id)} />
      )}
      {vista === "pilar" && (
        <ViewPilar itens={filtrados} onSelect={(id) => sheet.open(id)} />
      )}

      {criando && <NovoConteudoDialog open={criando} onOpenChange={setCriando} defaultDate={defaultDate} />}

      <ConteudoSalSheet
        conteudoId={sheet.id}
        open={sheet.isOpen}
        onOpenChange={(o) => {
          if (!o) sheet.close();
          if (!o) router.refresh();
        }}
      />
    </div>
  );
}

// ─── Vista: Calendário ──────────────────────────────────────────────

function ViewCalendar({
  itens,
  onSelectEvent,
  onSelectSlot,
}: {
  itens: ConteudoSAL[];
  onSelectEvent: (id: string) => void;
  onSelectSlot: (date: Date) => void;
}) {
  const eventos: Event[] = useMemo(
    () =>
      itens.map((c) => ({
        title: `${FORMATO_LABEL[c.formato]} · ${c.titulo}`,
        start: new Date(c.dataPublicacao),
        end: new Date(c.dataPublicacao),
        resource: c,
      })),
    [itens]
  );

  return (
    <Card>
      <CardContent className="p-4">
        <div style={{ height: 680 }}>
          <Calendar
            localizer={localizer}
            events={eventos}
            startAccessor="start"
            endAccessor="end"
            culture="pt-BR"
            messages={{
              next: "Próximo", previous: "Anterior", today: "Hoje",
              month: "Mês", week: "Semana", day: "Dia", agenda: "Agenda", noEventsInRange: "Sem peças no período",
            }}
            onSelectEvent={(e) => onSelectEvent((e.resource as ConteudoSAL).id)}
            onSelectSlot={(slot) => onSelectSlot(slot.start as Date)}
            selectable
            eventPropGetter={(e) => {
              const c = e.resource as ConteudoSAL;
              return {
                style: { backgroundColor: STATUS_COR[c.status], borderRadius: 6, border: 0, fontSize: 11 },
              };
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Vista: Kanban (por status) ─────────────────────────────────────

function ViewKanban({
  itens,
  onSelect,
}: {
  itens: ConteudoSAL[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="grid grid-cols-5 gap-3 min-w-[1100px]">
        {STATUS_ORDEM.map((status) => {
          const lista = itens.filter((c) => c.status === status);
          return (
            <div key={status} className="rounded-lg border border-border bg-card/40 p-2 min-h-[460px]">
              <div className="px-2 py-1.5 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: STATUS_COR[status] }} />
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/70">{lista.length}</span>
              </div>
              <div className="space-y-2">
                {lista.map((c) => (
                  <ConteudoCard key={c.id} c={c} onClick={() => onSelect(c.id)} />
                ))}
                {lista.length === 0 && (
                  <div className="text-center py-6 text-[10.5px] text-muted-foreground/40">
                    Sem peças nessa etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vista: Por pilar ───────────────────────────────────────────────

function ViewPilar({
  itens,
  onSelect,
}: {
  itens: ConteudoSAL[];
  onSelect: (id: string) => void;
}) {
  // Agrupa por pilar (e separa "Sem pilar")
  const grupos = useMemo(() => {
    const m = new Map<string, ConteudoSAL[]>();
    for (const c of itens) {
      const k = c.pilar || "Sem pilar";
      const arr = m.get(k) ?? [];
      arr.push(c);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort((a, b) => {
      // "Sem pilar" sempre por último
      if (a[0] === "Sem pilar") return 1;
      if (b[0] === "Sem pilar") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [itens]);

  if (grupos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Sem peças com os filtros atuais.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {grupos.map(([pilar, lista]) => (
        <div key={pilar}>
          <div className="flex items-center gap-2 mb-2.5">
            <h3 className="text-sm font-semibold">{pilar}</h3>
            <span className="text-[10.5px] text-muted-foreground/70 font-mono">
              {lista.length} {lista.length === 1 ? "peça" : "peças"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lista.map((c) => (
              <ConteudoCard key={c.id} c={c} onClick={() => onSelect(c.id)} compact={false} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card reutilizável ──────────────────────────────────────────────

function ConteudoCard({
  c,
  onClick,
  compact = true,
}: {
  c: ConteudoSAL;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = FORMATO_ICON[c.formato];
  const cor = STATUS_COR[c.status];
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition hover:border-primary/40 group"
      style={{ borderLeft: `3px solid ${cor}` }}
    >
      <CardContent className={cn(compact ? "p-3" : "p-4", "space-y-1.5")}>
        <div className="flex items-start gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium leading-tight line-clamp-2">{c.titulo}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {FORMATO_LABEL[c.formato]}
              {c.pilar && <span> · {c.pilar}</span>}
            </div>
          </div>
          {c.url && (
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground/70 hover:text-sal-400 shrink-0"
              title="Abrir peça publicada"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <Badge variant="outline" className="text-[9.5px]" style={{ color: cor, borderColor: `${cor}55` }}>
            {STATUS_LABEL[c.status]}
          </Badge>
          <span className="text-[10px] text-muted-foreground/70 font-mono">
            {new Date(c.dataPublicacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dialog: nova peça ─────────────────────────────────────────────

function NovoConteudoDialog({
  open,
  onOpenChange,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate: Date | null;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [formato, setFormato] = useState<FormatoSAL>("INSTAGRAM_FEED");
  const [pilar, setPilar] = useState("");
  const [dataPub, setDataPub] = useState<string>(() => {
    const d = defaultDate ?? new Date();
    const off = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  });
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/conteudo-sal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          formato,
          pilar: pilar.trim() || null,
          dataPublicacao: new Date(dataPub).toISOString(),
          status: "RASCUNHO",
          copy: "",
          briefing: "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      toast.success("Peça criada");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova peça de conteúdo SAL</DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Captura rápida — refina o resto (copy, briefing) clicando na peça depois.
          </p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título*</Label>
            <Input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: 5 sinais que sua agência está cara demais" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select value={formato} onValueChange={(v) => setFormato(v as FormatoSAL)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORMATO_LABEL) as FormatoSAL[]).map((f) => (
                    <SelectItem key={f} value={f}>{FORMATO_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data publicação</Label>
              <Input type="datetime-local" value={dataPub} onChange={(e) => setDataPub(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Pilar</Label>
              <Input value={pilar} onChange={(e) => setPilar(e.target.value)} placeholder="Autoridade, Educacional, Bastidor..." />
              <p className="text-[10px] text-muted-foreground/70">Texto livre. Reusa os pilares que você já está usando.</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? "Criando..." : "Criar e abrir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
