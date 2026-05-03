"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatBRL } from "@/lib/utils";

const COLORS = ["#7E30E1", "#10B981", "#3B82F6", "#F59E0B", "#EC4899", "#14B8A6", "#EF4444", "#F97316"];

export function DashboardCharts({
  receitaMensal,
  receitaPorCliente,
}: {
  receitaMensal: { mes: string; receita: number }[];
  receitaPorCliente: { name: string; value: number }[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Receita mensal (últimos 12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={receitaMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D", borderRadius: 8 }}
                formatter={(v: number) => formatBRL(v)}
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
                contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D", borderRadius: 8 }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
