"use client";
/**
 * Calendário unificado — view única com tarefas, posts, reuniões,
 * contratos vencendo e propostas expirando.
 *
 * Features:
 *  - 3 views (Mês / Semana / Dia) via react-big-calendar
 *  - Filtro por tipo de evento (toggle chips)
 *  - Filtro por cliente
 *  - Drag-drop pra reagendar (tarefas/posts/reuniões/conteúdo SAL)
 *  - Click em evento abre detalhe (navega pro href da entidade)
 *  - Cor por tipo + estado (concluído=cinza, atrasado=vermelho)
 *  - Carregamento lazy quando muda a janela visível
 *
 * Drag-drop usa o addon `react-big-calendar/lib/addons/dragAndDrop`,
 * que vem com a lib (sem dep extra). Wrappa o Calendar com
 * `withDragAndDrop()` e expõe callbacks `onEventDrop` + `onEventResize`.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";
import type { CalendarioEvento, CalendarioOrigem } from "@/lib/calendario-unificado";

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// react-big-calendar trabalha com Date — convertemos no carregamento
type RbcEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarioEvento;
};

const TIPO_LABELS: Record<CalendarioOrigem, string> = {
  TAREFA: "Tarefas",
  POST: "Posts cliente",
  CONTEUDO_SAL: "Conteúdo SAL",
  REUNIAO: "Reuniões",
  CONTRATO_VENCENDO: "Contratos",
  PROPOSTA_EXPIRA: "Propostas",
};

const TODOS_TIPOS: CalendarioOrigem[] = [
  "TAREFA",
  "POST",
  "CONTEUDO_SAL",
  "REUNIAO",
  "CONTRATO_VENCENDO",
  "PROPOSTA_EXPIRA",
];

// HOC do react-big-calendar pra habilitar drag-drop
const DnDCalendar = withDragAndDrop<RbcEvent>(Calendar as never);

export function CalendarioUnificado({
  clientes,
}: {
  clientes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [eventos, setEventos] = useState<CalendarioEvento[]>([]);
  const [loading, setLoading] = useState(true);
  // No mobile (< 640px) força view=AGENDA — Mês/Semana ficam ilegíveis
  // em telas pequenas. Detectamos via window.innerWidth no mount + resize.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [view, setView] = useState<View>(Views.MONTH);
  // View efetiva: mobile sempre AGENDA, desktop respeita seleção do user
  const viewEfetiva = isMobile ? Views.AGENDA : view;

  const [data, setData] = useState(new Date());
  const [tiposAtivos, setTiposAtivos] = useState<Set<CalendarioOrigem>>(
    new Set(TODOS_TIPOS)
  );
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");

  // Janela de fetch: depende da view atual. Mês = janela maior (60d±),
  // Semana = ±2 semanas, Dia = ±3 dias. Mobile usa janela tipo Mês
  // (AGENDA precisa de mais dados pra ser útil).
  const janela = useMemo(() => {
    const d = new Date(data);
    const v = isMobile ? Views.MONTH : view;
    if (v === Views.MONTH || v === Views.AGENDA) {
      const inicio = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const fim = new Date(d.getFullYear(), d.getMonth() + 2, 0);
      return { inicio, fim };
    }
    if (v === Views.WEEK) {
      const inicio = new Date(d);
      inicio.setDate(d.getDate() - 14);
      const fim = new Date(d);
      fim.setDate(d.getDate() + 14);
      return { inicio, fim };
    }
    // DAY / AGENDA
    const inicio = new Date(d);
    inicio.setDate(d.getDate() - 3);
    const fim = new Date(d);
    fim.setDate(d.getDate() + 3);
    return { inicio, fim };
  }, [view, data]);

  async function carregar() {
    setLoading(true);
    const params = new URLSearchParams({
      inicio: janela.inicio.toISOString(),
      fim: janela.fim.toISOString(),
      tipos: Array.from(tiposAtivos).join(","),
    });
    if (clienteFiltro !== "todos") params.set("clienteId", clienteFiltro);

    try {
      const res = await fetch(`/api/calendario?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setEventos(data);
    } catch (e) {
      toast.error("Falha ao carregar calendário");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [janela.inicio.getTime(), janela.fim.getTime(), tiposAtivos, clienteFiltro]);

  const rbcEventos: RbcEvent[] = useMemo(
    () =>
      eventos.map((e) => ({
        id: e.id,
        title: e.titulo,
        start: new Date(e.inicio),
        end: new Date(e.fim),
        resource: e,
      })),
    [eventos]
  );

  function toggleTipo(t: CalendarioOrigem) {
    const novo = new Set(tiposAtivos);
    if (novo.has(t)) novo.delete(t);
    else novo.add(t);
    if (novo.size === 0) novo.add(t); // não deixar zerar
    setTiposAtivos(novo);
  }

  const handleEventDrop = useCallback(
    async ({ event, start }: { event: RbcEvent; start: string | Date }) => {
      const ev = event.resource;
      if (!ev.reagendavel) {
        toast.error("Esse evento não é reagendável (marco fixo).");
        return;
      }
      // Optimistic update
      const novoInicio = new Date(start);
      setEventos((prev) =>
        prev.map((e) =>
          e.id === ev.id
            ? { ...e, inicio: novoInicio.toISOString(), fim: novoInicio.toISOString() }
            : e
        )
      );
      try {
        const res = await fetch("/api/calendario/reagendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origem: ev.origem,
            entidadeId: ev.entidadeId,
            novoInicio: novoInicio.toISOString(),
          }),
        });
        if (!res.ok) throw new Error("Falha");
        toast.success(`Reagendado: ${ev.titulo}`);
        router.refresh();
      } catch (e) {
        toast.error("Falha ao reagendar — recarregando");
        carregar();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router]
  );

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          {TODOS_TIPOS.map((t) => {
            const ativo = tiposAtivos.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleTipo(t)}
                className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                  ativo
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                  style={{ background: corDoTipo(t) }}
                />
                {TIPO_LABELS[t]}
              </button>
            );
          })}

          <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
            <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
              <SelectTrigger className="w-full sm:w-[200px] h-8">
                <SelectValue placeholder="Todos clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {/* Calendário */}
      <Card>
        <CardContent className="p-2 sm:p-3">
          <div style={{ height: "calc(100vh - 280px)", minHeight: 420 }}>
            <DnDCalendar
              localizer={localizer}
              culture="pt-BR"
              events={rbcEventos}
              startAccessor="start"
              endAccessor="end"
              view={viewEfetiva}
              onView={(v) => !isMobile && setView(v)}
              date={data}
              onNavigate={setData}
              views={isMobile ? [Views.AGENDA] : [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: event.resource.cor,
                  borderColor: event.resource.cor,
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 500,
                  opacity: event.resource.estado === "concluido" ? 0.55 : 1,
                  textDecoration: event.resource.estado === "concluido" ? "line-through" : undefined,
                },
              })}
              onSelectEvent={(event) => {
                router.push(event.resource.href);
              }}
              onEventDrop={handleEventDrop}
              resizable={false}
              draggableAccessor={(event) => event.resource.reagendavel}
              messages={{
                date: "Data",
                time: "Hora",
                event: "Evento",
                allDay: "Dia todo",
                week: "Semana",
                work_week: "Semana útil",
                day: "Dia",
                month: "Mês",
                previous: "Anterior",
                next: "Próximo",
                yesterday: "Ontem",
                tomorrow: "Amanhã",
                today: "Hoje",
                agenda: "Agenda",
                noEventsInRange: "Sem eventos nesse período",
                showMore: (total) => `+ ${total} mais`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Arraste eventos pra reagendar · Clique pra abrir detalhe · Atalho{" "}
        <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">G</kbd>{" "}
        abre direto este calendário
      </p>
    </div>
  );
}

function corDoTipo(t: CalendarioOrigem): string {
  return {
    TAREFA: "#3B82F6",
    POST: "#7E30E1",
    CONTEUDO_SAL: "#10B981",
    REUNIAO: "#F59E0B",
    CONTRATO_VENCENDO: "#EF4444",
    PROPOSTA_EXPIRA: "#EC4899",
  }[t];
}
