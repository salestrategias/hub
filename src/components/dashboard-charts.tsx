"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useHideValues } from "@/components/hide-values-provider";

const COLORS = [
  "#7E30E1",
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#EF4444",
  "#F97316",
];

/**
 * Charts financeiros do dashboard. Theme-aware (cores de tooltip/grid/axis
 * mudam entre dark e light) + respeita toggle de ocultar valores.
 */
export function DashboardCharts({
  receitaMensal,
  receitaPorCliente,
}: {
  receitaMensal: { mes: string; receita: number }[];
  receitaPorCliente: { name: string; value: number }[];
}) {
  const { resolvedTheme } = useTheme();
  const { hidden } = useHideValues();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted ? resolvedTheme === "dark" : true;
  const axisStroke = dark ? "rgba(150, 150, 168, 0.7)" : "rgba(80, 80, 100, 0.6)";
  const gridStroke = dark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.06)";
  const tooltipBg = dark ? "#13131C" : "#ffffff";
  const tooltipBorder = dark ? "#1F1F2D" : "#E2E2EA";
  const tooltipText = dark ? "#E5E5EE" : "#1F1F2D";

  const fmt = (v: number) =>
    hidden
      ? "R$ ••••••"
      : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const tooltipStyle = {
    background: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: 8,
    color: tooltipText,
    fontSize: 12,
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Receita mensal · últimos 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={receitaMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="mes" stroke={axisStroke} fontSize={11} />
              <YAxis
                stroke={axisStroke}
                fontSize={11}
                tickFormatter={(v) => (hidden ? "•••" : `R$${(v / 1000).toFixed(0)}k`)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(126,48,225,0.06)" }}
                formatter={(v: number) => fmt(v)}
              />
              <Bar dataKey="receita" fill="#7E30E1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Receita por cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={receitaPorCliente}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={95}
                paddingAngle={2}
              >
                {receitaPorCliente.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => fmt(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: axisStroke }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
