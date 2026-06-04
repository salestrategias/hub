"use client";
/**
 * Kanban de criativos de tráfego pago. 7 colunas seguindo o ciclo:
 * RASCUNHO → EM_APROVACAO → APROVADO/RECUSADO → NO_AR → PAUSADO/ENCERRADO.
 *
 * Recursos estilo Trello (espelhados de leads-kanban.tsx):
 *  1. Add inline por coluna (ColumnComposer) — sem modal. Como o modelo
 *     Criativo exige clienteId + plataforma, o composer embute esses dois
 *     selects além do título (formato/status caem no default do servidor).
 *  2. Reordenar/mover via drag-drop — persiste em POST /api/criativos/reordenar
 *     { status, ids } (mesma coluna E entre colunas, optimistic + rollback).
 *  3. Menu hover ⋯ — Abrir / Mover para ▸ / Excluir (com confirmação). Usa o
 *     padrão `pendente` ref + onCloseAutoFocus pra não travar pointer-events.
 *  4. Edição inline do título (duplo-clique) — PATCH /api/criativos/[id] { titulo }.
 *
 * O modal "Novo criativo" continua disponível (botão do topo) pra captura
 * completa; o composer inline é só o atalho rápido.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { criativoSchema, type CriativoInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus,
  Image as ImageIcon,
  MessageSquare,
  MoreHorizontal,
  ArrowRightLeft,
  PanelRightOpen,
  Trash2,
  Inbox,
} from "lucide-react";
import { CriativoSheet } from "@/components/sheets/criativo-sheet";
import { useEntitySheet } from "@/components/entity-sheet";
import { SeloEnviadoCliente, BadgeRevisao, type RevisaoEstado } from "@/components/revisao-conteudo";

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
  // Ordem manual dentro da coluna (drag pra priorizar — estilo Trello).
  ordem: number;
};

type Cliente = { id: string; nome: string };

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

const PLATAFORMA_OPTIONS: { value: Plataforma; label: string }[] = [
  { value: "META_ADS", label: "Meta Ads" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "TIKTOK_ADS", label: "TikTok Ads" },
  { value: "YOUTUBE_ADS", label: "YouTube Ads" },
  { value: "LINKEDIN_ADS", label: "LinkedIn Ads" },
];

export function CriativosKanban({
  criativos: initial,
  clientes,
}: {
  criativos: CriativoCard[];
  clientes: Cliente[];
}) {
  const [cards, setCards] = useState(initial);
  const [soPendentes, setSoPendentes] = useState(false);
  const [criando, setCriando] = useState(false);
  // Qual coluna está com o composer inline aberto (+ Adicionar criativo).
  const [composerAberto, setComposerAberto] = useState<CriativoStatus | null>(null);
  // Criativo pendente de confirmação de exclusão (AlertDialog improvisado em Dialog).
  const [excluindo, setExcluindo] = useState<CriativoCard | null>(null);
  const router = useRouter();
  const sheet = useEntitySheet("criativo");

  // Mantém os cards em sync se a server prop mudar (router.refresh após
  // criação/edição no modal/sheet). Sem isso o optimistic local "congela".
  useEffect(() => {
    setCards(initial);
  }, [initial]);

  // Fila de revisão = submetido pelo cliente + ainda pendente.
  const pendentesRevisao = cards.filter((c) => c.origem === "CLIENTE" && c.revisao === "PENDENTE");
  const visiveis = soPendentes ? pendentesRevisao : cards;

  /**
   * Persiste a nova ordem de uma coluna no servidor. Recebe os ids da coluna
   * de DESTINO já na ordem final. Em falha, faz rollback via router.refresh.
   * Usado pelo drag-drop (reordenar/mover) e pelo menu "Mover para".
   */
  async function persistirOrdem(status: CriativoStatus, ids: string[]) {
    const res = await fetch("/api/criativos/reordenar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ids }),
    });
    if (!res.ok) {
      toast.error("Falha ao reordenar");
      router.refresh();
    }
  }

  /**
   * Move um criativo pra outra coluna (via menu ⋯ → "Mover para"). Joga no fim
   * da coluna destino. Ordem (ids) computada a partir do estado atual aqui fora;
   * o updater fica puro.
   */
  function moverCriativo(card: CriativoCard, destino: CriativoStatus) {
    if (card.status === destino) return;
    const idsDestino = [
      ...cards.filter((c) => c.status === destino && c.id !== card.id).map((c) => c.id),
      card.id,
    ];
    setCards((prev) => {
      const restante = prev.filter((c) => c.id !== card.id);
      return [...restante, { ...card, status: destino }];
    });
    void persistirOrdem(destino, idsDestino);
  }

  /** Renomeia o título do criativo (edição inline). Optimistic. */
  async function renomearCriativo(id: string, titulo: string) {
    const atual = cards.find((c) => c.id === id);
    if (!atual || atual.titulo === titulo) return;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, titulo } : c)));
    const res = await fetch(`/api/criativos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    if (!res.ok) {
      toast.error("Falha ao renomear");
      router.refresh();
    }
  }

  /** Exclui um criativo (menu ⋯ → Excluir, com confirmação). Optimistic remove. */
  async function excluirCriativo(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (sheet.id === id) sheet.close();
    const res = await fetch(`/api/criativos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      router.refresh();
    } else {
      toast.success("Criativo excluído");
    }
  }

  /**
   * Cria um criativo via composer inline (sem modal). Optimistic: insere um card
   * temporário no fim da coluna; ao responder, troca pelo id real. Mantém o
   * composer aberto pra adicionar vários em sequência.
   *
   * Diferente de leads, o modelo exige clienteId + plataforma — então o composer
   * já manda os três campos mínimos (formato/status caem no default do servidor).
   */
  async function criarInline(
    status: CriativoStatus,
    titulo: string,
    clienteId: string,
    plataforma: Plataforma
  ) {
    const nome = titulo.trim();
    if (!nome || !clienteId) return;
    const clienteNome = clientes.find((c) => c.id === clienteId)?.nome ?? "—";
    const tempId = `temp-${Date.now()}`;
    const naColuna = cards.filter((c) => c.status === status);
    const ordem = naColuna.length;
    const otimista: CriativoCard = {
      id: tempId,
      titulo: nome,
      status,
      plataforma,
      formato: "POST_IMAGEM",
      clienteNome,
      orcamento: null,
      inicio: null,
      fim: null,
      totalArquivos: 0,
      totalComentarios: 0,
      origem: "SAL",
      revisao: null,
      ordem,
    };
    setCards((prev) => [...prev, otimista]);

    try {
      const res = await fetch("/api/criativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: nome, status, clienteId, plataforma }),
      });
      if (!res.ok) throw new Error();
      const criado = await res.json();
      // Troca o card temporário pelo real (id/ordem vindos do servidor).
      setCards((prev) =>
        prev.map((c) =>
          c.id === tempId ? { ...c, id: criado.id, ordem: criado.ordem ?? ordem } : c
        )
      );
    } catch {
      toast.error("Falha ao criar criativo");
      setCards((prev) => prev.filter((c) => c.id !== tempId));
    }
  }

  function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const origemStatus = r.source.droppableId as CriativoStatus;
    const destinoStatus = r.destination.droppableId as CriativoStatus;
    const cardId = r.draggableId;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // Sem movimento real (mesma coluna, mesma posição).
    if (origemStatus === destinoStatus && r.source.index === r.destination.index) return;

    // Optimistic reorder/move. O índice de `destination` é relativo à lista
    // VISÍVEL da coluna (o que o usuário enxerga) — então montamos a nova ordem
    // visível aqui fora (a partir de `visiveis`) e reconstruímos o estado de
    // forma determinística no updater (que fica puro, sem efeitos).
    const destinoVisivel = visiveis
      .filter((c) => c.status === destinoStatus && c.id !== cardId)
      .map((c) => c.id);
    destinoVisivel.splice(r.destination.index, 0, cardId);
    const posDestino = new Map(destinoVisivel.map((id, i) => [id, i]));

    setCards((prev) => {
      // Aplica o novo status ao card movido.
      const atualizados = prev.map((c) =>
        c.id === cardId ? { ...c, status: destinoStatus } : c
      );
      // Reordena APENAS a coluna de destino conforme `destinoVisivel`; as demais
      // mantêm a ordem relativa (render filtra por coluna, então basta agrupar).
      const destino = atualizados
        .filter((c) => c.status === destinoStatus)
        .sort((a, b) => (posDestino.get(a.id) ?? 0) - (posDestino.get(b.id) ?? 0));
      const outras = atualizados.filter((c) => c.status !== destinoStatus);
      return [...outras, ...destino];
    });

    // Persiste a coluna de destino na nova ordem (cobre reorder e move).
    void persistirOrdem(destinoStatus, destinoVisivel);
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
                        {!soPendentes && (
                          <button
                            type="button"
                            onClick={() => setComposerAberto(col.key)}
                            className="ml-auto text-muted-foreground opacity-0 group-hover/col:opacity-100 hover:text-foreground transition leading-none text-[15px]"
                            aria-label={`Adicionar criativo em ${col.label}`}
                          >
                            +
                          </button>
                        )}
                      </div>
                      <div className="space-y-2.5">
                        {lista.map((c, i) => (
                          <Draggable draggableId={c.id} index={i} key={c.id}>
                            {(p, s) => (
                              <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                                <CriativoCardItem
                                  criativo={c}
                                  cor={col.cor}
                                  ativo={sheet.id === c.id}
                                  dragging={s.isDragging}
                                  onClick={() => sheet.open(c.id)}
                                  onMover={moverCriativo}
                                  onRenomear={renomearCriativo}
                                  onExcluir={(card) => setExcluindo(card)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {prov.placeholder}
                      </div>
                      {!soPendentes &&
                        (composerAberto === col.key ? (
                          <ColumnComposer
                            clientes={clientes}
                            onSubmit={(titulo, clienteId, plataforma) =>
                              criarInline(col.key, titulo, clienteId, plataforma)
                            }
                            onClose={() => setComposerAberto(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setComposerAberto(col.key)}
                            className="w-full text-left text-[12.5px] text-muted-foreground hover:text-foreground px-1.5 py-2 mt-1.5 rounded-lg hover:bg-secondary transition"
                          >
                            + Adicionar criativo
                          </button>
                        ))}
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

      {/* Confirmação de exclusão. AlertDialog não existe em ui/, então usamos
          Dialog. É aberto via setExcluindo (state) a partir do menu ⋯ — que já
          fecha o DropdownMenu antes (onCloseAutoFocus), evitando o pointer-events
          lock do Radix. */}
      <Dialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir criativo</DialogTitle>
            <DialogDescription>
              {excluindo
                ? `"${excluindo.titulo}" será removido permanentemente. Esta ação não pode ser desfeita.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (excluindo) void excluirCriativo(excluindo.id);
                setExcluindo(null);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NovoCriativo clientes={clientes} open={criando} onOpenChange={setCriando} />
    </div>
  );
}

function CriativoCardItem({
  criativo: c,
  cor,
  ativo,
  dragging,
  onClick,
  onMover,
  onRenomear,
  onExcluir,
}: {
  criativo: CriativoCard;
  cor: string;
  ativo: boolean;
  dragging: boolean;
  onClick: () => void;
  onMover: (card: CriativoCard, destino: CriativoStatus) => void;
  onRenomear: (id: string, titulo: string) => void;
  onExcluir: (card: CriativoCard) => void;
}) {
  // Edição inline do título (duplo-clique).
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(c.titulo);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editando]);

  function abrirEdicao() {
    setRascunho(c.titulo);
    setEditando(true);
  }
  function salvarEdicao() {
    const valorFinal = rascunho.trim();
    setEditando(false);
    if (valorFinal && valorFinal !== c.titulo) {
      onRenomear(c.id, valorFinal);
    }
  }

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group/card overflow-hidden cursor-grab shadow-sm transition hover:shadow-md hover:-translate-y-px hover:border-primary/40 active:cursor-grabbing",
        dragging && "shadow-2xl ring-2 ring-primary",
        ativo && "border-primary bg-sal-600/[0.04]"
      )}
    >
      <div className="h-1 w-full" style={{ background: cor }} />
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          {editando ? (
            <input
              ref={inputRef}
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onBlur={salvarEdicao}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  salvarEdicao();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditando(false);
                }
              }}
              className="flex-1 min-w-0 font-medium text-sm leading-snug bg-background border border-primary/50 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <div
              className="font-medium text-sm leading-snug min-w-0 flex-1"
              onDoubleClick={(e) => {
                e.stopPropagation();
                abrirEdicao();
              }}
              title="Duplo-clique pra renomear"
            >
              {c.titulo}
            </div>
          )}
          <CardMenu
            criativo={c}
            onAbrir={onClick}
            onMover={onMover}
            onExcluir={onExcluir}
          />
        </div>

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
  );
}

/**
 * Menu de ações rápidas (⋯) no canto do card. Só aparece no hover.
 *
 * Dois cuidados críticos (idênticos ao leads-kanban):
 *  1. O card inteiro é drag handle e tem onClick (abre sheet). O trigger e o
 *     conteúdo precisam de stopPropagation em pointerDown/click pra NÃO iniciar
 *     drag nem abrir o sheet.
 *  2. Ações que abrem um Dialog (Excluir) — ou mexem em estado durante o
 *     fechamento do menu — são adiadas pra `onCloseAutoFocus` via um ref. Senão
 *     o Radix deixa pointer-events:none preso no body e trava a página. Por
 *     consistência, TODAS as ações usam o ref.
 */
function CardMenu({
  criativo,
  onAbrir,
  onMover,
  onExcluir,
}: {
  criativo: CriativoCard;
  onAbrir: () => void;
  onMover: (card: CriativoCard, destino: CriativoStatus) => void;
  onExcluir: (card: CriativoCard) => void;
}) {
  const pendente = useRef<(() => void) | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Ações do criativo"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 group-hover/card:opacity-100 hover:bg-secondary hover:text-foreground transition data-[state=open]:opacity-100 data-[state=open]:bg-secondary"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => {
          if (!pendente.current) return;
          e.preventDefault();
          const acao = pendente.current;
          pendente.current = null;
          acao();
        }}
      >
        <DropdownMenuItem onSelect={() => (pendente.current = onAbrir)}>
          <PanelRightOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
          Abrir
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRightLeft className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Mover para
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {COLUNAS.map((col) => (
              <DropdownMenuItem
                key={col.key}
                disabled={col.key === criativo.status}
                onSelect={() => (pendente.current = () => onMover(criativo, col.key))}
              >
                <span className="h-2 w-2 rounded-full mr-2 shrink-0" style={{ background: col.cor }} />
                {col.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={() => (pendente.current = () => onExcluir(criativo))}
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Composer inline pra criar criativo direto na coluna (estilo Trello), sem modal.
 *
 * Como o modelo Criativo exige clienteId + plataforma, o composer embute esses
 * dois selects além do título (formato/status caem no default do servidor).
 * Enter no título cria E MANTÉM aberto + foco (adiciona vários em sequência),
 * preservando os selects escolhidos. Esc fecha. Blur com campo vazio fecha.
 */
function ColumnComposer({
  clientes,
  onSubmit,
  onClose,
}: {
  clientes: Cliente[];
  onSubmit: (titulo: string, clienteId: string, plataforma: Plataforma) => void;
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  // Pré-seleciona o único cliente, se houver só um — atalho comum.
  const [clienteId, setClienteId] = useState(clientes.length === 1 ? clientes[0].id : "");
  const [plataforma, setPlataforma] = useState<Plataforma>("META_ADS");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function submeter() {
    const nome = titulo.trim();
    if (!nome) return;
    if (!clienteId) {
      toast.error("Selecione um cliente");
      return;
    }
    onSubmit(nome, clienteId, plataforma);
    setTitulo(""); // mantém aberto + selects pra adicionar o próximo
    ref.current?.focus();
  }

  return (
    <div className="mt-1.5 space-y-1.5 rounded-lg bg-card p-2 shadow-sm ring-1 ring-border/60">
      <Input
        ref={ref}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submeter();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Título do criativo…"
        className="h-8 text-[13px]"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="h-8 text-[12px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={plataforma} onValueChange={(v) => setPlataforma(v as Plataforma)}>
          <SelectTrigger className="h-8 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATAFORMA_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-7" onMouseDown={(e) => e.preventDefault()} onClick={submeter}>
          Adicionar
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-muted-foreground hover:text-foreground transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function NovoCriativo({
  clientes,
  open,
  onOpenChange,
}: {
  clientes: Cliente[];
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
