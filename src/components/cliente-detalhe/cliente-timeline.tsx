"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mic,
  FileText,
  ListChecks,
  Banknote,
  Link2,
  FileSignature,
  History,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEvento, TimelineEventoTipo } from "@/lib/cliente-insights";

type Props = {
  eventos: TimelineEvento[];
};

const ICONES: Record<TimelineEventoTipo, React.ComponentType<{ className?: string }>> = {
  REUNIAO: Mic,
  POST: FileText,
  TAREFA: ListChecks,
  LANCAMENTO: Banknote,
  MENTION: Link2,
  CONTRATO: FileSignature,
};

const CORES: Record<TimelineEventoTipo, { bg: string; text: string }> = {
  REUNIAO: { bg: "rgba(126,48,225,0.12)", text: "text-sal-400" },
  POST: { bg: "rgba(59,130,246,0.10)", text: "text-blue-400" },
  TAREFA: { bg: "rgba(16,185,129,0.10)", text: "text-emerald-400" },
  LANCAMENTO: { bg: "rgba(245,158,11,0.10)", text: "text-amber-400" },
  MENTION: { bg: "rgba(236,72,153,0.10)", text: "text-pink-400" },
  CONTRATO: { bg: "rgba(20,184,166,0.10)", text: "text-teal-400" },
};

const FILTROS: Array<{ key: TimelineEventoTipo | "TODOS"; label: string }> = [
  { key: "TODOS", label: "Tudo" },
  { key: "REUNIAO", label: "Reuniões" },
  { key: "POST", label: "Posts" },
  { key: "TAREFA", label: "Tarefas" },
  { key: "LANCAMENTO", label: "Lançamentos" },
  { key: "MENTION", label: "Mentions" },
];

/**
 * Timeline cronológica de eventos do cliente. Lista vertical com pílula
 * colorida no início de cada item, agrupada por dia.
 *
 * Filtros por tipo no topo (chip toggleável).
 */
export function ClienteTimeline({ eventos }: Props) {
  const [filtro, setFiltro] = useState<TimelineEventoTipo | "TODOS">("TODOS");

  const filtrados = filtro === "TODOS" ? eventos : eventos.filter((e) => e.tipo === filtro);

  // Agrupa por dia
  const grupos = agruparPorDia(filtrados);

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
              <History className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold">Linha do tempo</h3>
            <span className="text-[10.5px] text-muted-foreground/70 font-mono">
              {filtrados.length} {filtrados.length === 1 ? "evento" : "eventos"}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-medium transition border",
                  filtro === f.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {grupos.length === 0 ? (
          <div className="py-10 text-center">
            <Filter className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              {filtro === "TODOS" ? "Sem atividade registrada." : "Nenhum evento desse tipo."}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* linha vertical */}
            <div className="absolute left-[15px] top-1 bottom-1 w-px bg-border" />

            <div className="space-y-5">
              {grupos.map(([dia, items]) => (
                <div key={dia}>
                  <div className="flex items-center gap-2 mb-2 ml-9">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {dia}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {items.map((e) => (
                      <TimelineItem key={e.id} evento={e} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineItem({ evento }: { evento: TimelineEvento }) {
  const Icon = ICONES[evento.tipo];
  const cores = CORES[evento.tipo];
  const hora = new Date(evento.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const conteudo = (
    <>
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-card",
          cores.text
        )}
        style={{ background: cores.bg }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12.5px] font-medium leading-tight">{evento.titulo}</span>
          {evento.meta && (
            <span className="text-[10.5px] text-muted-foreground font-mono">{evento.meta}</span>
          )}
        </div>
        {evento.subtitulo && (
          <div className="text-[10.5px] text-muted-foreground truncate">{evento.subtitulo}</div>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">{hora}</span>
    </>
  );

  return (
    <li>
      {evento.href ? (
        <Link
          href={evento.href}
          className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition group"
        >
          {conteudo}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-2 py-1.5">{conteudo}</div>
      )}
    </li>
  );
}

function agruparPorDia(eventos: TimelineEvento[]): Array<[string, TimelineEvento[]]> {
  const map = new Map<string, TimelineEvento[]>();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  for (const e of eventos) {
    const d = new Date(e.data);
    d.setHours(0, 0, 0, 0);

    let label: string;
    if (d.getTime() === hoje.getTime()) {
      label = "Hoje";
    } else if (d.getTime() === ontem.getTime()) {
      label = "Ontem";
    } else {
      const diff = Math.floor((hoje.getTime() - d.getTime()) / 86_400_000);
      if (diff < 7) {
        label = d.toLocaleDateString("pt-BR", { weekday: "long" });
        label = label.charAt(0).toUpperCase() + label.slice(1);
      } else {
        label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: diff > 365 ? "numeric" : undefined });
      }
    }

    const arr = map.get(label) ?? [];
    arr.push(e);
    map.set(label, arr);
  }

  return Array.from(map.entries());
}
