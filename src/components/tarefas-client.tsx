"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tarefaSchema, type TarefaInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { formatDate, diffDias, cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { RichTextField, BlockRenderer } from "@/components/editor";
import { TarefaSheet } from "@/components/sheets/tarefa-sheet";
import { useEntitySheet } from "@/components/entity-sheet";
import { Plus, Trash2, CalendarPlus, Check, ListChecks, FilterX } from "lucide-react";

type CheckItem = { id: string; texto: string; concluido: boolean; ordem: number };
type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA";
  dataEntrega: string | null;
  concluida: boolean;
  googleEventId: string | null;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; nome: string } | null;
  clienteId: string | null;
  projetoId: string | null;
  checklist: CheckItem[];
};

const PRIO_COLOR: Record<Tarefa["prioridade"], "destructive" | "warning" | "muted" | "secondary"> = {
  URGENTE: "destructive", ALTA: "warning", NORMAL: "secondary", BAIXA: "muted",
};

export function TarefasClient({
  tarefas, clientes, projetos,
}: {
  tarefas: Tarefa[];
  clientes: { id: string; nome: string }[];
  projetos: { id: string; nome: string }[];
}) {
  const [tab, setTab] = useState("todas");
  const [filtroCliente, setFiltroCliente] = useState<string>("");
  const router = useRouter();
  const sheet = useEntitySheet("tarefa");

  const filtradas = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const fim = new Date(hoje); fim.setDate(fim.getDate() + 1);
    const fimSemana = new Date(hoje); fimSemana.setDate(fimSemana.getDate() + 7);

    return tarefas.filter((t) => {
      if (filtroCliente && t.clienteId !== filtroCliente) return false;
      if (!t.dataEntrega && tab !== "todas") return false;
      const d = t.dataEntrega ? new Date(t.dataEntrega) : null;
      if (tab === "hoje" && d && (d < hoje || d >= fim)) return false;
      if (tab === "semana" && d && (d < hoje || d >= fimSemana)) return false;
      return true;
    });
  }, [tarefas, tab, filtroCliente]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="hoje">Hoje</TabsTrigger>
            <TabsTrigger value="semana">Esta semana</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>
          <TabsContent value="hoje" />
          <TabsContent value="semana" />
          <TabsContent value="todas" />
        </Tabs>

        <div className="flex items-center gap-2">
          <Select value={filtroCliente} onValueChange={(v) => setFiltroCliente(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <NovaTarefa clientes={clientes} projetos={projetos} />
        </div>
      </div>

      <div className="space-y-3">
        {filtradas.length === 0 && (
          <Card>
            <CardContent className="p-0">
              {tarefas.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  titulo="Nenhuma tarefa criada"
                  descricao="Organize entregas, briefings, follow-ups. Use prioridades, datas e checklists para destrinchar trabalho complexo."
                />
              ) : (
                <EmptyState
                  icon={FilterX}
                  titulo="Nada nesse filtro"
                  descricao={tab === "hoje" ? "Você não tem tarefas pra hoje. Aproveita." : "Nenhuma tarefa bate com a combinação de filtros atual."}
                  variante="compact"
                />
              )}
            </CardContent>
          </Card>
        )}
        {filtradas.map((t) => (
          <TarefaCard
            key={t.id}
            tarefa={t}
            onChange={() => router.refresh()}
            onOpen={() => sheet.open(t.id)}
            ativa={sheet.id === t.id}
          />
        ))}
      </div>

      <TarefaSheet
        tarefaId={sheet.id}
        open={sheet.isOpen}
        onOpenChange={(o) => {
          if (!o) sheet.close();
          // Refresca lista quando fecha (caso tenha editado algo que altera ordem/agrupamento)
          if (!o) router.refresh();
        }}
        clientes={clientes}
        projetos={projetos}
      />
    </div>
  );
}

