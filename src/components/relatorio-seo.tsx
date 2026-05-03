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
import { metricaSeoSchema, seoKeywordSchema, type MetricaSeoInput, type SeoKeywordInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Download, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { formatNumber, MES_NOMES } from "@/lib/utils";

type Metrica = MetricaSeoInput & { id: string };
type Keyword = SeoKeywordInput & { id: string };

export function SeoClient({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [clienteId, setClienteId] = useState("");
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);

  useEffect(() => {
    setClienteId(localStorage.getItem("salhub.report.clienteId") ?? "");
  }, []);

  async function recarregar() {
    if (!clienteId) return;
    const r = await fetch(`/api/relatorios/seo?clienteId=${clienteId}`);
    const d = await r.json();
    setMetricas(d.metricas ?? []);
    setKeywords(d.keywords ?? []);
  }
  useEffect(() => { recarregar(); /* eslint-disable-next-line */ }, [clienteId]);

  const ordenadas = useMemo(() => [...metricas].sort((a, b) => a.ano - b.ano || a.mes - b.mes), [metricas]);
  const ultima = ordenadas[ordenadas.length - 1];
  const penultima = ordenadas[ordenadas.length - 2];

  // Score ponderado: posicaoMedia (menor melhor) + CTR + crescimento MoM
  const score = useMemo(() => {
    if (!ultima) return 0;
    const posScore = Math.max(0, 100 - ultima.posicaoMedia * 5); // pos 1 = 95, pos 20 = 0
    const ctrScore = Math.min(100, ultima.ctr * 1000); // 10% CTR = 100
    const growth = penultima ? ((ultima.cliquesOrganicos - penultima.cliquesOrganicos) / Math.max(1, penultima.cliquesOrganicos)) * 100 : 0;
    const growthScore = Math.max(0, Math.min(100, 50 + growth));
    return Math.round(posScore * 0.4 + ctrScore * 0.3 + growthScore * 0.3);
  }, [ultima, penultima]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-wrap gap-3 items-center">
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" disabled={!clienteId} onClick={() => window.open(`/api/relatorios/seo/pdf?clienteId=${clienteId}`, "_blank")} className="ml-auto">
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </CardContent></Card>

      {!clienteId && <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Selecione um cliente.</CardContent></Card>}

      {clienteId && (
        <>
          <FormularioMensal clienteId={clienteId} onSaved={() => recarregar()} />

          <div className="grid md:grid-cols-[1fr_280px] gap-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Comp label="Posição média" atual={ultima?.posicaoMedia} anterior={penultima?.posicaoMedia} invertido />
                <Comp label="Cliques orgânicos" atual={ultima?.cliquesOrganicos} anterior={penultima?.cliquesOrganicos} />
                <Comp label="Impressões" atual={ultima?.impressoes} anterior={penultima?.impressoes} />
                <Comp label="CTR" atual={ultima ? ultima.ctr * 100 : 0} anterior={penultima ? penultima.ctr * 100 : 0} suffix="%" />
              </div>
              <Card><CardHeader><CardTitle className="text-sm">Cliques orgânicos</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={ordenadas.map((m) => ({ mes: `${MES_NOMES[m.mes - 1]}/${String(m.ano).slice(-2)}`, c: m.cliquesOrganicos }))}>
                    <CartesianGrid stroke="rgba(255,255,255,.05)" />
                    <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D" }} />
                    <Area type="monotone" dataKey="c" stroke="#7E30E1" fill="#7E30E133" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Posição média (menor é melhor)</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={ordenadas.map((m) => ({ mes: `${MES_NOMES[m.mes - 1]}/${String(m.ano).slice(-2)}`, p: m.posicaoMedia }))}>
                    <CartesianGrid stroke="rgba(255,255,255,.05)" />
                    <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} reversed />
                    <Tooltip contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D" }} />
                    <Line type="monotone" dataKey="p" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </div>
            <ScoreGauge score={score} />
          </div>

          <KeywordsBloco clienteId={clienteId} keywords={keywords} onChange={recarregar} />

          <ObservacoesBloco clienteId={clienteId} ultima={ultima} onSaved={recarregar} />
        </>
      )}
    </div>
  );
}

function Comp({ label, atual, anterior, invertido, suffix }: { label: string; atual?: number; anterior?: number; invertido?: boolean; suffix?: string }) {
  const a = atual ?? 0; const p = anterior ?? 0;
  const delta = p > 0 ? ((a - p) / p) * 100 : 0;
  const subiu = delta >= 0;
  const bom = invertido ? !subiu : subiu;
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-mono">{a.toFixed(1).replace(/\.0$/, "")}{suffix ?? ""}</div>
      {(p > 0 || a > 0) && (
        <div className={`text-xs mt-0.5 flex items-center gap-1 ${bom ? "text-emerald-500" : "text-rose-500"}`}>
          {subiu ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}%
        </div>
      )}
    </CardContent></Card>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const cor = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <Card><CardHeader><CardTitle className="text-sm">Score SEO</CardTitle></CardHeader>
      <CardContent className="flex flex-col items-center justify-center pb-6">
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
            <circle cx="60" cy="60" r="50" stroke={cor} strokeWidth="10" fill="none"
              strokeDasharray={`${(score / 100) * 314} 314`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-mono">{score}</span>
            <span className="text-[10px] text-muted-foreground">de 100</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Ponderação: posição média (40%), CTR (30%) e crescimento MoM (30%).
        </p>
      </CardContent>
    </Card>
  );
}

