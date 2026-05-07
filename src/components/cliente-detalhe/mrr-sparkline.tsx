"use client";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from "recharts";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useHideValues } from "@/components/hide-values-provider";
import { cn } from "@/lib/utils";

type Props = {
  data: { mes: string; receita: number }[];
};

/**
 * Sparkline de MRR/receita 12 meses. Calcula delta (último vs primeiro
 * mês não-zero) e mostra com seta. Respeita toggle de ocultar valores.
 */
export function MrrSparkline({ data }: Props) {
  const { resolvedTheme } = useTheme();
  const { hidden } = useHideValues();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted ? resolvedTheme === "dark" : true;
  const tooltipBg = dark ? "#13131C" : "#ffffff";
  const tooltipBorder = dark ? "#1F1F2D" : "#E2E2EA";
  const tooltipText = dark ? "#E5E5EE" : "#1F1F2D";

  // Calcular delta — último vs média dos primeiros 3 meses (estabiliza)
  const ultimoMes = data[data.length - 1]?.receita ?? 0;
  const primeirosTresMeses = data.slice(0, 3);
  const baselineMedia =
    primeirosTresMeses.reduce((s, d) => s + d.receita, 0) / Math.max(1, primeirosTresMeses.length);
  const delta = baselineMedia > 0 ? ((ultimoMes - baselineMedia) / baselineMedia) * 100 : 0;
  const deltaRound = Math.round(delta * 10) / 10;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Receita 12 meses
            </span>
            <div className="text-[20px] font-semibold tracking-tight font-display leading-none mt-1.5">
              {hidden ? (
                <span className="text-muted-foreground tracking-tight">R$ ••••••</span>
              ) : (
                <span className="font-mono">{formatBRLShort(ultimoMes)}</span>
              )}
            </div>
            <div className="text-[10.5px] text-muted-foreground/70 mt-0.5">no mês corrente</div>
          </div>
          <DeltaPill value={deltaRound} />
        </div>

        <div className="-mx-1.5 -mb-1.5 mt-1">
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="mrr-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7E30E1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#7E30E1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" hide />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 8,
                  color: tooltipText,
                  fontSize: 11,
                  padding: "4px 8px",
                }}
                formatter={(v: number) => (hidden ? "R$ •••" : formatBRL(v))}
                labelFormatter={(l) => `${l}`}
                cursor={{ stroke: "rgba(126,48,225,0.4)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="#7E30E1"
                strokeWidth={2}
                fill="url(#mrr-gradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaPill({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground font-mono">
        <Minus className="h-2.5 w-2.5" /> 0%
      </span>
    );
  }
  const positivo = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10.5px] font-mono px-1.5 py-0.5 rounded font-semibold",
        positivo
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-rose-500/10 text-rose-400"
      )}
    >
      {positivo ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {positivo ? "+" : ""}{value}%
    </span>
  );
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatBRLShort(n: number): string {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${n.toFixed(0)}`;
}
