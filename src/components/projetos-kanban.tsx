"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextField } from "@/components/editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { projetoSchema, type ProjetoInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { formatDate, cn } from "@/lib/utils";
import { Plus, KanbanSquare, Table2 } from "lucide-react";
import { ProjetoSheet } from "@/components/sheets/projeto-sheet";
import { useEntitySheet } from "@/components/entity-sheet";

type ProjetoStatus = "BRIEFING" | "PRODUCAO" | "REVISAO" | "APROVACAO" | "ENTREGUE";
type Card = {
  id: string;
  nome: string;
  status: ProjetoStatus;
  prioridade: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA";
  dataEntrega: string | null;
  clienteNome: string | null;
  totalTarefas: number;
};

const COLUNAS: { key: ProjetoStatus; label: string; cor: string }[] = [
  { key: "BRIEFING", label: "Briefing", cor: "#9696A8" },
  { key: "PRODUCAO", label: "Produção", cor: "#3B82F6" },
  { key: "REVISAO", label: "Revisão", cor: "#F59E0B" },
  { key: "APROVACAO", label: "Aprovação", cor: "#7E30E1" },
  { key: "ENTREGUE", label: "Entregue", cor: "#10B981" },
];

const PRIO_COLOR = { URGENTE: "destructive", ALTA: "warning", NORMAL: "secondary", BAIXA: "muted" } as const;

const STATUS_LABEL: Record<ProjetoStatus, string> = {
  BRIEFING: "Briefing",
  PRODUCAO: "Produção",
  REVISAO: "Revisão",
  APROVACAO: "Aprovação",
  ENTREGUE: "Entregue",
};

export function ProjetosKanban({
  projetos: initial, clientes,
}: { projetos: Card[]; clientes: { id: string; nome: string }[] }) {
  const [cards, setCards] = useState(initial);
  const [view, setView] = useState<"board" | "tabela">("board");
  const [criando, setCriando] = useState(false);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("projetos-view") : null;
    if (saved === "board" || saved === "tabela") setView(saved);
  }, []);
  function trocarView(v: "board" | "tabela") {
    setView(v);
    try { localStorage.setItem("projetos-view", v); } catch {}
  }
  const router = useRouter();
  const sheet = useEntitySheet("projeto");

  async function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const novoStatus = r.destination.droppableId as ProjetoStatus;
    const cardId = r.draggableId;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.status === novoStatus) return;
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: novoStatus } : c)));
    const res = await fetch(`/api/projetos/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    if (!res.ok) { toast.error("Erro ao mover"); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ViewToggle view={view} onChange={trocarView} />
        <Button onClick={() => setCriando(true)}><Plus className="h-4 w-4" /> Novo projeto</Button>
      </div>
      {view === "tabela" ? (
        <TabelaProjetos cards={cards} onOpen={(id) => sheet.open(id)} ativaId={sheet.id ?? null} />
      ) : (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 snap-x snap-mandatory sm:snap-none"><div className="flex gap-3 sm:gap-3.5">
          {COLUNAS.map((col) => {
            const lista = cards.filter((c) => c.status === col.key);
            return (
              <Droppable droppableId={col.key} key={col.key}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className={cn(
                      "group/col w-[84vw] sm:w-[280px] shrink-0 snap-start rounded-xl bg-secondary/60 p-2.5 min-h-[400px] transition-colors",
                      snap.isDraggingOver && "bg-primary/5 ring-1 ring-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-2 px-1.5 py-1 mb-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: col.cor }} />
                      <span className="text-[12.5px] font-semibold text-foreground truncate">{col.label}</span>
                      <span className="text-[11px] text-muted-foreground">{lista.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {lista.map((c, i) => (
                        <Draggable draggableId={c.id} index={i} key={c.id}>
                          {(p, s) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <Card
                                onClick={() => sheet.open(c.id)}
                                className={cn(
                                  "overflow-hidden cursor-grab shadow-sm transition hover:shadow-md hover:-translate-y-px hover:border-primary/40 active:cursor-grabbing",
                                  s.isDragging && "shadow-2xl ring-2 ring-primary",
                                  sheet.id === c.id && "border-primary bg-sal-600/[0.04]"
                                )}
                              >
                                <div className="h-1 w-full" style={{ background: col.cor }} />
                                <CardContent className="p-3 space-y-2">
                                  <div className="font-medium text-sm">{c.nome}</div>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <Badge variant={PRIO_COLOR[c.prioridade]}>{c.prioridade.toLowerCase()}</Badge>
                                    {c.clienteNome && <Badge variant="outline">{c.clienteNome}</Badge>}
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{c.totalTarefas} tarefa(s)</span>
                                    <span className="font-mono">{c.dataEntrega ? formatDate(c.dataEntrega) : "—"}</span>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCriando(true)}
                      className="w-full text-left text-[12.5px] text-muted-foreground hover:text-foreground px-1.5 py-2 mt-1.5 rounded-lg hover:bg-secondary transition"
                    >
                      + Adicionar projeto
                    </button>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div></div>
      </DragDropContext>
      )}

      <ProjetoSheet
        projetoId={sheet.id}
        open={sheet.isOpen}
        onOpenChange={(o) => {
          if (!o) sheet.close();
          // Refresh ao fechar pra que mudanças de status apareçam na coluna certa
          if (!o) router.refresh();
        }}
        clientes={clientes}
      />

      <NovoProjeto clientes={clientes} open={criando} onOpenChange={setCriando} />
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: "board" | "tabela"; onChange: (v: "board" | "tabela") => void }) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      <button
        type="button"
        onClick={() => onChange("board")}
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
          view === "board" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        title="Quadro (kanban)"
      >
        <KanbanSquare className="h-3.5 w-3.5" /> Quadro
      </button>
      <button
        type="button"
        onClick={() => onChange("tabela")}
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
          view === "tabela" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        title="Tabela"
      >
        <Table2 className="h-3.5 w-3.5" /> Tabela
      </button>
    </div>
  );
}

function TabelaProjetos({
  cards,
  onOpen,
  ativaId,
}: {
  cards: Card[];
  onOpen: (id: string) => void;
  ativaId: string | null;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Prioridade</TableHead>
              <TableHead className="hidden md:table-cell">Cliente</TableHead>
              <TableHead className="hidden lg:table-cell text-center">Tarefas</TableHead>
              <TableHead className="text-right">Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((c) => (
              <TableRow
                key={c.id}
                className={cn("cursor-pointer", ativaId === c.id && "bg-sal-600/[0.04]")}
                onClick={() => onOpen(c.id)}
              >
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell><Badge variant="outline">{STATUS_LABEL[c.status]}</Badge></TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={PRIO_COLOR[c.prioridade]}>{c.prioridade.toLowerCase()}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{c.clienteNome ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-center text-muted-foreground">{c.totalTarefas}</TableCell>
                <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                  {c.dataEntrega ? formatDate(c.dataEntrega) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum projeto ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NovoProjeto({
  clientes,
  open,
  onOpenChange,
}: {
  clientes: { id: string; nome: string }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<ProjetoInput>({
    resolver: zodResolver(projetoSchema),
    defaultValues: { prioridade: "NORMAL", status: "BRIEFING", criarPastaDrive: false },
  });

  async function onSubmit(values: ProjetoInput) {
    const res = await fetch("/api/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) { toast.error("Erro"); return; }
    toast.success("Projeto criado");
    reset(); onOpenChange(false); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5"><Label>Nome*</Label><Input {...register("nome")} /></div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <RichTextField
              value={watch("descricao") ?? ""}
              onChange={(blocks) => setValue("descricao", JSON.stringify(blocks))}
              placeholder="Escopo, briefing, deliverables..."
              minHeight="100px"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Prioridade</Label>
              <Select value={watch("prioridade")} onValueChange={(v) => setValue("prioridade", v as ProjetoInput["prioridade"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Data de entrega</Label><Input type="date" {...register("dataEntrega")} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as ProjetoInput["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRIEFING">Briefing</SelectItem>
                  <SelectItem value="PRODUCAO">Produção</SelectItem>
                  <SelectItem value="REVISAO">Revisão</SelectItem>
                  <SelectItem value="APROVACAO">Aprovação</SelectItem>
                  <SelectItem value="ENTREGUE">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("criarPastaDrive")} className="accent-primary" />
            Criar pasta no Google Drive
          </label>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
