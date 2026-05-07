"use client";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyValue } from "@/components/money-value";
import { Calendar, Banknote, Mic, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tempoComoClienteMeses: number;
  primeiraInteracao: string | null;
  ltvTotal: number;
  ticketMedioMensal: number;
  reunioesTotal: number;
  reunioesUltimos30d: number;
  postsTotal: number;
  postsPublicadosUltimos30d: number;
};

export function ClienteKpis(props: Props) {
  const dataInicio = props.primeiraInteracao
    ? new Date(props.primeiraInteracao).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Kpi
        icon={Calendar}
        accent="blue"
        label="Cliente há"
        value={
          props.tempoComoClienteMeses > 0
            ? `${props.tempoComoClienteMeses} ${props.tempoComoClienteMeses === 1 ? "mês" : "meses"}`
            : "—"
        }
        hint={dataInicio ? `desde ${dataInicio}` : undefined}
      />
      <Kpi
        icon={Banknote}
        accent="emerald"
        label="LTV total"
        valueNode={<MoneyValue value={props.ltvTotal} className="font-mono tracking-tight" />}
        hint={
          props.ticketMedioMensal > 0 ? (
            <>
              ticket <MoneyValue value={props.ticketMedioMensal} className="font-mono" /> /mês
            </>
          ) : undefined
        }
      />
      <Kpi
        icon={Mic}
        accent="sal"
        label="Reuniões"
        value={String(props.reunioesTotal)}
        hint={
          props.reunioesUltimos30d > 0
            ? `${props.reunioesUltimos30d} nos últimos 30d`
            : "0 nos últimos 30d"
        }
        hintDanger={props.reunioesUltimos30d === 0}
      />
      <Kpi
        icon={FileText}
        accent="amber"
        label="Posts publicados"
        value={String(props.postsTotal)}
        hint={
          props.postsPublicadosUltimos30d > 0
            ? `${props.postsPublicadosUltimos30d} nos últimos 30d`
            : "0 nos últimos 30d"
        }
        hintDanger={props.postsPublicadosUltimos30d === 0}
      />
    </div>
  );
}

const ACCENTS = {
  sal: "rgba(126,48,225,0.10)",
  emerald: "rgba(16,185,129,0.08)",
  blue: "rgba(59,130,246,0.08)",
  amber: "rgba(245,158,11,0.08)",
};

const ACCENT_TEXT = {
  sal: "text-sal-400",
  emerald: "text-emerald-400",
  blue: "text-blue-400",
  amber: "text-amber-400",
};

function Kpi({
  icon: Icon,
  accent,
  label,
  value,
  valueNode,
  hint,
  hintDanger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: keyof typeof ACCENTS;
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  hint?: React.ReactNode;
  hintDanger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
          <div
            className={cn("h-7 w-7 rounded-md flex items-center justify-center", ACCENT_TEXT[accent])}
            style={{ background: ACCENTS[accent] }}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="text-[20px] font-semibold tracking-tight font-display leading-none">
          {valueNode ?? value}
        </div>
        {hint && (
          <div
            className={cn(
              "text-[10.5px] mt-1.5",
              hintDanger ? "text-rose-400/80" : "text-muted-foreground/80"
            )}
          >
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
