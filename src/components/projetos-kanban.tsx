"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RichTextField } from "@/components/editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
import { projetoSchema, type ProjetoInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { formatDate, cn } from "@/lib/utils";
import {
  Plus,
  KanbanSquare,
  Table2,
  MoreHorizontal,
  ArrowRightLeft,
  PanelRightOpen,
  Trash2,
} from "lucide-react";
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
  // Ordem manual dentro da coluna (drag pra priorizar — estilo Trello).
  ordem: number;
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
  // Projeto pendente de confirmação de exclusão (AlertDialog improvisado em Dialog).
  const [excluindo, setExcluindo] = useState<Card | null>(null);
  // Qual coluna está com o composer inline aberto (+ Adicionar projeto).
  const [composerAberto, setComposerAberto] = useState<ProjetoStatus | null>(null);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("projetos-view") : null;
    if (saved === "board" || saved === "tabela") setView(saved);
  }, []);
  // Mantém os cards em sync se a server prop mudar (router.refresh após criar
  // no modal / fechar sheet). Sem isso o optimistic local "congela" os dados.
  useEffect(() => {
    setCards(initial);
  }, [initial]);
  function trocarView(v: "board" | "tabela") {
    setView(v);
    try { localStorage.setItem("projetos-view", v); } catch {}
  }
  const router = useRouter();
  const sheet = useEntitySheet("projeto");

  /**
   * Persiste a nova ordem de uma coluna no servidor. Recebe os ids da coluna
   * de DESTINO já na ordem final. Em falha, faz rollback via router.refresh.
   * Usado pelo drag-drop (reordenar/mover) e pelo menu "Mover para".
   */
  async function persistirOrdem(status: ProjetoStatus, ids: string[]) {
    const res = await fetch("/api/projetos/reordenar", {
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
   * Move um projeto pra outra coluna (via menu ⋯ → "Mover para"). Joga no fim
   * da coluna destino. Optimistic + persiste.
   */
  function moverProjeto(card: Card, destino: ProjetoStatus) {
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

  /** Renomeia o projeto (edição inline do título). Optimistic. */
  async function renomearProjeto(id: string, nome: string) {
    const atual = cards.find((c) => c.id === id);
    if (!atual || atual.nome === nome) return;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, nome } : c)));
    const res = await fetch(`/api/projetos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!res.ok) {
      toast.error("Falha ao renomear");
      router.refresh();
    }
  }

  /** Exclui um projeto (menu ⋯ → Excluir, com confirmação). Optimistic remove. */
  async function excluirProjeto(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (sheet.id === id) sheet.close();
    const res = await fetch(`/api/projetos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      router.refresh();
    } else {
      toast.success("Projeto excluído");
    }
  }

  /**
   * Cria um projeto via composer inline (sem modal). Optimistic: insere um card
   * temporário no fim da coluna; ao responder, troca pelo id real. Mantém o
   * composer aberto pra adicionar vários em sequência.
   */
  async function criarInline(status: ProjetoStatus, nomeRaw: string) {
    const nome = nomeRaw.trim();
    if (!nome) return;
    const tempId = `temp-${Date.now()}`;
    const ordem = cards.filter((c) => c.status === status).length;
    const otimista: Card = {
      id: tempId,
      nome,
      status,
      prioridade: "NORMAL",
      dataEntrega: null,
      clienteNome: null,
      totalTarefas: 0,
      ordem,
    };
    setCards((prev) => [...prev, otimista]);

    try {
      const res = await fetch("/api/projetos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, status, prioridade: "NORMAL" }),
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
      toast.error("Falha ao criar projeto");
      setCards((prev) => prev.filter((c) => c.id !== tempId));
    }
  }

  function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const origemStatus = r.source.droppableId as ProjetoStatus;
    const destinoStatus = r.destination.droppableId as ProjetoStatus;
    const cardId = r.draggableId;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // Sem movimento real (mesma coluna, mesma posição).
    if (origemStatus === destinoStatus && r.source.index === r.destination.index) return;

    // Optimistic reorder/move. O índice de `destination` é relativo à lista da
    // coluna (o que o usuário enxerga) — montamos a nova ordem visível aqui fora
    // e reconstruímos o estado de forma determinística no updater (puro).
    const destinoVisivel = cards
      .filter((c) => c.status === destinoStatus && c.id !== cardId)
      .map((c) => c.id);
    destinoVisivel.splice(r.destination.index, 0, cardId);
    const posDestino = new Map(destinoVisivel.map((id, i) => [id, i]));

    setCards((prev) => {
      const atualizados = prev.map((c) =>
        c.id === cardId ? { ...c, status: destinoStatus } : c
      );
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
                      <button
                        type="button"
                        onClick={() => setComposerAberto(col.key)}
                        className="ml-auto text-muted-foreground opacity-0 group-hover/col:opacity-100 hover:text-foreground transition leading-none text-[15px]"
                        aria-label={`Adicionar projeto em ${col.label}`}
                      >
                        +
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {lista.map((c, i) => (
                        <Draggable draggableId={c.id} index={i} key={c.id}>
                          {(p, s) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <ProjetoCardItem
                                card={c}
                                cor={col.cor}
                                ativo={sheet.id === c.id}
                                dragging={s.isDragging}
                                onClick={() => sheet.open(c.id)}
                                onMover={moverProjeto}
                                onRenomear={renomearProjeto}
                                onExcluir={(card) => setExcluindo(card)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                      {lista.length === 0 && !snap.isDraggingOver && composerAberto !== col.key && (
                        <div className="text-center py-6 text-[10.5px] text-muted-foreground/40">
                          Arraste projetos aqui
                        </div>
                      )}
                    </div>
                    {composerAberto === col.key ? (
                      <ColumnComposer
                        onSubmit={(nome) => criarInline(col.key, nome)}
                        onClose={() => setComposerAberto(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setComposerAberto(col.key)}
                        className="w-full text-left text-[12.5px] text-muted-foreground hover:text-foreground px-1.5 py-2 mt-1.5 rounded-lg hover:bg-secondary transition"
                      >
                        + Adicionar projeto
                      </button>
                    )}
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

      {/* Confirmação de exclusão. AlertDialog não existe em ui/, então usamos
          Dialog. É aberto via setExcluindo (state) a partir do menu ⋯ — que já
          fecha o DropdownMenu antes (onSelect), evitando o pointer-events lock
          do Radix. */}
      <Dialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir projeto</DialogTitle>
            <DialogDescription>
              {excluindo
                ? `"${excluindo.nome}" será removido permanentemente. Esta ação não pode ser desfeita.`
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
                if (excluindo) void excluirProjeto(excluindo.id);
                setExcluindo(null);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function ProjetoCardItem({
  card,
  cor,
  ativo,
  dragging,
  onClick,
  onMover,
  onRenomear,
  onExcluir,
}: {
  card: Card;
  cor: string;
  ativo: boolean;
  dragging: boolean;
  onClick: () => void;
  onMover: (card: Card, destino: ProjetoStatus) => void;
  onRenomear: (id: string, nome: string) => void;
  onExcluir: (card: Card) => void;
}) {
  // Barra de cor no topo: prioridade alta/urgente puxa atenção; senão usa a cor da coluna.
  const corBarra =
    card.prioridade === "URGENTE" ? "#F43F5E" : card.prioridade === "ALTA" ? "#F59E0B" : cor;

  // Edição inline do título (duplo-clique no nome).
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(card.nome);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editando]);

  function abrirEdicao() {
    setRascunho(card.nome);
    setEditando(true);
  }
  function salvarEdicao() {
    const valorFinal = rascunho.trim();
    setEditando(false);
    if (valorFinal && valorFinal !== card.nome) {
      onRenomear(card.id, valorFinal);
    }
  }

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group/card overflow-hidden cursor-grab shadow-sm transition hover:shadow-md hover:-translate-y-px hover:border-primary/40 active:cursor-grabbing",
        dragging && "shadow-2xl ring-2 ring-primary rotate-1",
        ativo && "border-primary bg-sal-600/[0.04]"
      )}
    >
      <div className="h-1 w-full" style={{ background: corBarra }} />
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
              className="flex-1 min-w-0 font-medium text-sm leading-tight bg-background border border-primary/50 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <div
              className="font-medium text-sm leading-tight min-w-0 flex-1"
              onDoubleClick={(e) => {
                e.stopPropagation();
                abrirEdicao();
              }}
              title="Duplo-clique pra renomear"
            >
              {card.nome}
            </div>
          )}
          <CardMenu
            card={card}
            onAbrir={onClick}
            onMover={onMover}
            onExcluir={onExcluir}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant={PRIO_COLOR[card.prioridade]}>{card.prioridade.toLowerCase()}</Badge>
          {card.clienteNome && <Badge variant="outline">{card.clienteNome}</Badge>}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{card.totalTarefas} tarefa(s)</span>
          <span className="font-mono">{card.dataEntrega ? formatDate(card.dataEntrega) : "—"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Menu de ações rápidas (⋯) no canto do card. Só aparece no hover.
 *
 * Dois cuidados críticos (igual leads-kanban):
 *  1. O card inteiro é drag handle (dragHandleProps no wrapper) e tem onClick
 *     (abre sheet). O trigger e o conteúdo precisam de stopPropagation em
 *     pointerDown/click pra NÃO iniciar drag nem abrir o sheet.
 *  2. Ações que abrem um Dialog (Excluir) — ou que mexem em estado durante o
 *     fechamento do menu — são adiadas pra `onCloseAutoFocus` via um ref. Senão
 *     o Radix deixa pointer-events:none preso no body e trava a página. Por
 *     consistência, TODAS as ações usam o ref.
 */
function CardMenu({
  card,
  onAbrir,
  onMover,
  onExcluir,
}: {
  card: Card;
  onAbrir: () => void;
  onMover: (card: Card, destino: ProjetoStatus) => void;
  onExcluir: (card: Card) => void;
}) {
  const pendente = useRef<(() => void) | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Ações do projeto"
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
                disabled={col.key === card.status}
                onSelect={() => (pendente.current = () => onMover(card, col.key))}
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
          onSelect={() => (pendente.current = () => onExcluir(card))}
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Composer inline pra criar projeto direto na coluna (estilo Trello), sem modal.
 * Enter cria e MANTÉM aberto + foco (adiciona vários em sequência). Esc ou blur
 * com campo vazio fecha. Usa Textarea pra permitir nomes longos confortáveis
 * (Shift+Enter quebra linha; Enter cria).
 */
function ColumnComposer({
  onSubmit,
  onClose,
}: {
  onSubmit: (nome: string) => void;
  onClose: () => void;
}) {
  const [valor, setValor] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function submeter() {
    const nome = valor.trim();
    if (!nome) return;
    onSubmit(nome);
    setValor(""); // mantém aberto pra adicionar o próximo
    ref.current?.focus();
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <Textarea
        ref={ref}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          // Fecha ao perder foco — mas só se o campo está vazio, pra não
          // engolir texto digitado se o blur foi acidental.
          if (!valor.trim()) onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submeter();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        rows={2}
        placeholder="Nome do projeto…"
        className="min-h-0 resize-none text-[13px] bg-card"
      />
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
