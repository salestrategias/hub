"use client";
/**
 * Tab Tarefas do Portal — read-only.
 * Cliente vê em que a SAL está trabalhando, separado em abertas e
 * concluídas (últimos 30 dias).
 */
import { useEffect, useState } from "react";
import { ListChecks, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA";
  dataEntrega: string | null;
  concluida: boolean;
  updatedAt: string;
};

const PRIO_COR: Record<string, string> = {
  URGENTE: "#EF4444",
  ALTA: "#F59E0B",
  NORMAL: "#3B82F6",
  BAIXA: "#9CA3AF",
};

const PRIO_LABEL: Record<string, string> = {
  URGENTE: "Urgente",
  ALTA: "Alta",
  NORMAL: "Normal",
  BAIXA: "Baixa",
};

export function PortalTarefas({ token }: { token: string }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/p/cliente/${token}/tarefas`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setTarefas(d); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const abertas = tarefas.filter((t) => !t.concluida);
  const concluidas = tarefas.filter((t) => t.concluida);

  if (tarefas.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <ListChecks className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sem tarefas registradas pra você no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {abertas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Em andamento ({abertas.length})
          </h2>
          <div className="space-y-1.5">
            {abertas.map((t) => <TarefaItem key={t.id} tarefa={t} />)}
          </div>
        </section>
      )}

      {concluidas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Concluídas recentemente ({concluidas.length})
          </h2>
          <div className="space-y-1.5">
            {concluidas.map((t) => <TarefaItem key={t.id} tarefa={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function TarefaItem({ tarefa }: { tarefa: Tarefa }) {
  const cor = PRIO_COR[tarefa.prioridade];
  const dataEntrega = tarefa.dataEntrega ? new Date(tarefa.dataEntrega) : null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const atrasada = !tarefa.concluida && dataEntrega && dataEntrega < hoje;

  return (
    <Card>
      <CardContent className="p-3.5 sm:p-3.5 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {tarefa.concluida ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : atrasada ? (
            <AlertCircle className="h-4 w-4 text-rose-500" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[13.5px] sm:text-[13px] font-medium leading-snug ${tarefa.concluida ? "text-muted-foreground line-through" : ""}`}>
            {tarefa.titulo}
          </div>
          {tarefa.descricao && (
            <p className="text-[11.5px] sm:text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{tarefa.descricao}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 sm:mt-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
              {PRIO_LABEL[tarefa.prioridade]}
            </Badge>
            {dataEntrega && (
              <span className={`text-[10px] font-mono ${atrasada ? "text-rose-500" : "text-muted-foreground"}`}>
                {atrasada ? "Atrasada · " : ""}
                {dataEntrega.toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
