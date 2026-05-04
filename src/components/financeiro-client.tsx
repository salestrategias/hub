"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { lancamentoSchema, type LancamentoInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { formatBRL, formatDate, MES_NOMES } from "@/lib/utils";
import { Plus, Trash2, Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type Lanc = {
  id: string;
  descricao: string;
  valor: number;
  tipo: "RECEITA" | "DESPESA";
  categoria: string | null;
  data: string;
  recorrente: boolean;
  entidade: "PJ" | "PF";
  clienteId: string | null;
  clienteNome: string | null;
};

export function FinanceiroClient({
  lancamentos, clientes, mrr,
}: { lancamentos: Lanc[]; clientes: { id: string; nome: string }[]; mrr: number }) {
  const [tab, setTab] = useState<"PJ" | "PF">("PJ");

  const filtrados = useMemo(() => lancamentos.filter((l) => l.entidade === tab), [lancamentos, tab]);

  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

  const receitaMes = filtrados.filter((l) => l.tipo === "RECEITA" && new Date(l.data) >= inicioMes).reduce((s, l) => s + l.valor, 0);
  const despesaMes = filtrados.filter((l) => l.tipo === "DESPESA" && new Date(l.data) >= inicioMes).reduce((s, l) => s + l.valor, 0);
  const lucro = receitaMes - despesaMes;
  const projecao3 = lucro * 3;

  const series = useMemo(() => {
    const data: { mes: string; receita: number; despesa: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const m = d.getMonth(), y = d.getFullYear();
      const r = filtrados.filter((l) => l.tipo === "RECEITA" && new Date(l.data).getMonth() === m && new Date(l.data).getFullYear() === y).reduce((s, l) => s + l.valor, 0);
      const dsp = filtrados.filter((l) => l.tipo === "DESPESA" && new Date(l.data).getMonth() === m && new Date(l.data).getFullYear() === y).reduce((s, l) => s + l.valor, 0);
      data.push({ mes: MES_NOMES[m], receita: r, despesa: dsp });
    }
    return data;
  }, [filtrados]);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "PJ" | "PF")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="PJ">Pessoa Jurídica</TabsTrigger>
            <TabsTrigger value="PF">Pessoa Física</TabsTrigger>
          </TabsList>
          <NovoLancamento clientes={clientes} entidade={tab} />
        </div>

        <TabsContent value={tab} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="MRR (contratos)" value={formatBRL(mrr)} />
            <Kpi label="Receita do mês" value={formatBRL(receitaMes)} />
            <Kpi label="Despesa do mês" value={formatBRL(despesaMes)} />
            <Kpi label="Lucro / projeção 3m" value={formatBRL(lucro)} hint={`Projeção: ${formatBRL(projecao3)}`} accent={lucro >= 0 ? "good" : "bad"} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Receita vs Despesa (últimos 6 meses)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#13131C", border: "1px solid #1F1F2D" }} formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="receita" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesa" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((l) => (
                    <Row key={l.id} l={l} />
                  ))}
                  {filtrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState
                          icon={Wallet}
                          titulo={`Nenhum lançamento ${tab}`}
                          descricao={`Adicione receitas e despesas da entidade ${tab} para acompanhar MRR, lucro e projeção.`}
                          variante="compact"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ l }: { l: Lanc }) {
  const router = useRouter();
  async function excluir() {
    if (!confirm("Excluir lançamento?")) return;
    await fetch(`/api/lancamentos/${l.id}`, { method: "DELETE" });
    toast.success("Excluído");
    router.refresh();
  }
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{formatDate(l.data)}</TableCell>
      <TableCell className="font-medium">{l.descricao}{l.recorrente && <span className="ml-1 text-[10px] text-muted-foreground">(recorrente)</span>}</TableCell>
      <TableCell className="text-muted-foreground">{l.clienteNome ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{l.categoria ?? "—"}</TableCell>
      <TableCell><Badge variant={l.tipo === "RECEITA" ? "success" : "destructive"}>{l.tipo.toLowerCase()}</Badge></TableCell>
      <TableCell className={`text-right font-mono ${l.tipo === "RECEITA" ? "text-emerald-500" : "text-rose-500"}`}>
        {l.tipo === "RECEITA" ? "+" : "-"}{formatBRL(l.valor)}
      </TableCell>
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" onClick={excluir}><Trash2 className="h-4 w-4" /></Button>
      </TableCell>
    </TableRow>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-mono ${accent === "good" ? "text-emerald-500" : accent === "bad" ? "text-rose-500" : ""}`}>{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function NovoLancamento({ clientes, entidade }: { clientes: { id: string; nome: string }[]; entidade: "PJ" | "PF" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<LancamentoInput>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      tipo: "RECEITA", entidade, recorrente: false,
      data: new Date(),
    },
  });

  async function onSubmit(values: LancamentoInput) {
    const res = await fetch("/api/lancamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, entidade }),
    });
    if (!res.ok) { toast.error("Erro"); return; }
    toast.success("Lançamento criado");
    reset(); setOpen(false); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Novo lançamento</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lançamento ({entidade})</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5"><Label>Descrição*</Label><Input {...register("descricao")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Valor (R$)*</Label><Input type="number" step="0.01" {...register("valor")} /></div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as "RECEITA" | "DESPESA")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEITA">Receita</SelectItem>
                  <SelectItem value="DESPESA">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Categoria</Label><Input {...register("categoria")} placeholder="Ex: Anúncios, Salários" /></div>
            <div className="space-y-1.5"><Label>Data*</Label><Input type="date" {...register("data")} /></div>
            <div className="space-y-1.5 col-span-2">
              <Label>Cliente (opcional)</Label>
              <Select onValueChange={(v) => setValue("clienteId", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm col-span-2">
              <input type="checkbox" {...register("recorrente")} className="accent-primary" /> Recorrente
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
