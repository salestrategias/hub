"use client";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { campanhaPagaSchema, type CampanhaPagaInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Download, Trash2 } from "lucide-react";
import { formatBRL, formatNumber, MES_NOMES } from "@/lib/utils";

type Camp = CampanhaPagaInput & { id: string };
const PLATS: CampanhaPagaInput["plataforma"][] = ["META_ADS", "GOOGLE_ADS", "TIKTOK_ADS", "YOUTUBE_ADS", "LINKEDIN_ADS"];
const COLORS = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6"];

export function TrafegoClient({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [clienteId, setClienteId] = useState("");
  const [camps, setCamps] = useState<Camp[]>([]);

  useEffect(() => {
    setClienteId(localStorage.getItem("salhub.report.clienteId") ?? "");
  }, []);

  async function recarregar() {
    if (!clienteId) return;
    const r = await fetch(`/api/relatorios/trafego?clienteId=${clienteId}`);
    setCamps((await r.json()) ?? []);
  }
  useEffect(() => { recarregar(); /* eslint-disable-next-line */ }, [clienteId]);

  const totais = useMemo(() => {
    const inv = camps.reduce((s, c) => s + Number(c.investimento), 0);
    const conv = camps.reduce((s, c) => s + c.conversoes, 0);
    const roas = camps.length ? camps.reduce((s, c) => s + c.roas, 0) / camps.length : 0;
    const cpa = camps.length ? camps.reduce((s, c) => s + Number(c.cpa), 0) / camps.length : 0;
    return { inv, conv, roas, cpa };
  }, [camps]);

  const roasPorPlatMes = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    camps.forEach((c) => {
      const key = `${MES_NOMES[c.mes - 1]}/${String(c.ano).slice(-2)}`;
      const o = map.get(key) ?? { mes: key };
      o[c.plataforma] = ((Number(o[c.plataforma]) || 0) + c.roas) / 1; // simple aggr
      map.set(key, o);
    });
    return Array.from(map.values());
  }, [camps]);

  const investPorPlat = useMemo(() => {
    const map = new Map<string, number>();
    camps.forEach((c) => map.set(c.plataforma, (map.get(c.plataforma) ?? 0) + Number(c.investimento)));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [camps]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex items-center gap-3 flex-wrap">
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" disabled={!clienteId} onClick={() => window.open(`/api/relatorios/trafego/pdf?clienteId=${clienteId}`, "_blank")} className="ml-auto">
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </CardContent></Card>

      {!clienteId && <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Selecione um cliente.</CardContent></Card>}

      {clienteId && (
        <>
          <NovaCampanha clienteId={clienteId} onSaved={recarregar} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Investimento total" value={formatBRL(totais.inv)} />
            <Kpi label="Conversões totais" value={formatNumber(totais.conv)} />
            <Kpi label="ROAS médio" value={totais.roas.toFixed(2)} />
            <Kpi label="CPA médio" value={formatBRL(totais.cpa)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-sm">ROAS por plataforma / mês</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={roasPorPlatMes}>
                  <CartesianGrid stroke="rgba(255,255,255,.05)" />
                  <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D" }} />
                  <Legend />
                  {PLATS.map((p, i) => <Bar key={p} dataKey={p} fill={COLORS[i]} radius={[4, 4, 0, 0]} />)}
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Distribuição de investimento</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={investPorPlat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95}>
                    {investPorPlat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D" }} formatter={(v: number) => formatBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent></Card>
          </div>

          <Card><CardHeader><CardTitle className="text-sm">Campanhas</CardTitle></CardHeader><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Mês</TableHead><TableHead>Plataforma</TableHead><TableHead>Nome</TableHead>
                <TableHead className="text-right">Invest.</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead>ROAS</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {camps.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{MES_NOMES[c.mes - 1]}/{c.ano}</TableCell>
                    <TableCell><Badge variant="outline">{c.plataforma}</Badge></TableCell>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(c.investimento))}</TableCell>
                    <TableCell className="text-right font-mono">{c.conversoes}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(c.cpa))}</TableCell>
                    <TableCell><Badge variant={c.roas > 3 ? "success" : c.roas > 1.5 ? "warning" : "destructive"}>{c.roas.toFixed(2)}x</Badge></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm("Excluir?")) return;
                        await fetch(`/api/relatorios/trafego/${c.id}`, { method: "DELETE" });
                        recarregar();
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {camps.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem campanhas cadastradas.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-mono">{value}</div>
    </CardContent></Card>
  );
}

function NovaCampanha({ clienteId, onSaved }: { clienteId: string; onSaved: () => void }) {
  const hoje = new Date();
  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<CampanhaPagaInput>({
    resolver: zodResolver(campanhaPagaSchema),
    defaultValues: { clienteId, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, plataforma: "META_ADS" },
  });
  useEffect(() => { reset({ clienteId, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, plataforma: "META_ADS" }); }, [clienteId, reset]);

  async function onSubmit(values: CampanhaPagaInput) {
    const res = await fetch("/api/relatorios/trafego", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, clienteId }),
    });
    if (!res.ok) { toast.error("Erro"); return; }
    toast.success("Campanha salva"); onSaved();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Nova campanha</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <F label="Ano"><Input type="number" {...register("ano")} /></F>
          <F label="Mês"><Input type="number" min={1} max={12} {...register("mes")} /></F>
          <F label="Plataforma">
            <Select value={watch("plataforma")} onValueChange={(v) => setValue("plataforma", v as CampanhaPagaInput["plataforma"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PLATS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Nome da campanha" className="col-span-2 md:col-span-3"><Input {...register("nome")} /></F>
          <F label="Investimento"><Input type="number" step="0.01" {...register("investimento")} /></F>
          <F label="Impressões"><Input type="number" {...register("impressoes")} /></F>
          <F label="Cliques"><Input type="number" {...register("cliques")} /></F>
          <F label="Conversões"><Input type="number" {...register("conversoes")} /></F>
          <F label="CPA"><Input type="number" step="0.01" {...register("cpa")} /></F>
          <F label="ROAS"><Input type="number" step="0.01" {...register("roas")} /></F>
          <F label="CPM"><Input type="number" step="0.01" {...register("cpm")} /></F>
          <F label="CPC médio"><Input type="number" step="0.01" {...register("cpcMedio")} /></F>
          <div className="col-span-full">
            <Label className="text-xs">Insights e próximas ações</Label>
            <Textarea rows={2} {...register("insights")} />
          </div>
          <div className="col-span-full text-right"><Button type="submit" disabled={isSubmitting}>Salvar</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1 ${className ?? ""}`}><Label className="text-xs">{label}</Label>{children}</div>;
}
