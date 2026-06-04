"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import type { LeadStatus, LeadPorte, Prioridade } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";
import { MoneyValue } from "@/components/money-value";
import { LeadSheet } from "@/components/sheets/lead-sheet";
import { useEntitySheet } from "@/components/entity-sheet";
import { ConverterLeadDialog } from "@/components/converter-lead-dialog";
import { MoneyInput } from "@/components/money-input";
import { ImportarLeadsDialog } from "@/components/importar-leads-dialog";
import { cn } from "@/lib/utils";
import { exportarCsv, timestampArquivo, type Coluna } from "@/lib/csv-export";
import {
  Plus,
  Search,
  CalendarClock,
  ArrowRight,
  Tag as TagIcon,
  TrendingUp,
  Upload,
  Download,
  MoreHorizontal,
  ArrowRightLeft,
  PanelRightOpen,
  Trash2,
} from "lucide-react";

export type LeadCard = {
  id: string;
  empresa: string;
  contatoNome: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
  segmento: string | null;
  porte: LeadPorte | null;
  origem: string | null;
  status: LeadStatus;
  prioridade: Prioridade;
  valorEstimadoMensal: number | null;
  duracaoEstimadaMeses: number | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  tags: string[];
  clienteId: string | null;
  clienteNome: string | null;
  convertidoEm: string | null;
  motivoPerdido: string | null;
  score: number;
  scoreManual: number | null;
  totalPropostas: number;
  updatedAt: string;
  // Score IA (vem do enrichment). Mostrado como badge separado no card.
  qualidadeIA: number | null;
  // Ordem manual dentro da coluna (drag pra priorizar — estilo Trello).
  ordem: number;
};

type Cliente = { id: string; nome: string; status: string };

const COLUNAS: { key: LeadStatus; label: string; descricao: string; cor: string }[] = [
  { key: "NOVO", label: "Novo", descricao: "Chegou agora", cor: "#9696A8" },
  { key: "QUALIFICACAO", label: "Qualificação", descricao: "Primeiro contato", cor: "#3B82F6" },
  { key: "DIAGNOSTICO", label: "Diagnóstico", descricao: "Entendendo dor", cor: "#7E30E1" },
  { key: "PROPOSTA_ENVIADA", label: "Proposta", descricao: "Aguardando retorno", cor: "#F59E0B" },
  { key: "NEGOCIACAO", label: "Negociação", descricao: "Em ajuste", cor: "#EC4899" },
  { key: "GANHO", label: "Ganho", descricao: "Fechou ✓", cor: "#10B981" },
  { key: "PERDIDO", label: "Perdido", descricao: "Não rolou", cor: "#EF4444" },
];

const PRIO_LABEL: Record<Prioridade, string> = {
  URGENTE: "urgente",
  ALTA: "alta",
  NORMAL: "normal",
  BAIXA: "baixa",
};

