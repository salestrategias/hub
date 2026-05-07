"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Check, AlertTriangle, X } from "lucide-react";
import type { HealthBreakdown } from "@/lib/cliente-insights";

type Props = {
  score: number;
  label: "Saudável" | "Atenção" | "Crítico";
  breakdown: HealthBreakdown;
};

const COLORS = {
  Saudável: { stroke: "#10B981", text: "text-emerald-400", bg: "rgba(16,185,129,0.10)" },
  Atenção: { stroke: "#F59E0B", text: "text-amber-400", bg: "rgba(245,158,11,0.10)" },
  Crítico: { stroke: "#EF4444", text: "text-rose-400", bg: "rgba(239,68,68,0.10)" },
};

/**
 * Anel circular com score 0-100 + breakdown em tooltip.
 *
 * SVG arc usa propriedades stroke-dasharray pra desenhar a fração
 * preenchida. Animação CSS com transition de stroke-dashoffset.
 */
export function HealthScore({ score, label, breakdown }: Props) {
  const [hover, setHover] = useState(false);
  const colors = COLORS[label];

  // Geometria do anel
  const size = 130;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillFraction = score / 100;
  const dashoffset = circumference * (1 - fillFraction);

  return (
    <Card
      className="relative group overflow-visible"
      style={{ boxShadow: `0 0 0 1px ${colors.stroke}33, 0 8px 24px ${colors.bg}` }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width={size} height={size} className="-rotate-90">
            {/* track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="hsl(var(--secondary))"
              strokeWidth={stroke}
              fill="none"
            />
            {/* progress */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.stroke}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              style={{
                transition: "stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-display font-bold text-3xl tracking-tight tabular-nums", colors.text)}>
              {score}
            </span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">
              de 100
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className={cn("h-3.5 w-3.5", colors.text)} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Saúde do relacionamento
            </span>
          </div>
          <div className={cn("font-display text-lg font-semibold tracking-tight", colors.text)}>
            {label}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            Baseado em reuniões, posts, tarefas, contrato e pagamentos.
            <br className="hidden sm:block" />
            <span className="text-muted-foreground/70">Passe o mouse pro detalhamento.</span>
          </p>
        </div>
      </CardContent>

      {/* Tooltip de breakdown */}
      {hover && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-2xl p-3 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          <BreakdownItem item={breakdown.reuniaoRecente} label="Reunião recente" />
          <BreakdownItem item={breakdown.tarefasAtrasadas} label="Tarefas atrasadas" />
          <BreakdownItem item={breakdown.postsRecentes} label="Posts publicados" />
          <BreakdownItem item={breakdown.contrato} label="Contrato" />
          <BreakdownItem item={breakdown.pagamentos} label="Pagamentos" />
        </div>
      )}
    </Card>
  );
}

function BreakdownItem({
  item,
  label,
}: {
  item: { score: number; max: number; label: string };
  label: string;
}) {
  const ratio = item.score / item.max;
  const Icon = ratio === 1 ? Check : ratio >= 0.5 ? AlertTriangle : X;
  const color = ratio === 1 ? "text-emerald-400" : ratio >= 0.5 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="flex items-center gap-2.5">
      <Icon className={cn("h-3 w-3 shrink-0", color)} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium leading-tight">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate leading-tight">{item.label}</div>
      </div>
      <span className={cn("text-[10px] font-mono tabular-nums shrink-0", color)}>
        {item.score}/{item.max}
      </span>
    </div>
  );
}
