"use client";
import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type Event, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

type AgendaEvento = { id: string; titulo: string; descricao?: string | null; inicio: string; fim: string };
type CalendarioInfo = { id: string; summary: string; primary: boolean };

export function AgendaClient() {
  const [eventos, setEventos] = useState<AgendaEvento[]>([]);
  const [cals, setCals] = useState<CalendarioInfo[]>([]);
  const [calId, setCalId] = useState("primary");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ inicio: Date; fim: Date } | null>(null);
  const [edit, setEdit] = useState<AgendaEvento | null>(null);

  useEffect(() => {
    fetch("/api/agenda/calendarios").then((r) => r.json()).then((d) => Array.isArray(d) && setCals(d));
  }, []);

  async function carregar() {
    setLoading(true);
    setErro(null);
    const params = new URLSearchParams({ calendarId: calId });
    const t = new Date(); t.setMonth(t.getMonth() - 1);
    const f = new Date(); f.setMonth(f.getMonth() + 3);
    params.set("timeMin", t.toISOString()); params.set("timeMax", f.toISOString());
    const res = await fetch(`/api/agenda/eventos?${params}`);
    const data = await res.json();
    if (data.error) setErro(data.error); else setEventos(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [calId]);

  const eventosCal: Event[] = useMemo(
    () => eventos.map((e) => ({ title: e.titulo, start: new Date(e.inicio), end: new Date(e.fim), resource: e })),
    [eventos]
  );

  const semana = useMemo(() => {
    const ini = new Date(); ini.setHours(0, 0, 0, 0);
    const fim = new Date(ini); fim.setDate(fim.getDate() + 7);
    return eventos
      .filter((e) => new Date(e.inicio) >= ini && new Date(e.inicio) < fim)
      .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
  }, [eventos]);

  if (erro) {
    return (
      <Card><CardContent className="py-12 text-center text-sm">
        {erro}<br/><span className="text-xs text-muted-foreground">Faça login com Google para conceder acesso à Agenda.</span>
      </CardContent></Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Select value={calId} onValueChange={setCalId}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Calendário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Agenda principal</SelectItem>
              {cals.filter((c) => !c.primary).map((c) => <SelectItem key={c.id} value={c.id}>{c.summary}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { const i = new Date(); const f = new Date(i); f.setHours(f.getHours() + 1); setNovo({ inicio: i, fim: f }); }}>
            Novo evento
          </Button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4" style={{ height: 680 }}>
          {loading ? <div className="text-center text-sm text-muted-foreground py-12">Carregando...</div> : (
            <Calendar
              localizer={localizer}
              events={eventosCal}
              culture="pt-BR"
              defaultView={Views.MONTH}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              messages={{ next: "Próximo", previous: "Anterior", today: "Hoje", month: "Mês", week: "Semana", day: "Dia", agenda: "Agenda" }}
              selectable
              onSelectSlot={(s) => setNovo({ inicio: s.start as Date, fim: s.end as Date })}
              onSelectEvent={(e) => setEdit(e.resource as AgendaEvento)}
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Esta semana</CardTitle></CardHeader>
        <CardContent>
          {semana.length === 0 && <p className="text-xs text-muted-foreground">Sem eventos.</p>}
          <ul className="space-y-3 text-sm">
            {semana.map((e) => (
              <li key={e.id} className="border-l-2 border-primary pl-3">
                <div className="font-medium">{e.titulo}</div>
                <div className="text-xs text-muted-foreground font-mono">{formatDateTime(e.inicio)}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {novo && <EventoDialog onClose={() => setNovo(null)} defaultInicio={novo.inicio} defaultFim={novo.fim} onSaved={() => carregar()} />}
      {edit && <EventoDialog onClose={() => setEdit(null)} evento={edit} onSaved={() => carregar()} />}
    </div>
  );
}

function EventoDialog({
  evento, defaultInicio, defaultFim, onClose, onSaved,
}: { evento?: AgendaEvento; defaultInicio?: Date; defaultFim?: Date; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [inicio, setInicio] = useState(toLocalInput(evento ? new Date(evento.inicio) : defaultInicio ?? new Date()));
  const [fim, setFim] = useState(toLocalInput(evento ? new Date(evento.fim) : defaultFim ?? new Date()));
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    const url = evento ? `/api/agenda/eventos/${evento.id}` : "/api/agenda/eventos";
    const method = evento ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, descricao, inicio: new Date(inicio), fim: new Date(fim) }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo");
    onSaved(); onClose();
  }

  async function excluir() {
    if (!evento || !confirm("Excluir evento?")) return;
    await fetch(`/api/agenda/eventos/${evento.id}`, { method: "DELETE" });
    toast.success("Excluído");
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{evento ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Título*</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={3} value={descricao ?? ""} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Início</Label><Input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fim</Label><Input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter className="justify-between">
          <div>{evento && <Button variant="destructive" onClick={excluir}>Excluir</Button>}</div>
          <div className="flex gap-2">
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={salvar} disabled={saving || !titulo}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
