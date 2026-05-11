"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import type { LeadStatus, LeadPorte, Prioridade } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
  Phone,
  Mail,
  CalendarClock,
  ArrowRight,
  Tag as TagIcon,
  TrendingUp,
  Upload,
  Download,
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

const PRIO_BORDER: Record<Prioridade, string> = {
  URGENTE: "border-l-rose-500",
  ALTA: "border-l-amber-500",
  NORMAL: "border-l-transparent",
  BAIXA: "border-l-transparent",
};

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
  const sheet = useEntitySheet("lead");

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

  async function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const novoStatus = r.destination.droppableId as LeadStatus;
    const cardId = r.draggableId;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.status === novoStatus) return;

    // Se está movendo pra GANHO, abre dialog de conversão em vez de só mover
    if (novoStatus === "GANHO" && !card.clienteId) {
      setConverter(card);
      return;
    }

    // Optimistic update
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: novoStatus } : c)));

    const res = await fetch(`/api/leads/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    if (!res.ok) {
      toast.error("Falha ao mover");
      router.refresh();
    }
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
        {/* Wrapper externo permite scroll horizontal sem vazar pra body inteiro */}
        <div className="overflow-x-auto pb-4 -mx-8 px-8">
          <div className="grid grid-cols-7 gap-3 min-w-[1400px]">
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
                      "rounded-lg border border-border bg-card/40 p-2 min-h-[460px] transition-colors",
                      snap.isDraggingOver && "bg-primary/5 border-primary/30"
                    )}
                  >
                    <div className="px-2 py-1.5 mb-2 sticky top-0 bg-card/40 backdrop-blur-sm rounded">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ background: col.cor }}
                          />
                          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                            {col.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground/70">{lista.length}</span>
                      </div>
                      {valorTotal > 0 && (
                        <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                          <MoneyValue value={valorTotal} hidePrefix={false} className="text-[10px]" />
                          /mês
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {lista.map((c, i) => (
                        <Draggable draggableId={c.id} index={i} key={c.id}>
                          {(p, s) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <LeadCardItem
                                lead={c}
                                ativo={sheet.id === c.id}
                                dragging={s.isDragging}
                                onClick={() => sheet.open(c.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                      {lista.length === 0 && !snap.isDraggingOver && (
                        <div className="text-center py-6 text-[10.5px] text-muted-foreground/40">
                          Arraste leads aqui
                        </div>
                      )}
                    </div>
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
}: {
  lead: LeadCard;
  ativo: boolean;
  dragging: boolean;
  onClick: () => void;
}) {
  const valor = lead.valorEstimadoMensal;
  const proxAcaoAtrasada =
    lead.proximaAcaoEm && new Date(lead.proximaAcaoEm) < new Date();

  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition cursor-pointer border-l-2 hover:border-primary/40",
        PRIO_BORDER[lead.prioridade],
        dragging && "shadow-2xl ring-2 ring-primary rotate-1",
        ativo && "border-primary bg-sal-600/[0.04]"
      )}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-[13px] leading-tight min-w-0 truncate">
            {lead.empresa}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ScoreBadge score={lead.scoreManual ?? lead.score} />
            {lead.prioridade !== "NORMAL" && lead.prioridade !== "BAIXA" && (
              <Badge variant="outline" className="text-[9px] uppercase px-1.5">
                {PRIO_LABEL[lead.prioridade]}
              </Badge>
            )}
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
