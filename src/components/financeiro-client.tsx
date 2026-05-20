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
import { Plus, Trash2, Wallet, Download, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { exportarCsv, timestampArquivo, type Coluna } from "@/lib/csv-export";

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

const PERIODO_LABEL: Record<"mes" | "trimestre" | "ano" | "tudo", string> = {
  mes: "mês",
  trimestre: "3m",
  ano: "ano",
  tudo: "tudo",
};

// Categorias sugeridas no dropdown do NovoLancamento. Texto livre ainda
// é aceito — basta digitar e teclar Enter (option "outro" foca o input).
const CATEGORIAS_DESPESA = [
  "Anúncios",
  "Salários",
  "Pró-labore",
  "Software",
  "Impostos",
  "Aluguel",
  "Serviços (freelas)",
  "Marketing",
  "Equipamentos",
  "Educação",
  "Outros",
];
const CATEGORIAS_RECEITA = [
  "Mensalidade",
  "Projeto pontual",
  "Comissão",
  "Reembolso",
  "Outros",
];

export function FinanceiroClient({
  lancamentos, clientes, mrr,
}: { lancamentos: Lanc[]; clientes: { id: string; nome: string }[]; mrr: number }) {
  const [tab, setTab] = useState<"PJ" | "PF">("PJ");
  const [periodo, setPeriodo] = useState<"mes" | "trimestre" | "ano" | "tudo">("mes");
  const router = useRouter();
  const [processandoFaturamento, setProcessandoFaturamento] = useState(false);

  async function gerarFaturamento() {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const ano = hoje.getFullYear();
    if (!confirm(`Gerar mensalidade de ${mes}/${ano} pra todos clientes ATIVO com valor de contrato > 0?\n\nClientes já faturados nesse mês são pulados automaticamente.`)) return;
    setProcessandoFaturamento(true);
    try {
      const res = await fetch("/api/financeiro/processar-faturamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao gerar faturamento");
        return;
      }
      if (data.criados > 0) {
        toast.success(`${data.criados} mensalidade(s) gerada(s) · ${data.jaExistiam} já existia(m)`);
        router.refresh();
      } else if (data.jaExistiam > 0) {
        toast.success(`Mês já estava completo — ${data.jaExistiam} mensalidade(s) presente(s)`);
      } else {
        toast.error("Nenhuma mensalidade gerada — confira se há clientes ATIVO com valor > 0");
      }
    } finally {
      setProcessandoFaturamento(false);
    }
  }

  // Janela do filtro de período aplicado em toda a tela
  const inicioPeriodo = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (periodo === "mes") {
      d.setDate(1);
      return d;
    }
    if (periodo === "trimestre") {
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    if (periodo === "ano") {
      d.setMonth(0);
      d.setDate(1);
      return d;
    }
    return new Date(0); // "tudo"
  }, [periodo]);

  // Tab (PJ/PF) sempre aplicado; período aplicado se != "tudo"
  const filtradosEntidade = useMemo(() => lancamentos.filter((l) => l.entidade === tab), [lancamentos, tab]);
  const filtrados = useMemo(
    () => filtradosEntidade.filter((l) => new Date(l.data) >= inicioPeriodo),
    [filtradosEntidade, inicioPeriodo]
  );

  const receitaMes = filtrados.filter((l) => l.tipo === "RECEITA").reduce((s, l) => s + l.valor, 0);
  const despesaMes = filtrados.filter((l) => l.tipo === "DESPESA").reduce((s, l) => s + l.valor, 0);
  const lucro = receitaMes - despesaMes;
  const projecao3 = lucro * 3;
  // % do faturamento gasto em despesas — sinal de margem operacional.
  // Quanto menor, mais lucrativo. >100% = no vermelho.
  const percDespesas = receitaMes > 0 ? (despesaMes / receitaMes) * 100 : 0;

  function exportar() {
    // Extrato no estilo bancário: data, descrição, categoria, cliente,
    // tipo, valor com sinal (+ receita / − despesa), flag de recorrente
    // + SALDO ACUMULADO (running SUM ordenada por data ASC).
    //
    // Pre-processa pra calcular saldo acumulado em ordem cronológica:
    // do mais antigo pro mais recente. CSV final mantém a ordem original
    // (mais recente primeiro) mas o saldo já reflete o running total.
    const ordenadoAsc = [...filtrados].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
    );
    const saldoAcumulado = new Map<string, number>();
    let running = 0;
    for (const l of ordenadoAsc) {
      running += l.tipo === "RECEITA" ? l.valor : -l.valor;
      saldoAcumulado.set(l.id, running);
    }

    const colunas: Coluna<Lanc>[] = [
      { header: "Data", get: (l) => new Date(l.data).toLocaleDateString("pt-BR") },
      { header: "Descrição", get: (l) => l.descricao },
      { header: "Categoria", get: (l) => l.categoria ?? "" },
      { header: "Cliente", get: (l) => l.clienteNome ?? "" },
      { header: "Tipo", get: (l) => (l.tipo === "RECEITA" ? "Receita" : "Despesa") },
      {
        header: "Valor (R$)",
        get: (l) => {
          const sinal = l.tipo === "RECEITA" ? 1 : -1;
          return (sinal * l.valor).toFixed(2).replace(".", ",");
        },
      },
      {
        header: "Saldo acumulado (R$)",
        get: (l) => (saldoAcumulado.get(l.id) ?? 0).toFixed(2).replace(".", ","),
      },
      { header: "Recorrente", get: (l) => (l.recorrente ? "Sim" : "Não") },
      { header: "Entidade", get: (l) => l.entidade },
    ];
    const sufixoPeriodo = periodo === "tudo" ? "tudo" : periodo;
    const filename = `extrato-${tab.toLowerCase()}-${sufixoPeriodo}-${timestampArquivo()}.csv`;
    exportarCsv(filename, filtrados, colunas);
    toast.success(`${filtrados.length} lançamento(s) exportado(s)`);
  }

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
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês atual</SelectItem>
                <SelectItem value="trimestre">Últimos 3 meses</SelectItem>
                <SelectItem value="ano">Ano atual</SelectItem>
                <SelectItem value="tudo">Tudo</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={gerarFaturamento} disabled={processandoFaturamento} title="Cria a mensalidade do mês corrente pra todos clientes ATIVO. Idempotente — clientes já faturados são pulados.">
              <RefreshCw className={`h-4 w-4 ${processandoFaturamento ? "animate-spin" : ""}`} />
              {processandoFaturamento ? "Gerando..." : "Gerar faturamento"}
            </Button>
            <Button variant="outline" onClick={exportar} disabled={filtrados.length === 0}>
              <Download className="h-4 w-4" /> Exportar extrato
            </Button>
            <NovoLancamento clientes={clientes} entidade={tab} />
          </div>
        </div>

        <TabsContent value={tab} className="space-y-4">
          {/* KPIs respeitam o filtro de período selecionado */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Kpi label="MRR (contratos)" value={formatBRL(mrr)} />
            <Kpi label={`Receita (${PERIODO_LABEL[periodo]})`} value={formatBRL(receitaMes)} />
            <Kpi label={`Despesa (${PERIODO_LABEL[periodo]})`} value={formatBRL(despesaMes)} />
            <Kpi
              label="Lucro / projeção 3m"
              value={formatBRL(lucro)}
              hint={`Projeção: ${formatBRL(projecao3)}`}
              accent={lucro >= 0 ? "good" : "bad"}
            />
            <Kpi
              label="% despesas / receita"
              value={receitaMes > 0 ? `${percDespesas.toFixed(0)}%` : "—"}
              hint={
                receitaMes === 0
                  ? "Sem receita no período"
                  : percDespesas < 60
                    ? "Margem saudável"
                    : percDespesas < 90
                      ? "Margem apertada"
                      : "Atenção: pouco lucro"
              }
              accent={receitaMes === 0 ? undefined : percDespesas < 60 ? "good" : percDespesas < 90 ? undefined : "bad"}
            />
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
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={watch("categoria") ?? ""}
                onValueChange={(v) => setValue("categoria", v === "_custom" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Escolha..." /></SelectTrigger>
                <SelectContent>
                  {(watch("tipo") === "RECEITA" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="_custom">+ Personalizada (digite abaixo)</SelectItem>
                </SelectContent>
              </Select>
              {watch("categoria") === "" && (
                <Input
                  {...register("categoria")}
                  placeholder="Personalizada"
                  className="mt-1.5"
                />
              )}
            </div>
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