function FormularioMensal({ clienteId, onSaved }: { clienteId: string; onSaved: () => void }) {
  const hoje = new Date();
  const { register, handleSubmit, reset } = useForm<MetricaSeoInput>({
    resolver: zodResolver(metricaSeoSchema),
    defaultValues: { clienteId, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 },
  });
  useEffect(() => { reset({ clienteId, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }); }, [clienteId, reset]);

  async function onSubmit(values: MetricaSeoInput) {
    const res = await fetch("/api/relatorios/seo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, clienteId }),
    });
    if (!res.ok) { toast.error("Erro"); return; }
    toast.success("Salvo"); onSaved();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Métricas mensais</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <F label="Ano"><Input type="number" {...register("ano")} /></F>
          <F label="Mês"><Input type="number" min={1} max={12} {...register("mes")} /></F>
          <F label="Posição média"><Input type="number" step="0.1" {...register("posicaoMedia")} /></F>
          <F label="Cliques"><Input type="number" {...register("cliquesOrganicos")} /></F>
          <F label="Impressões"><Input type="number" {...register("impressoes")} /></F>
          <F label="CTR (decimal)"><Input type="number" step="0.001" {...register("ctr")} placeholder="0.045" /></F>
          <F label="Keywords"><Input type="number" {...register("keywordsRanqueadas")} /></F>
          <div className="col-span-full"><Button type="submit">Salvar</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function ObservacoesBloco({ clienteId, ultima, onSaved }: { clienteId: string; ultima?: Metrica; onSaved: () => void }) {
  const [obs, setObs] = useState(ultima?.observacoes ?? "");
  useEffect(() => { setObs(ultima?.observacoes ?? ""); }, [ultima]);
  async function salvar() {
    if (!ultima) return;
    await fetch("/api/relatorios/seo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ultima, observacoes: obs }),
    });
    toast.success("Observações salvas"); onSaved();
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Observações e recomendações</CardTitle></CardHeader>
      <CardContent>
        <Textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)} disabled={!ultima} />
        <div className="mt-2 text-right"><Button size="sm" onClick={salvar} disabled={!ultima}>Salvar</Button></div>
      </CardContent>
    </Card>
  );
}

function KeywordsBloco({ clienteId, keywords, onChange }: { clienteId: string; keywords: Keyword[]; onChange: () => void }) {
  const { register, handleSubmit, reset } = useForm<SeoKeywordInput>({
    resolver: zodResolver(seoKeywordSchema), defaultValues: { clienteId },
  });
  useEffect(() => { reset({ clienteId }); }, [clienteId, reset]);

  async function adicionar(values: SeoKeywordInput) {
    await fetch("/api/relatorios/seo/keywords", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, clienteId }),
    });
    reset({ clienteId }); onChange();
  }
  async function excluir(id: string) {
    await fetch(`/api/relatorios/seo/keywords/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Keywords monitoradas</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit(adicionar)} className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Input placeholder="keyword" {...register("keyword")} className="md:col-span-2" />
          <Input type="number" placeholder="Pos atual" {...register("posicaoAtual")} />
          <Input type="number" placeholder="Pos anterior" {...register("posicaoAnterior")} />
          <Input type="number" placeholder="Volume" {...register("volumeEstimado")} />
          <Button type="submit">Adicionar</Button>
          <Input placeholder="URL ranqueada" {...register("urlRanqueada")} className="col-span-full" />
        </form>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Keyword</TableHead><TableHead>Pos. atual</TableHead><TableHead>Anterior</TableHead><TableHead>Δ</TableHead><TableHead>Volume</TableHead><TableHead>URL</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {keywords.map((k) => {
              const delta = k.posicaoAnterior - k.posicaoAtual; // positivo = subiu nas SERPs
              return (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.keyword}</TableCell>
                  <TableCell className="font-mono">{k.posicaoAtual}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{k.posicaoAnterior}</TableCell>
                  <TableCell><Badge variant={delta > 0 ? "success" : delta < 0 ? "destructive" : "muted"}>{delta > 0 ? `+${delta}` : delta}</Badge></TableCell>
                  <TableCell className="font-mono">{formatNumber(k.volumeEstimado)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{k.urlRanqueada ?? "—"}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => excluir(k.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              );
            })}
            {keywords.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Sem keywords cadastradas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
