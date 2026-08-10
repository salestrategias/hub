"use client";
/**
 * Financeiro da EMPRESA (PJ) — reformado em 10/08/2026.
 *
 * Decisões (Marcelo):
 *  - Finanças pessoais (PF) saíram da interface. Dados PF permanecem no
 *    banco; o server component já filtra entidade=PJ antes de enviar.
 *  - Tela inteira restrita a ADMIN (página redireciona + APIs requireAdmin).
 *
 * Estrutura:
 *  1. KPIs do período (MRR, receita, despesa, lucro, % margem)
 *  2. Chart receita × despesa (6 meses)
 *  3. Onde o dinheiro vai (despesas por categoria) × De onde vem
 *     (receita por cliente) — computados client-side do extrato
 *  4. Extrato com filtro de categoria, edição inline e exclusão
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2, Wallet, Download, RefreshCw, Pencil, ShieldCheck } from "lucide-react";
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
  const [periodo, setPeriodo] = useState<"mes" | "trimestre" | "ano" | "tudo">("mes");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [editando, setEditando] = useState<Lanc | null>(null);
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

  // Server já entrega só PJ; aqui aplica período + categoria
  const noPeriodo = useMemo(
    () => lancamentos.filter((l) => new Date(l.data) >= inicioPeriodo),
    [lancamentos, inicioPeriodo]
  );
  const filtrados = useMemo(
    () => (filtroCategoria ? noPeriodo.filter((l) => (l.categoria ?? "Sem categoria") === filtroCategoria) : noPeriodo),
    [noPeriodo, filtroCategoria]
  );

  // Categorias presentes no período (pro filtro do extrato)
  const categoriasPresentes = useMemo(() => {
    const set = new Set<string>();
    for (const l of noPeriodo) set.add(l.categoria ?? "Sem categoria");
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [noPeriodo]);

  // KPIs sempre do período inteiro (não afetados pelo filtro de categoria —
  // categoria filtra só o extrato, senão os números "mentem")
  const receitaMes = noPeriodo.filter((l) => l.tipo === "RECEITA").reduce((s, l) => s + l.valor, 0);
  const despesaMes = noPeriodo.filter((l) => l.tipo === "DESPESA").reduce((s, l) => s + l.valor, 0);
  const lucro = receitaMes - despesaMes;
  const projecao3 = lucro * 3;
  const percDespesas = receitaMes > 0 ? (despesaMes / receitaMes) * 100 : 0;

  // ── Onde o dinheiro vai: despesas agrupadas por categoria ──────
  const despesasPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of noPeriodo) {
      if (l.tipo !== "DESPESA") continue;
      const cat = l.categoria ?? "Sem categoria";
      mapa.set(cat, (mapa.get(cat) ?? 0) + l.valor);
    }
    return Array.from(mapa.entries())
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [noPeriodo]);

  // ── De onde o dinheiro vem: receita agrupada por cliente ───────
  const receitaPorCliente = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of noPeriodo) {
      if (l.tipo !== "RECEITA") continue;
      const nome = l.clienteNome ?? "Sem cliente vinculado";
      mapa.set(nome, (mapa.get(nome) ?? 0) + l.valor);
    }
    return Array.from(mapa.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [noPeriodo]);

  function exportar() {
    // Extrato bancário + saldo acumulado (running SUM cronológico)
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
    ];
    const sufixoPeriodo = periodo === "tudo" ? "tudo" : periodo;
    const filename = `extrato-sal-${sufixoPeriodo}-${timestampArquivo()}.csv`;
    exportarCsv(filename, filtrados, colunas);
    toast.success(`${filtrados.length} lançamento(s) exportado(s)`);
  }

  const series = useMemo(() => {
    const data: { mes: string; receita: number; despesa: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const m = d.getMonth(), y = d.getFullYear();
      const doMes = lancamentos.filter((l) => {
        const dt = new Date(l.data);
        return dt.getMonth() === m && dt.getFullYear() === y;
      });
      data.push({
        mes: MES_NOMES[m],
        receita: doMes.filter((l) => l.tipo === "RECEITA").reduce((s, l) => s + l.valor, 0),
        despesa: doMes.filter((l) => l.tipo === "DESPESA").reduce((s, l) => s + l.valor, 0),
      });
    }
    return data;
  }, [lancamentos]);

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1.5 text-[10.5px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
          <ShieldCheck className="h-3 w-3" /> Área restrita a administradores
        </Badge>
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
          <LancamentoDialog clientes={clientes} />
        </div>
      </div>

      {/* KPIs do período */}
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

      {/* Chart 6 meses (sempre janela fixa — contexto histórico) */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Receita vs Despesa (últimos 6 meses)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,135,0.15)" />
              <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }} formatter={(v: number) => formatBRL(v)} />
              <Legend />
              <Bar dataKey="receita" fill="#10B981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="despesa" fill="#EF4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Onde vai × de onde vem */}
      <div className="grid md:grid-cols-2 gap-4">
        <RankingCard
          titulo={`Onde o dinheiro vai (${PERIODO_LABEL[periodo]})`}
          vazio="Nenhuma despesa no período"
          cor="#EF4444"
          total={despesaMes}
          linhas={despesasPorCategoria.map((d) => ({ label: d.categoria, valor: d.valor }))}
          onClickLinha={(label) => setFiltroCategoria(filtroCategoria === label ? "" : label)}
          ativa={filtroCategoria}
        />
        <RankingCard
          titulo={`De onde o dinheiro vem (${PERIODO_LABEL[periodo]})`}
          vazio="Nenhuma receita no período"
          cor="#10B981"
          total={receitaMes}
          linhas={receitaPorCliente.map((r) => ({ label: r.nome, valor: r.valor }))}
        />
      </div>

      {/* Extrato */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm">
            Extrato {filtroCategoria && <span className="text-muted-foreground font-normal">· {filtroCategoria}</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filtroCategoria || "__todas"} onValueChange={(v) => setFiltroCategoria(v === "__todas" ? "" : v)}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas">Todas as categorias</SelectItem>
                {categoriasPresentes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
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
                <Row key={l.id} l={l} onEditar={() => setEditando(l)} />
              ))}
              {filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={Wallet}
                      titulo="Nenhum lançamento"
                      descricao="Adicione receitas e despesas da empresa para acompanhar MRR, lucro e projeção."
                      variante="compact"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de edição — keyed pra resetar o form a cada lançamento */}
      {editando && (
        <LancamentoDialog
          key={editando.id}
          clientes={clientes}
          editar={editando}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function Row({ l, onEditar }: { l: Lanc; onEditar: () => void }) {
  const router = useRouter();
  async function excluir() {
    if (!confirm("Excluir lançamento?")) return;
    await fetch(`/api/lancamentos/${l.id}`, { method: "DELETE" });
    toast.success("Excluído");
    router.refresh();
  }
  return (
    <TableRow className="cursor-pointer" onClick={onEditar}>
      <TableCell className="font-mono text-xs">{formatDate(l.data)}</TableCell>
      <TableCell className="font-medium">{l.descricao}{l.recorrente && <span className="ml-1 text-[10px] text-muted-foreground">(recorrente)</span>}</TableCell>
      <TableCell className="text-muted-foreground">{l.clienteNome ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{l.categoria ?? "—"}</TableCell>
      <TableCell><Badge variant={l.tipo === "RECEITA" ? "success" : "destructive"}>{l.tipo.toLowerCase()}</Badge></TableCell>
      <TableCell className={`text-right font-mono ${l.tipo === "RECEITA" ? "text-emerald-500" : "text-rose-500"}`}>
        {l.tipo === "RECEITA" ? "+" : "-"}{formatBRL(l.valor)}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="ghost" onClick={onEditar} title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={excluir} title="Excluir">
          <Trash2 className="h-4 w-4" />
        </Button>
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

/**
 * Ranking com barras horizontais (top 6). Usado pra "despesas por categoria"
 * (clicável — filtra o extrato) e "receita por cliente".
 */
function RankingCard({
  titulo,
  vazio,
  cor,
  total,
  linhas,
  onClickLinha,
  ativa,
}: {
  titulo: string;
  vazio: string;
  cor: string;
  total: number;
  linhas: { label: string; valor: number }[];
  onClickLinha?: (label: string) => void;
  ativa?: string;
}) {
  const max = linhas.length > 0 ? linhas[0].valor : 0;
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-2.5">
        {linhas.length === 0 && (
          <p className="text-xs text-muted-foreground italic">{vazio}</p>
        )}
        {linhas.map((linha) => {
          const perc = total > 0 ? (linha.valor / total) * 100 : 0;
          const larg = max > 0 ? (linha.valor / max) * 100 : 0;
          const selecionada = ativa === linha.label;
          const Comp = onClickLinha ? "button" : "div";
          return (
            <Comp
              key={linha.label}
              {...(onClickLinha
                ? { type: "button" as const, onClick: () => onClickLinha(linha.label), title: "Clique pra filtrar o extrato" }
                : {})}
              className={`w-full text-left group ${onClickLinha ? "cursor-pointer" : ""} ${selecionada ? "opacity-100" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
                <span className={`truncate ${selecionada ? "font-bold text-primary" : "font-medium"}`}>{linha.label}</span>
                <span className="font-mono text-muted-foreground shrink-0">
                  {formatBRL(linha.valor)} <span className="opacity-60">({perc.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${larg}%`, background: cor, opacity: selecionada ? 1 : 0.75 }}
                />
              </div>
            </Comp>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Dialog de lançamento — criação (sem `editar`) ou edição (com `editar`).
 * Edição usa PATCH /api/lancamentos/[id]; entidade sempre PJ.
 */
function LancamentoDialog({
  clientes,
  editar,
  onFechar,
}: {
  clientes: { id: string; nome: string }[];
  editar?: Lanc;
  onFechar?: () => void;
}) {
  const [open, setOpen] = useState(Boolean(editar));
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<LancamentoInput>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: editar
      ? {
          descricao: editar.descricao,
          valor: editar.valor,
          tipo: editar.tipo,
          categoria: editar.categoria ?? undefined,
          data: new Date(editar.data),
          clienteId: editar.clienteId,
          recorrente: editar.recorrente,
          entidade: "PJ",
        }
      : { tipo: "RECEITA", entidade: "PJ", recorrente: false, data: new Date() },
  });

  function fechar(o: boolean) {
    setOpen(o);
    if (!o) onFechar?.();
  }

  async function onSubmit(values: LancamentoInput) {
    const res = editar
      ? await fetch(`/api/lancamentos/${editar.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, entidade: "PJ" }),
        })
      : await fetch("/api/lancamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, entidade: "PJ" }),
        });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Erro ao salvar");
      return;
    }
    toast.success(editar ? "Lançamento atualizado" : "Lançamento criado");
    reset();
    fechar(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      {!editar && (
        <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Novo lançamento</Button></DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editar ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>
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
              <Select
                value={watch("clienteId") ?? "none"}
                onValueChange={(v) => setValue("clienteId", v === "none" ? null : v)}
              >
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
            <Button type="submit" disabled={isSubmitting}>{editar ? "Salvar alterações" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
