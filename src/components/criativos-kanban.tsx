"use client";
/**
 * Kanban de criativos de tráfego pago. 7 colunas seguindo o ciclo:
 * RASCUNHO → EM_APROVACAO → APROVADO/RECUSADO → NO_AR → PAUSADO/ENCERRADO.
 *
 * Drag-drop usa /api/criativos/:id/mover (endpoint dedicado pra status,
 * pra não exigir o schema completo do criativo no PATCH em cada drop).
 */
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { criativoSchema, type CriativoInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";
import { Plus, Image as ImageIcon, MessageSquare } from "lucide-react";
import { CriativoSheet } from "@/components/sheets/criativo-sheet";
import { useEntitySheet } from "@/components/entity-sheet";

type CriativoStatus =
  | "RASCUNHO"
  | "EM_APROVACAO"
  | "APROVADO"
  | "RECUSADO"
  | "NO_AR"
  | "PAUSADO"
  | "ENCERRADO";

type Plataforma = "META_ADS" | "GOOGLE_ADS" | "TIKTOK_ADS" | "YOUTUBE_ADS" | "LINKEDIN_ADS";

type CriativoCard = {
  id: string;
  titulo: string;
  status: CriativoStatus;
  plataforma: Plataforma;
  formato: string;
  clienteNome: string;
  orcamento: number | null;
  inicio: string | null;
  fim: string | null;
  totalArquivos: number;
  totalComentarios: number;
};

const COLUNAS: { key: CriativoStatus; label: string; cor: string }[] = [
  { key: "RASCUNHO", label: "Rascunho", cor: "#9696A8" },
  { key: "EM_APROVACAO", label: "Em aprovação", cor: "#F59E0B" },
  { key: "APROVADO", label: "Aprovado", cor: "#10B981" },
  { key: "RECUSADO", label: "Recusado", cor: "#EF4444" },
  { key: "NO_AR", label: "No ar", cor: "#7E30E1" },
  { key: "PAUSADO", label: "Pausado", cor: "#3B82F6" },
  { key: "ENCERRADO", label: "Encerrado", cor: "#6B7280" },
];

const PLATAFORMA_BADGE: Record<Plataforma, string> = {
  META_ADS: "Meta",
  GOOGLE_ADS: "Google",
  TIKTOK_ADS: "TikTok",
  YOUTUBE_ADS: "YouTube",
  LINKEDIN_ADS: "LinkedIn",
};

export function CriativosKanban({
  criativos: initial,
  clientes,
}: {
  criativos: CriativoCard[];
  clientes: { id: string; nome: string }[];
}) {
  const [cards, setCards] = useState(initial);
  const router = useRouter();
  const sheet = useEntitySheet("criativo");

  async function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const novoStatus = r.destination.droppableId as CriativoStatus;
    const cardId = r.draggableId;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.status === novoStatus) return;
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: novoStatus } : c)));
    const res = await fetch(`/api/criativos/${cardId}/mover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    if (!res.ok) {
      toast.error("Erro ao mover");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NovoCriativo clientes={clientes} />
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="grid grid-cols-7 gap-3 min-w-[1400px]">
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
                        <span
                          className="text-xs font-semibold uppercase tracking-wider"
                          style={{ color: col.cor }}
                        >
                          {col.label}
                        </span>
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
                                    <div className="font-medium text-sm leading-snug">{c.titulo}</div>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Badge variant="outline" className="text-[10px]">
                                        {PLATAFORMA_BADGE[c.plataforma]}
                                      </Badge>
                                      <Badge variant="outline" className="text-[10px]">
                                        {c.formato.replace(/_/g, " ").toLowerCase()}
                                      </Badge>
                                    </div>
                                    <div className="text-[10.5px] text-muted-foreground truncate">{c.clienteNome}</div>
                                    <div className="flex items-center justify-between text-[10.5px] text-muted-foreground/70">
                                      <span className="flex items-center gap-2">
                                        {c.totalArquivos > 0 && (
                                          <span className="flex items-center gap-0.5">
                                            <ImageIcon className="h-3 w-3" /> {c.totalArquivos}
                                          </span>
                                        )}
                                        {c.totalComentarios > 0 && (
                                          <span className="flex items-center gap-0.5">
                                            <MessageSquare className="h-3 w-3" /> {c.totalComentarios}
                                          </span>
                                        )}
                                      </span>
                                      <span className="font-mono">
                                        {c.inicio ? formatDate(c.inicio) : c.orcamento ? `R$ ${c.orcamento}` : "—"}
                                      </span>
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
          </div>
        </div>
      </DragDropContext>

      <CriativoSheet
        criativoId={sheet.id}
        open={sheet.isOpen}
        onOpenChange={(o) => {
          if (!o) {
            sheet.close();
            router.refresh();
          }
        }}
        clientes={clientes}
      />
    </div>
  );
}

function NovoCriativo({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<CriativoInput>({
    resolver: zodResolver(criativoSchema),
    defaultValues: {
      status: "RASCUNHO",
      plataforma: "META_ADS",
      formato: "POST_IMAGEM",
    },
  });

  async function onSubmit(values: CriativoInput) {
    const res = await fetch("/api/criativos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? "Erro ao criar");
      return;
    }
    toast.success("Criativo criado");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Novo criativo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo criativo de anúncio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título*</Label>
            <Input
              {...register("titulo")}
              placeholder='Ex: "Vídeo Black Friday — Versão A"'
            />
            {errors.titulo && <p className="text-[10.5px] text-destructive">{errors.titulo.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente*</Label>
              <Select onValueChange={(v) => setValue("clienteId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clienteId && <p className="text-[10.5px] text-destructive">{errors.clienteId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Plataforma</Label>
              <Select
                value={watch("plataforma")}
                onValueChange={(v) => setValue("plataforma", v as CriativoInput["plataforma"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="META_ADS">Meta Ads</SelectItem>
                  <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
                  <SelectItem value="TIKTOK_ADS">TikTok Ads</SelectItem>
                  <SelectItem value="YOUTUBE_ADS">YouTube Ads</SelectItem>
                  <SelectItem value="LINKEDIN_ADS">LinkedIn Ads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select
                value={watch("formato")}
                onValueChange={(v) => setValue("formato", v as CriativoInput["formato"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST_IMAGEM">Post imagem</SelectItem>
                  <SelectItem value="POST_VIDEO">Post vídeo</SelectItem>
                  <SelectItem value="CARROSSEL">Carrossel</SelectItem>
                  <SelectItem value="COLLECTION">Collection</SelectItem>
                  <SelectItem value="STORY">Story</SelectItem>
                  <SelectItem value="REELS_AD">Reels Ad</SelectItem>
                  <SelectItem value="RESPONSIVE_DISPLAY">Display responsivo</SelectItem>
                  <SelectItem value="SEARCH_AD">Search Ad</SelectItem>
                  <SelectItem value="PERFORMANCE_MAX">Performance Max</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as CriativoInput["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                  <SelectItem value="EM_APROVACAO">Em aprovação</SelectItem>
                  <SelectItem value="APROVADO">Aprovado</SelectItem>
                  <SelectItem value="RECUSADO">Recusado</SelectItem>
                  <SelectItem value="NO_AR">No ar</SelectItem>
                  <SelectItem value="PAUSADO">Pausado</SelectItem>
                  <SelectItem value="ENCERRADO">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
