"use client";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { metricaRedeSchema, type MetricaRedeInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { ArrowDown, ArrowUp, Download, Users, BarChart3 } from "lucide-react";
import { formatNumber, MES_NOMES } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

type Metrica = MetricaRedeInput & { id: string };
const REDES: MetricaRedeInput["rede"][] = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "YOUTUBE"];

export function RedesSociaisClient({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [clienteId, setClienteId] = useState("");
  const [rede, setRede] = useState<MetricaRedeInput["rede"]>("INSTAGRAM");
  const [metricas, setMetricas] = useState<Metrica[]>([]);

  useEffect(() => {
    setClienteId(localStorage.getItem("salhub.report.clienteId") ?? "");
  }, []);

  useEffect(() => {
    if (!clienteId) return;
    fetch(`/api/relatorios/redes?clienteId=${clienteId}`).then((r) => r.json()).then((d) => Array.isArray(d) && setMetricas(d));
  }, [clienteId]);

  const filtradas = useMemo(() => metricas.filter((m) => m.rede === rede).sort((a, b) => a.ano - b.ano || a.mes - b.mes), [metricas, rede]);
  const ultima = filtradas[filtradas.length - 1];
  const penultima = filtradas[filtradas.length - 2];

  const cliente = clientes.find((c) => c.id === clienteId);

  function exportarPdf() {
    if (!clienteId) return;
    window.open(`/api/relatorios/redes/pdf?clienteId=${clienteId}&rede=${rede}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-wrap items-center gap-3">
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={rede} onValueChange={(v) => setRede(v as MetricaRedeInput["rede"])}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>{REDES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={exportarPdf} disabled={!clienteId} className="ml-auto">
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </CardContent></Card>

      {!clienteId && (
        <EmptyState
          icon={Users}
          titulo="Selecione um cliente"
          descricao="Escolha um cliente acima pra ver as métricas mensais de cada rede social, comparativo mês a mês e exportar relatório em PDF."
        />
      )}

      {clienteId && (
        <>
          <FormularioMensal clienteId={clienteId} rede={rede} onSaved={(m) => {
            const i = metricas.findIndex((x) => x.id === m.id);
            if (i >= 0) { const cp = [...metricas]; cp[i] = m; setMetricas(cp); }
            else setMetricas([...metricas, m]);
          }} />

          {filtradas.length === 0 && (
            <EmptyState
              icon={BarChart3}
              titulo={`Sem métricas de ${rede.toLowerCase()} para ${cliente?.nome ?? "este cliente"}`}
              descricao="Preencha o formulário acima com os dados do mês corrente. Conforme você adiciona registros mensais, gráficos comparativos e histórico aparecem aqui automaticamente."
              variante="compact"
            />
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Comparativo label="Seguidores" atual={ultima?.seguidores} anterior={penultima?.seguidores} />
            <Comparativo label="Alcance" atual={ultima?.alcance} anterior={penultima?.alcance} />
            <Comparativo label="Engajamento" atual={ultima?.engajamento} anterior={penultima?.engajamento} />
            <Comparativo label="Posts" atual={ultima?.posts} anterior={penultima?.posts} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Evolução de seguidores</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={filtradas.map((m) => ({ mes: `${MES_NOMES[m.mes - 1]}/${String(m.ano).slice(-2)}`, seguidores: m.seguidores }))}>
                    <CartesianGrid stroke="rgba(255,255,255,.05)" />
                    <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D" }} />
                    <Line type="monotone" dataKey="seguidores" stroke="#7E30E1" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Engajamento por mês</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={filtradas.map((m) => ({ mes: `${MES_NOMES[m.mes - 1]}/${String(m.ano).slice(-2)}`, eng: m.engajamento }))}>
                    <CartesianGrid stroke="rgba(255,255,255,.05)" />
                    <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D" }} />
                    <Bar dataKey="eng" fill="#7E30E1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {cliente && filtradas.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Histórico — {cliente.nome} · {rede}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border">
                    <tr>{["Mês", "Seguidores", "Alcance", "Impressões", "Engajamento", "Posts", "Stories", "Reels"].map((h) => <th key={h} className="text-left py-2 px-2 text-muted-foreground">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtradas.map((m) => (
                      <tr key={m.id} className="border-b border-border/40">
                        <td className="py-1.5 px-2 font-mono">{MES_NOMES[m.mes - 1]}/{m.ano}</td>
                        <td className="px-2 font-mono">{formatNumber(m.seguidores)}</td>
                        <td className="px-2 font-mono">{formatNumber(m.alcance)}</td>
                        <td className="px-2 font-mono">{formatNumber(m.impressoes)}</td>
                        <td className="px-2 font-mono">{formatNumber(m.engajamento)}</td>
                        <td className="px-2 font-mono">{m.posts}</td>
                        <td className="px-2 font-mono">{m.stories}</td>
                        <td className="px-2 font-mono">{m.reels}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Comparativo({ label, atual, anterior }: { label: string; atual?: number; anterior?: number }) {
  const a = atual ?? 0; const p = anterior ?? 0;
  const delta = p > 0 ? ((a - p) / p) * 100 : a > 0 ? 100 : 0;
  const subiu = delta >= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-mono">{formatNumber(a)}</div>
        {(p > 0 || a > 0) && (
          <div className={`text-xs mt-0.5 flex items-center gap-1 ${subiu ? "text-emerald-500" : "text-rose-500"}`}>
            {subiu ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}% vs mês ant.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FormularioMensal({ clienteId, rede, onSaved }: {
  clienteId: string; rede: MetricaRedeInput["rede"]; onSaved: (m: Metrica) => void;
}) {
  const hoje = new Date();
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm<MetricaRedeInput>({
    resolver: zodResolver(metricaRedeSchema),
    defaultValues: { clienteId, rede, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 },
  });

  useEffect(() => { reset({ clienteId, rede, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }); }, [clienteId, rede, reset]);

  async function onSubmit(values: MetricaRedeInput) {
    const res = await fetch("/api/relatorios/redes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, clienteId, rede }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    toast.success("Métricas salvas");
    onSaved(data);
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Adicionar / atualizar métrica mensal</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Field label="Ano"><Input type="number" {...register("ano")} /></Field>
          <Field label="Mês (1-12)"><Input type="number" min={1} max={12} {...register("mes")} /></Field>
          <Field label="Seguidores"><Input type="number" {...register("seguidores")} /></Field>
          <Field label="Alcance"><Input type="number" {...register("alcance")} /></Field>
          <Field label="Impressões"><Input type="number" {...register("impressoes")} /></Field>
          <Field label="Engajamento"><Input type="number" {...register("engajamento")} /></Field>
          <Field label="Posts"><Input type="number" {...register("posts")} /></Field>
          <Field label="Stories"><Input type="number" {...register("stories")} /></Field>
          <Field label="Reels"><Input type="number" {...register("reels")} /></Field>
          <div className="flex items-end"><Button type="submit" className="w-full" disabled={isSubmitting}>Salvar</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
