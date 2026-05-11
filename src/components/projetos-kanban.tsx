"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextField } from "@/components/editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { projetoSchema, type ProjetoInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { formatDate, cn } from "@/lib/utils";
import { Plus } from "lucide-react";
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

const COLUNAS: { key: ProjetoStatus; label: string }[] = [
  { key: "BRIEFING", label: "Briefing" },
  { key: "PRODUCAO", label: "Produção" },
  { key: "REVISAO", label: "Revisão" },
  { key: "APROVACAO", label: "Aprovação" },
  { key: "ENTREGUE", label: "Entregue" },
];

const PRIO_COLOR = { URGENTE: "destructive", ALTA: "warning", NORMAL: "secondary", BAIXA: "muted" } as const;

export function ProjetosKanban({
  projetos: initial, clientes,
}: { projetos: Card[]; clientes: { id: string; nome: string }[] }) {
  const [cards, setCards] = useState(initial);
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
      <div className="flex justify-end"><NovoProjeto clientes={clientes} /></div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4 -mx-8 px-8"><div className="grid grid-cols-5 gap-3 min-w-[1100px]">
          {COLUNAS.map((col) => {
            const lista = cards.filter((c) => c.status === col.key);
            return (
              <Droppable droppableId={col.key} key={col.key}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className={cn(
                      "rounded-lg border border-border bg-card/40 p-2 min-h-[400px]",
                      snap.isDraggingOver && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</span>
                      <span className="text-xs font-mono text-muted-foreground">{lista.length}</span>
                    </div>
                    <div className="space-y-2">
                      {lista.map((c, i) => (
                        <Draggable draggableId={c.id} index={i} key={c.id}>
                          {(p, s) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <Card
                                onClick={() => sheet.open(c.id)}
                                className={cn(
                                  "transition cursor-pointer hover:border-primary/40",
                                  s.isDragging && "shadow-2xl ring-2 ring-primary",
                                  sheet.id === c.id && "border-primary bg-sal-600/[0.04]"
                                )}
                              >
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
                  </div>
                )}
              </Droppable>
            );
          })}
        </div></div>
      </DragDropContext>

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
    </div>
  );
}

function NovoProjeto({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
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
    reset(); setOpen(false); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Novo projeto</Button></DialogTrigger>
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
