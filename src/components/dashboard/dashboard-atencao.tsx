"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, FileSignature, ListChecks, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type ContratoVencendo = {
  id: string;
  cliente: string;
  diasRestantes: number;
  dataFim: string;
  valor: number;
};

type TarefaAtrasada = {
  id: string;
  titulo: string;
  cliente: string | null;
  prioridade: string;
  diasAtraso: number;
};

type ActionAtrasado = {
  id: string;
  texto: string;
  reuniaoId: string;
  reuniaoTitulo: string;
  diasAtraso: number;
};

export function DashboardAtencao({
  contratos,
  tarefasAtrasadas,
  actionItems,
}: {
  contratos: ContratoVencendo[];
  tarefasAtrasadas: TarefaAtrasada[];
  actionItems: ActionAtrasado[];
}) {
  const total = contratos.length + tarefasAtrasadas.length + actionItems.length;

  return (
    <Card
      className={cn(
        "animate-slide-up",
        total > 0 && "border-amber-500/40"
      )}
      style={{ animationDelay: "180ms" }}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-7 w-7 rounded-md flex items-center justify-center",
                total > 0 ? "bg-amber-500/15 text-amber-400" : "bg-secondary text-muted-foreground"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-sm font-semibold">Atenção</h2>
          </div>
          {total > 0 && (
            <span className="text-[10.5px] text-amber-400 font-mono">{total} pendente{total === 1 ? "" : "s"}</span>
          )}
        </div>

        {total === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">Nada urgente. 👌</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contratos.length > 0 && (
              <Block icon={FileSignature} label="Contratos vencendo">
                {contratos.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contratos?contrato=${c.id}`}
                    className="flex items-center gap-2 px-3 py-2 -mx-1 rounded-md hover:bg-secondary/60 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate">{c.cliente}</div>
                      <div className="text-[10.5px] text-muted-foreground font-mono">{c.dataFim}</div>
                    </div>
                    <DiasBadge dias={c.diasRestantes} kind="restantes" />
                  </Link>
                ))}
              </Block>
            )}

            {tarefasAtrasadas.length > 0 && (
              <Block icon={ListChecks} label="Tarefas atrasadas">
                {tarefasAtrasadas.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tarefas?tarefa=${t.id}`}
                    className="flex items-center gap-2 px-3 py-2 -mx-1 rounded-md hover:bg-secondary/60 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate">{t.titulo}</div>
                      <div className="text-[10.5px] text-muted-foreground truncate">{t.cliente ?? "Sem cliente"}</div>
                    </div>
                    <DiasBadge dias={t.diasAtraso} kind="atraso" />
                  </Link>
                ))}
              </Block>
            )}

            {actionItems.length > 0 && (
              <Block icon={Clock} label="Action items pendentes">
                {actionItems.map((a) => (
                  <Link
                    key={a.id}
                    href={`/reunioes/${a.reuniaoId}`}
                    className="flex items-start gap-2 px-3 py-2 -mx-1 rounded-md hover:bg-secondary/60 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] line-clamp-2">{a.texto}</div>
                      <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">{a.reuniaoTitulo}</div>
                    </div>
                    <DiasBadge dias={a.diasAtraso} kind="atraso" />
                  </Link>
                ))}
              </Block>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Block({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 px-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DiasBadge({ dias, kind }: { dias: number; kind: "restantes" | "atraso" }) {
  const critico = kind === "restantes" ? dias <= 7 : dias > 0;
  const aviso = kind === "restantes" ? dias <= 30 : false;
  return (
    <span
      className={cn(
        "text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0",
        critico
          ? "bg-destructive/15 text-destructive border-destructive/30"
          : aviso
          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
          : "bg-secondary text-muted-foreground border-border"
      )}
    >
      {kind === "restantes" ? `${dias}d` : `+${dias}d`}
    </span>
  );
}
