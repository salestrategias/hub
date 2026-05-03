"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/utils";

type Evento = { id: string; titulo: string; inicio: string; fim: string };
export function ProximosEventos() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agenda/proximos?limit=5")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErro(d.error);
        else setEventos(d);
      })
      .catch((e) => setErro(String(e)));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarRange className="h-4 w-4" /> Próximos eventos (Google Agenda)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {erro && <p className="text-xs text-muted-foreground">Conecte sua conta Google para ver os eventos.</p>}
        {!erro && !eventos && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!erro && eventos?.length === 0 && <p className="text-xs text-muted-foreground">Sem eventos nos próximos dias.</p>}
        {eventos && eventos.length > 0 && (
          <ul className="space-y-2 text-sm">
            {eventos.map((e) => (
              <li key={e.id} className="flex justify-between items-center">
                <span className="truncate pr-2">{e.titulo}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{formatDateTime(e.inicio)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