function TarefaCard({
  tarefa,
  onChange,
  onOpen,
  ativa,
}: {
  tarefa: Tarefa;
  onChange: () => void;
  onOpen: () => void;
  ativa: boolean;
}) {
  const atrasada = !tarefa.concluida && tarefa.dataEntrega && diffDias(tarefa.dataEntrega) < 0;

  async function toggle() {
    await fetch(`/api/tarefas/${tarefa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concluida: !tarefa.concluida }),
    });
    onChange();
  }

  async function excluir() {
    if (!confirm("Excluir essa tarefa?")) return;
    await fetch(`/api/tarefas/${tarefa.id}`, { method: "DELETE" });
    toast.success("Tarefa excluída");
    onChange();
  }

  async function agendar() {
    const res = await fetch(`/api/tarefas/${tarefa.id}/agendar`, { method: "POST" });
    if (!res.ok) { toast.error("Erro ao criar evento"); return; }
    toast.success("Evento criado na Agenda");
    onChange();
  }

  return (
    <Card
      onClick={onOpen}
      className={cn(
        "cursor-pointer transition hover:border-primary/40",
        atrasada && "border-destructive/50",
        ativa && "border-primary bg-sal-600/[0.04]"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox NÃO propaga click — toggle direto sem abrir sheet */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            className={cn(
              "mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0",
              tarefa.concluida ? "bg-primary border-primary" : "border-muted-foreground/40"
            )}
            aria-label="Concluir"
          >
            {tarefa.concluida && <Check className="h-3 w-3 text-primary-foreground" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("font-medium", tarefa.concluida && "line-through text-muted-foreground")}>{tarefa.titulo}</span>
              <Badge variant={PRIO_COLOR[tarefa.prioridade]}>{tarefa.prioridade.toLowerCase()}</Badge>
              {tarefa.cliente && <Badge variant="outline">{tarefa.cliente.nome}</Badge>}
              {tarefa.projeto && <Badge variant="outline">{tarefa.projeto.nome}</Badge>}
              {atrasada && <Badge variant="destructive">Atrasada</Badge>}
              {tarefa.googleEventId && <Badge variant="success">Agendada</Badge>}
            </div>
            {tarefa.descricao && (
              <BlockRenderer
                value={tarefa.descricao}
                maxBlocks={2}
                truncateChars={180}
                className="text-xs text-muted-foreground mt-1"
              />
            )}
            {/* Checklist click NÃO abre sheet (também tem inputs interativos dentro) */}
            <div onClick={(e) => e.stopPropagation()}>
              <Checklist tarefaId={tarefa.id} items={tarefa.checklist} onChange={onChange} />
            </div>
          </div>

          {/* Ações: NÃO propagar pra não abrir sheet ao clicar */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs font-mono text-muted-foreground mr-2">
              {tarefa.dataEntrega ? formatDate(tarefa.dataEntrega) : "—"}
            </span>
            {tarefa.dataEntrega && !tarefa.googleEventId && (
              <Button size="icon" variant="ghost" onClick={agendar} title="Adicionar à Agenda">
                <CalendarPlus className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={excluir} title="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Checklist({ tarefaId, items, onChange }: { tarefaId: string; items: CheckItem[]; onChange: () => void }) {
  const [novo, setNovo] = useState("");

  async function adicionar() {
    if (!novo.trim()) return;
    await fetch("/api/checkitems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarefaId, texto: novo }),
    });
    setNovo("");
    onChange();
  }

  async function toggleItem(item: CheckItem) {
    await fetch(`/api/checkitems/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concluido: !item.concluido }),
    });
    onChange();
  }

  async function excluir(id: string) {
    await fetch(`/api/checkitems/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="mt-3 space-y-1.5">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={it.concluido} onChange={() => toggleItem(it)} className="accent-primary" />
          <span className={cn(it.concluido && "line-through text-muted-foreground")}>{it.texto}</span>
          <button onClick={() => excluir(it.id)} className="opacity-50 hover:opacity-100" aria-label="Remover item">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Input
          placeholder="+ Adicionar item ao checklist"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

function NovaTarefa({ clientes, projetos }: { clientes: { id: string; nome: string }[]; projetos: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<TarefaInput>({
    resolver: zodResolver(tarefaSchema),
    defaultValues: { prioridade: "NORMAL", concluida: false },
  });

  async function onSubmit(values: TarefaInput) {
    const res = await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) { toast.error("Erro ao criar"); return; }
    toast.success("Tarefa criada");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Nova tarefa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título*</Label>
            <Input {...register("titulo")} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <RichTextField
              value={watch("descricao") ?? ""}
              onChange={(blocks) => setValue("descricao", JSON.stringify(blocks))}
              placeholder="Detalhes da tarefa, briefing, links..."
              minHeight="100px"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={watch("prioridade")} onValueChange={(v) => setValue("prioridade", v as TarefaInput["prioridade"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de entrega</Label>
              <Input type="datetime-local" {...register("dataEntrega")} />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select onValueChange={(v) => setValue("clienteId", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Projeto</Label>
              <Select onValueChange={(v) => setValue("projetoId", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
