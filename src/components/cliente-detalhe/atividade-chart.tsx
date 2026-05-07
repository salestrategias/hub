"use client";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

type Semana = {
  semana: string;
  reunioes: number;
  posts: number;
  tarefasConcluidas: number;
  lancamentos: number;
};

const CORES = {
  reunioes: "#7E30E1",
  posts: "#3B82F6",
  tarefasConcluidas: "#10B981",
  lancamentos: "#F59E0B",
};

const LABELS = {
  reunioes: "Reuniões",
  posts: "Posts publicados",
  tarefasConcluidas: "Tarefas concluídas",
  lancamentos: "Lançamentos",
};

/**
 * Barras agrupadas mostrando atividade semanal (12 semanas, ~90d) por
 * categoria. Cada categoria é uma cor fixa. Theme-aware.
 */
export function AtividadeChart({ data }: { data: Semana[] }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted ? resolvedTheme === "dark" : true;
  const axisStroke = dark ? "rgba(150, 150, 168, 0.7)" : "rgba(80, 80, 100, 0.6)";
  const gridStroke = dark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.06)";
  const tooltipBg = dark ? "#13131C" : "#ffffff";
  const tooltipBorder = dark ? "#1F1F2D" : "#E2E2EA";

  const totalAtivos = data.reduce(
    (s, w) => s + w.reunioes + w.posts + w.tarefasConcluidas + w.lancamentos,
    0
  );
  const semanasComAtividade = data.filter(
    (w) => w.reunioes + w.posts + w.tarefasConcluidas + w.lancamentos > 0
  ).length;

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold">Atividade · últimos 90 dias</h3>
          </div>
          <span className="text-[10.5px] text-muted-foreground/70 font-mono">
            {semanasComAtividade}/{data.length} semanas ativas · {totalAtivos} eventos
          </span>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="semana"
              stroke={axisStroke}
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis stroke={axisStroke} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 8,
                fontSize: 11,
              }}
              labelFormatter={(l) => `Semana ${l}`}
              cursor={{ fill: "rgba(126,48,225,0.06)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: axisStroke, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
              formatter={(v: string) => LABELS[v as keyof typeof LABELS] ?? v}
            />
            <Bar dataKey="reunioes" stackId="a" fill={CORES.reunioes} radius={[2, 2, 0, 0]} />
            <Bar dataKey="posts" stackId="a" fill={CORES.posts} />
            <Bar dataKey="tarefasConcluidas" stackId="a" fill={CORES.tarefasConcluidas} />
            <Bar dataKey="lancamentos" stackId="a" fill={CORES.lancamentos} radius={[0, 0, 2, 2]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