export function LeadsKanban({
  initial,
  clientes,
}: {
  initial: LeadCard[];
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [converter, setConverter] = useState<LeadCard | null>(null);
  // Lead pendente de confirmação de exclusão (AlertDialog improvisado em Dialog).
  const [excluindo, setExcluindo] = useState<LeadCard | null>(null);
  // Qual coluna está com o composer inline aberto (+ Adicionar lead).
  const [composerAberto, setComposerAberto] = useState<LeadStatus | null>(null);
  const sheet = useEntitySheet("lead");

  // Mantém os cards em sync se a server prop mudar (router.refresh após
  // conversão/import). Sem isso o optimistic local "congela" os dados.
  useEffect(() => {
    setCards(initial);
  }, [initial]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return cards;
    const q = busca.toLowerCase();
    return cards.filter(
      (c) =>
        c.empresa.toLowerCase().includes(q) ||
        c.contatoNome?.toLowerCase().includes(q) ||
        c.segmento?.toLowerCase().includes(q) ||
        c.origem?.toLowerCase().includes(q)
    );
  }, [cards, busca]);

  /**
   * Persiste a nova ordem de uma coluna no servidor. Recebe os ids da coluna
   * de DESTINO já na ordem final. Em falha, faz rollback via router.refresh.
   * Usado pelo drag-drop (reordenar/mover) e pelo menu "Mover para".
   */
  async function persistirOrdem(status: LeadStatus, ids: string[]) {
    const res = await fetch("/api/leads/reordenar", {
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
   * Move um lead pra outra coluna (via menu ⋯ → "Mover para"). Joga no fim
   * da coluna destino. Reaproveita o caminho especial de GANHO (abre dialog
   * de conversão em vez de persistir direto).
   */
  function moverLead(lead: LeadCard, destino: LeadStatus) {
    if (lead.status === destino) return;
    if (destino === "GANHO" && !lead.clienteId) {
      setConverter(lead);
      return;
    }
    // Vai pro fim da coluna destino. Ordem (ids) computada a partir do estado
    // atual aqui fora; o updater fica puro.
    const idsDestino = [
      ...cards.filter((c) => c.status === destino && c.id !== lead.id).map((c) => c.id),
      lead.id,
    ];
    setCards((prev) => {
      const restante = prev.filter((c) => c.id !== lead.id);
      return [...restante, { ...lead, status: destino }];
    });
    void persistirOrdem(destino, idsDestino);
  }

  /** Renomeia a empresa do lead (edição inline do título). Optimistic. */
  async function renomearLead(id: string, empresa: string) {
    const atual = cards.find((c) => c.id === id);
    if (!atual || atual.empresa === empresa) return;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, empresa } : c)));
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresa }),
    });
    if (!res.ok) {
      toast.error("Falha ao renomear");
      router.refresh();
    }
  }

  /** Exclui um lead (menu ⋯ → Excluir, com confirmação). Optimistic remove. */
  async function excluirLead(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (sheet.id === id) sheet.close();
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      router.refresh();
    } else {
      toast.success("Lead excluído");
    }
  }

  /**
   * Cria um lead via composer inline (sem modal). Optimistic: insere um card
   * temporário no fim da coluna; ao responder, troca pelo id real. Mantém o
   * composer aberto pra adicionar vários em sequência.
   */
  async function criarInline(status: LeadStatus, empresa: string) {
    const nome = empresa.trim();
    if (!nome) return;
    const tempId = `temp-${Date.now()}`;
    const naColuna = cards.filter((c) => c.status === status);
    const ordem = naColuna.length;
    const otimista: LeadCard = {
      id: tempId,
      empresa: nome,
      contatoNome: null,
      contatoEmail: null,
      contatoTelefone: null,
      segmento: null,
      porte: null,
      origem: null,
      status,
      prioridade: "NORMAL",
      valorEstimadoMensal: null,
      duracaoEstimadaMeses: null,
      proximaAcao: null,
      proximaAcaoEm: null,
      tags: [],
      clienteId: null,
      clienteNome: null,
      convertidoEm: null,
      motivoPerdido: null,
      score: 0,
      scoreManual: null,
      totalPropostas: 0,
      updatedAt: new Date().toISOString(),
      qualidadeIA: null,
      ordem,
    };
    setCards((prev) => [...prev, otimista]);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa: nome, status, prioridade: "NORMAL", ordem }),
      });
      if (!res.ok) throw new Error();
      const criado = await res.json();
      // Troca o card temporário pelo real (id/score vindos do servidor).
      setCards((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? { ...c, id: criado.id, score: criado.score ?? 0, ordem: criado.ordem ?? ordem }
            : c
        )
      );
    } catch {
      toast.error("Falha ao criar lead");
      setCards((prev) => prev.filter((c) => c.id !== tempId));
    }
  }

  function exportar() {
    // Exporta o conjunto atualmente visível (respeita busca). Colunas
    // refletem o que aparece no kanban + dados de conversão + scores
    // — exatamente o que Marcelo precisa pra trabalhar em planilha ou
    // subir como custom audience.
    const colunas: Coluna<LeadCard>[] = [
      { header: "Empresa", get: (l) => l.empresa },
      { header: "Contato", get: (l) => l.contatoNome ?? "" },
      { header: "Email", get: (l) => l.contatoEmail ?? "" },
      { header: "Telefone", get: (l) => l.contatoTelefone ?? "" },
      { header: "Segmento", get: (l) => l.segmento ?? "" },
      { header: "Porte", get: (l) => l.porte ?? "" },
      { header: "Origem", get: (l) => l.origem ?? "" },
      { header: "Status", get: (l) => COLUNAS.find((c) => c.key === l.status)?.label ?? l.status },
      { header: "Prioridade", get: (l) => l.prioridade },
      { header: "Valor estimado (mensal)", get: (l) => l.valorEstimadoMensal ?? "" },
      { header: "Duração (meses)", get: (l) => l.duracaoEstimadaMeses ?? "" },
      { header: "Score", get: (l) => l.score },
      { header: "Próxima ação", get: (l) => l.proximaAcao ?? "" },
      { header: "Próxima ação em", get: (l) => l.proximaAcaoEm ? new Date(l.proximaAcaoEm).toLocaleDateString("pt-BR") : "" },
      { header: "Tags", get: (l) => l.tags.join(", ") },
      { header: "Cliente vinculado", get: (l) => l.clienteNome ?? "" },
      { header: "Convertido em", get: (l) => l.convertidoEm ? new Date(l.convertidoEm).toLocaleDateString("pt-BR") : "" },
      { header: "Motivo perdido", get: (l) => l.motivoPerdido ?? "" },
      { header: "Total propostas", get: (l) => l.totalPropostas },
      { header: "Atualizado em", get: (l) => new Date(l.updatedAt).toLocaleString("pt-BR") },
    ];
    const sufixo = busca.trim() ? `-filtrado` : "";
    exportarCsv(`leads-sal${sufixo}-${timestampArquivo()}.csv`, filtrados, colunas);
    toast.success(`${filtrados.length} lead(s) exportado(s)`);
  }

  function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const origemStatus = r.source.droppableId as LeadStatus;
    const destinoStatus = r.destination.droppableId as LeadStatus;
    const cardId = r.draggableId;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // Sem movimento real (mesma coluna, mesma posição).
    if (origemStatus === destinoStatus && r.source.index === r.destination.index) return;

    // Movendo pra GANHO sem cliente: abre dialog de conversão (não persiste a
    // posição — a conversão é quem decide o destino). Mantém o caso especial.
    if (destinoStatus === "GANHO" && origemStatus !== "GANHO" && !card.clienteId) {
      setConverter(card);
      return;
    }

    // Optimistic reorder/move. O índice de `destination` é relativo à lista
    // FILTRADA da coluna (o que o usuário enxerga) — então montamos a nova
    // ordem visível aqui fora (a partir de `filtrados`) e reconstruímos o
    // estado de forma determinística no updater (que fica puro, sem efeitos).
    const destinoVisivel = filtrados
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

  const totalAtivos = cards.filter((c) => c.status !== "GANHO" && c.status !== "PERDIDO").length;

  if (cards.length === 0) {
    return (
      <>
        <EmptyState
          icon={TrendingUp}
          titulo="Sem leads ainda"
          descricao="Comece registrando oportunidades comerciais. Arraste entre as colunas conforme avança no pipeline. Quando fecha, converte em cliente automaticamente."
          acaoLabel="Criar primeiro lead"
          acaoIcon={Plus}
          acaoOnClick={() => setCriando(true)}
        />
        {criando && <NovoLeadDialog open={criando} onOpenChange={setCriando} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, contato, segmento..."
            className="pl-8 h-9"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {totalAtivos} ativos · {cards.length - totalAtivos} finalizados
        </span>
        <Button variant="outline" onClick={exportar} size="sm" disabled={filtrados.length === 0}>
          <Download className="h-4 w-4" /> Exportar
        </Button>
        <Button variant="outline" onClick={() => setImportando(true)} size="sm">
          <Upload className="h-4 w-4" /> Importar
        </Button>
        <Button onClick={() => setCriando(true)} size="sm">
          <Plus className="h-4 w-4" /> Novo lead
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        {/* Wrapper externo permite scroll horizontal sem vazar pra body inteiro.
            Carrossel com snap no mobile; livre no desktop. */}
        <div className="overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 snap-x snap-mandatory sm:snap-none">
          <div className="flex gap-3 sm:gap-3.5">
          {COLUNAS.map((col) => {
            const lista = filtrados.filter((c) => c.status === col.key);
            const valorTotal = lista.reduce((s, c) => s + (c.valorEstimadoMensal ?? 0), 0);

            return (
              <Droppable droppableId={col.key} key={col.key}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className={cn(
                      "group/col w-[84vw] sm:w-[280px] shrink-0 snap-start rounded-xl bg-secondary/60 p-2.5 min-h-[460px] transition-colors",
                      snap.isDraggingOver && "bg-primary/5 ring-1 ring-primary/30"
                    )}
                  >
                    <div className="px-1.5 py-1 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: col.cor }}
                        />
                        <span className="text-[12.5px] font-semibold text-foreground truncate">
                          {col.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{lista.length}</span>
                        <button
                          type="button"
                          onClick={() => setComposerAberto(col.key)}
                          className="ml-auto text-muted-foreground opacity-0 group-hover/col:opacity-100 hover:text-foreground transition leading-none text-[15px]"
                          aria-label={`Adicionar lead em ${col.label}`}
                        >
                          +
                        </button>
                      </div>
                      {valorTotal > 0 && (
                        <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                          <MoneyValue value={valorTotal} hidePrefix={false} className="text-[10px]" />
                          /mês
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {lista.map((c, i) => (
                        <Draggable draggableId={c.id} index={i} key={c.id}>
                          {(p, s) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <LeadCardItem
                                lead={c}
                                ativo={sheet.id === c.id}
                                dragging={s.isDragging}
                                onClick={() => sheet.open(c.id)}
                                onMover={moverLead}
                                onRenomear={renomearLead}
                                onExcluir={(l) => setExcluindo(l)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                      {lista.length === 0 && !snap.isDraggingOver && composerAberto !== col.key && (
                        <div className="text-center py-6 text-[10.5px] text-muted-foreground/40">
                          Arraste leads aqui
                        </div>
                      )}
                    </div>

                    {composerAberto === col.key ? (
                      <ColumnComposer
                        onSubmit={(empresa) => criarInline(col.key, empresa)}
                        onClose={() => setComposerAberto(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setComposerAberto(col.key)}
                        className="w-full text-left text-[12.5px] text-muted-foreground hover:text-foreground px-1.5 py-2 mt-1.5 rounded-lg hover:bg-secondary transition"
                      >
                        + Adicionar lead
                      </button>
                    )}
                  </div>
                )}
              </Droppable>
            );
          })}
          </div>
        </div>
      </DragDropContext>

      <LeadSheet
        leadId={sheet.id}
        open={sheet.isOpen}
        onOpenChange={(o) => {
          if (!o) sheet.close();
          if (!o) router.refresh();
        }}
        clientes={clientes}
        onConverter={(lead) => {
          sheet.close();
          setConverter(lead);
        }}
      />

      {converter && (
        <ConverterLeadDialog
          lead={converter}
          clientes={clientes}
          onClose={() => setConverter(null)}
          onConvertido={(novoCliente) => {
            setConverter(null);
            toast.success(`${novoCliente.nome} virou cliente! 🎉`, {
              description: "Movido pra coluna Ganho",
            });
            router.refresh();
            // Optimistic — marca lead local como ganho
            setCards((prev) =>
              prev.map((c) =>
                c.id === converter.id
                  ? { ...c, status: "GANHO", clienteId: novoCliente.id, clienteNome: novoCliente.nome }
                  : c
              )
            );
          }}
        />
      )}

      {/* Confirmação de exclusão. AlertDialog não existe em ui/, então usamos
          Dialog. É aberto via setExcluindo (state) a partir do menu ⋯ — que já
          fecha o DropdownMenu antes (onSelect), evitando o pointer-events lock
          do Radix. */}
      <Dialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir lead</DialogTitle>
            <DialogDescription>
              {excluindo
                ? `"${excluindo.empresa}" será removido permanentemente. Esta ação não pode ser desfeita.`
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
                if (excluindo) void excluirLead(excluindo.id);
                setExcluindo(null);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {criando && <NovoLeadDialog open={criando} onOpenChange={setCriando} />}

      {importando && (
        <ImportarLeadsDialog
          open={importando}
          onOpenChange={setImportando}
          onImported={() => router.refresh()}
        />
      )}
    </div>
  );
}

function LeadCardItem({
  lead,
  ativo,
  dragging,
  onClick,
  onMover,
  onRenomear,
  onExcluir,
}: {
  lead: LeadCard;
  ativo: boolean;
  dragging: boolean;
  onClick: () => void;
  onMover: (lead: LeadCard, destino: LeadStatus) => void;
  onRenomear: (id: string, empresa: string) => void;
  onExcluir: (lead: LeadCard) => void;
}) {
  const valor = lead.valorEstimadoMensal;
  const proxAcaoAtrasada =
    lead.proximaAcaoEm && new Date(lead.proximaAcaoEm) < new Date();
  const corStatus = COLUNAS.find((c) => c.key === lead.status)?.cor;
  // Barra de cor no topo: prioridade alta/urgente puxa atenção; senão usa a cor do status.
  const corBarra =
    lead.prioridade === "URGENTE" ? "#F43F5E" : lead.prioridade === "ALTA" ? "#F59E0B" : corStatus;

  // Edição inline do título (duplo-clique na empresa).
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(lead.empresa);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) {
      // Foca + seleciona tudo ao entrar em edição.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editando]);

  function abrirEdicao() {
    setRascunho(lead.empresa);
    setEditando(true);
  }
  function salvarEdicao() {
    const valorFinal = rascunho.trim();
    setEditando(false);
    if (valorFinal && valorFinal !== lead.empresa) {
      onRenomear(lead.id, valorFinal);
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
      {corBarra && <div className="h-1 w-full" style={{ background: corBarra }} />}
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
              className="flex-1 min-w-0 font-medium text-[13px] leading-tight bg-background border border-primary/50 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <div
              className="font-medium text-[13px] leading-tight min-w-0 truncate"
              onDoubleClick={(e) => {
                e.stopPropagation();
                abrirEdicao();
              }}
              title="Duplo-clique pra renomear"
            >
              {lead.empresa}
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {lead.qualidadeIA !== null && (
              <Badge
                variant="outline"
                className="text-[9px] uppercase px-1.5 gap-0.5 font-mono"
                style={{
                  color:
                    lead.qualidadeIA >= 75 ? "#10B981" : lead.qualidadeIA >= 50 ? "#F59E0B" : "#94A3B8",
                  borderColor:
                    (lead.qualidadeIA >= 75 ? "#10B981" : lead.qualidadeIA >= 50 ? "#F59E0B" : "#94A3B8") +
                    "55",
                }}
                title={`Score IA: ${lead.qualidadeIA}/100`}
              >
                IA {lead.qualidadeIA}
              </Badge>
            )}
            <ScoreBadge score={lead.scoreManual ?? lead.score} />
            {lead.prioridade !== "NORMAL" && lead.prioridade !== "BAIXA" && (
              <Badge variant="outline" className="text-[9px] uppercase px-1.5">
                {PRIO_LABEL[lead.prioridade]}
              </Badge>
            )}
            <CardMenu
              lead={lead}
              onAbrir={onClick}
              onMover={onMover}
              onExcluir={onExcluir}
            />
          </div>
        </div>

        {lead.contatoNome && (
          <div className="text-[11px] text-muted-foreground truncate">{lead.contatoNome}</div>
        )}

        {valor !== null && valor > 0 && (
          <div className="flex items-baseline gap-1 font-mono">
            <MoneyValue value={valor} className="text-[12.5px] font-semibold text-sal-400" />
            <span className="text-[10px] text-muted-foreground">/mês</span>
            {lead.duracaoEstimadaMeses && (
              <span className="text-[10px] text-muted-foreground/70 ml-1">
                · {lead.duracaoEstimadaMeses}m
              </span>
            )}
          </div>
        )}

        {lead.proximaAcao && (
          <div
            className={cn(
              "flex items-start gap-1.5 text-[10.5px] px-2 py-1 rounded-md",
              proxAcaoAtrasada
                ? "bg-rose-500/10 text-rose-400"
                : "bg-secondary/60 text-muted-foreground"
            )}
          >
            <CalendarClock className="h-2.5 w-2.5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="truncate">{lead.proximaAcao}</div>
              {lead.proximaAcaoEm && (
                <div className="font-mono text-[9.5px] opacity-70">
                  {new Date(lead.proximaAcaoEm).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 pt-1 border-t border-border/40">
          {lead.segmento && (
            <span className="inline-flex items-center gap-0.5 truncate">
              <TagIcon className="h-2 w-2" />
              {lead.segmento}
            </span>
          )}
          {lead.totalPropostas > 0 && (
            <span className="ml-auto font-mono">{lead.totalPropostas} prop.</span>
          )}
        </div>

        {/* Cliente vinculado (quando GANHO) */}
        {lead.clienteId && lead.clienteNome && (
          <Link
            href={`/clientes/${lead.clienteId}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10.5px] text-emerald-400 hover:underline"
          >
            <ArrowRight className="h-2.5 w-2.5" />
            cliente: {lead.clienteNome}
          </Link>
        )}

        {/* Motivo perdido */}
        {lead.status === "PERDIDO" && lead.motivoPerdido && (
          <div className="text-[10px] text-muted-foreground/70 italic line-clamp-2 pt-1 border-t border-border/40">
            "{lead.motivoPerdido}"
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Menu de ações rápidas (⋯) no canto do card. Só aparece no hover.
 *
 * Dois cuidados críticos:
 *  1. O card inteiro é drag handle (dragHandleProps no wrapper) e tem onClick
 *     (abre sheet). O trigger e o conteúdo precisam de stopPropagation em
 *     pointerDown/click pra NÃO iniciar drag nem abrir o sheet.
 *  2. Ações que abrem um Dialog (Excluir) — ou que mexem em estado durante o
 *     fechamento do menu — são adiadas pra `onCloseAutoFocus` via um ref, igual
 *     ao quick-create-button. Senão o Radix deixa pointer-events:none preso no
 *     body e trava a página. Por consistência, TODAS as ações usam o ref.
 */
function CardMenu({
  lead,
  onAbrir,
  onMover,
  onExcluir,
}: {
  lead: LeadCard;
  onAbrir: () => void;
  onMover: (lead: LeadCard, destino: LeadStatus) => void;
  onExcluir: (lead: LeadCard) => void;
}) {
  const pendente = useRef<(() => void) | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Ações do lead"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 group-hover/card:opacity-100 hover:bg-secondary hover:text-foreground transition data-[state=open]:opacity-100 data-[state=open]:bg-secondary"
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
                disabled={col.key === lead.status}
                onSelect={() => (pendente.current = () => onMover(lead, col.key))}
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
          onSelect={() => (pendente.current = () => onExcluir(lead))}
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Composer inline pra criar lead direto na coluna (estilo Trello), sem modal.
 * Enter cria e MANTÉM aberto + foco (adiciona vários em sequência). Esc ou blur
 * (clicando fora) fecha. Usa Textarea pra permitir nomes longos confortáveis,
 * mas Enter cria (Shift+Enter quebra linha, raramente usado em nome de empresa).
 */
function ColumnComposer({
  onSubmit,
  onClose,
}: {
  onSubmit: (empresa: string) => void;
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
        placeholder="Nome da empresa…"
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

/**
 * Badge compacto do lead score. Cor conforme classe (alto/médio/baixo).
 * Mostra o número grande pra Marcelo rapidamente saber quais leads são
 * "mais quentes" no kanban.
 */
function ScoreBadge({ score }: { score: number }) {
  const classe = score >= 70 ? "alto" : score >= 40 ? "medio" : "baixo";
  const cor =
    classe === "alto" ? "#10B981" : classe === "medio" ? "#F59E0B" : "#9696A8";
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: `${cor}22`, color: cor }}
      title={`Lead score: ${score}/100 (${classe})`}
    >
      {score}
    </span>
  );
}

function NovoLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [origem, setOrigem] = useState("");
  const [valorMensal, setValorMensal] = useState<number | null>(null);
  const [prioridade, setPrioridade] = useState<Prioridade>("NORMAL");
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!empresa.trim()) {
      toast.error("Empresa obrigatória");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa: empresa.trim(),
          contatoNome: contatoNome.trim() || null,
          contatoEmail: contatoEmail.trim() || null,
          contatoTelefone: contatoTelefone.trim() || null,
          origem: origem.trim() || null,
          valorEstimadoMensal: valorMensal,
          prioridade,
          status: "NOVO",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao criar");
      }
      toast.success("Lead criado");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Captura rápida — você refina os detalhes depois clicando no card.
          </p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Empresa*</Label>
            <Input autoFocus value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Pizzaria do João" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contato</Label>
              <Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} placeholder="João Silva" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={contatoTelefone} onChange={(e) => setContatoTelefone(e.target.value)} placeholder="(51) 9..." />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email</Label>
              <Input type="email" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} placeholder="contato@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Indicação, Google, Evento..." />
            </div>
            <div className="space-y-1.5">
              <Label>Valor estimado/mês</Label>
              <MoneyInput value={valorMensal} onChange={setValorMensal} placeholder="3.500" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? "Criando..." : "Criar e abrir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
