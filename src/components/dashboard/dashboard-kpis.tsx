"use client";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyValue } from "@/components/money-value";
import { TrendingUp, TrendingDown, Minus, Users, Megaphone, Wallet, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiData = {
  mrr: number;
  receitaMesAtual: number;
  receitaMesAnterior: number;
  saldoMesAtual: number; // receitas - despesas do mês atual
  clientesAtivos: number;
  clientesProspect: number;
  postsMes: number;
  reunioesMes: number;
};

export function DashboardKpis({ data }: { data: KpiData }) {
  const deltaReceita = data.receitaMesAnterior > 0
    ? ((data.receitaMesAtual - data.receitaMesAnterior) / data.receitaMesAnterior) * 100
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: "60ms" }}>
      <KpiCard
        label="MRR"
        icon={Wallet}
        accent="sal"
        money
        value={data.mrr}
        hint="Recorrente mensal"
      />
      <KpiCard
        label="Receita do mês"
        icon={TrendingUp}
        accent="emerald"
        money
        value={data.receitaMesAtual}
        delta={deltaReceita}
        hint={`vs ${formatBRLShort(data.receitaMesAnterior)} mês passado`}
      />
      <KpiCard
        label="Clientes ativos"
        icon={Users}
        accent="blue"
        value={String(data.clientesAtivos)}
        hint={data.clientesProspect > 0 ? `+${data.clientesProspect} em prospect` : undefined}
      />
      <KpiCard
        label="Pulse de produção"
        icon={Activity}
        accent="amber"
        value={`${data.postsMes} posts`}
        hint={`${data.reunioesMes} reuniões no mês`}
      />
    </div>
  );
}

type KpiCardProps =
  | {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      accent: "sal" | "emerald" | "blue" | "amber";
      money: true;
      value: number;
      delta?: number;
      hint?: string;
    }
  | {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      accent: "sal" | "emerald" | "blue" | "amber";
      money?: false;
      value: string;
      delta?: number;
      hint?: string;
    };

const ACCENTS = {
  sal: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
} as const;

function KpiCard(props: KpiCardProps) {
  const { label, icon: Icon, accent, hint, delta } = props;

  return (
    <Card className="group transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </span>
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center",
              ACCENTS[accent]
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="text-[24px] font-semibold tracking-tight font-display leading-none">
          {props.money ? (
            <MoneyValue value={props.value} className="font-display tracking-tight" />
          ) : (
            <span>{props.value}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2.5 min-h-[16px]">
          {delta !== undefined && <DeltaBadge value={delta} />}
          {hint && (
            <span className="text-[10.5px] text-muted-foreground/80 truncate">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const v = Math.round(value * 10) / 10;
  if (Math.abs(v) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10.5px] text-muted-foreground font-mono">
        <Minus className="h-2.5 w-2.5" /> 0%
      </span>
    );
  }
  const positivo = v > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10.5px] font-mono font-medium",
        positivo ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      {positivo ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {positivo ? "+" : ""}
      {v}%
    </span>
  );
}

function formatBRLShort(n: number): string {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${n.toFixed(0)}`;
}
