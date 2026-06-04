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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
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
import { SeloEnviadoCliente, BadgeRevisao, type RevisaoEstado } from "@/components/revisao-conteudo";
import { Inbox } from "lucide-react";

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
  origem: "SAL" | "CLIENTE";
  revisao: RevisaoEstado;
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
  const [soPendentes, setSoPendentes] = useState(false);
  const [criando, setCriando] = useState(false);
  const router = useRouter();
  const sheet = useEntitySheet("criativo");

  // Fila de revisão = submetido pelo cliente + ainda pendente.
  const pendentesRevisao = cards.filter((c) => c.origem === "CLIENTE" && c.revisao === "PENDENTE");
  const visiveis = soPendentes ? pendentesRevisao : cards;

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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant={soPendentes ? "default" : "outline"}
          size="sm"
          onClick={() => setSoPendentes((v) => !v)}
          disabled={pendentesRevisao.length === 0 && !soPendentes}
        >
          <Inbox className="h-3.5 w-3.5" />
          Pendentes de revisão
          {pendentesRevisao.length > 0 && (
            <Badge variant="outline" className="ml-1 text-[10px] border-amber-500/40 text-amber-500">
              {pendentesRevisao.length}
            </Badge>
          )}
        </Button>
        <Button onClick={() => setCriando(true)}><Plus className="h-4 w-4" /> Novo criativo</Button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 snap-x snap-mandatory sm:snap-none">
          <div className="flex gap-3 sm:gap-3.5">
            {COLUNAS.map((col) => {
              const lista = visiveis.filter((c) => c.status === col.key);
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
                                    <div className="font-medium text-sm leading-snug">{c.titulo}</div>
                                    {c.origem === "CLIENTE" && (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <SeloEnviadoCliente />
                                        <BadgeRevisao revisao={c.revisao} />
                                      </div>
                                    )}
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
                      <button
                        type="button"
                        onClick={() => setCriando(true)}
                        className="w-full text-left text-[12.5px] text-muted-foreground hover:text-foreground px-1.5 py-2 mt-1.5 rounded-lg hover:bg-secondary transition"
                      >
                        + Adicionar criativo
                      </button>
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

      <NovoCriativo clientes={clientes} open={criando} onOpenChange={setCriando} />
    </div>
  );
}

function NovoCriativo({
  clientes,
  open,
  onOpenChange,
}: {
  clientes: { id: string; nome: string }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
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
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
