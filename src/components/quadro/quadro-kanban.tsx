"use client";
/**
 * Hub 2.0 F1 — Quadro kanban estilo Trello. A nova home do Hub.
 *
 * Interações (paridade Trello):
 *  - Drag-drop de cards entre/dentro de colunas (optimistic + rollback)
 *  - Drag-drop de colunas (reordenar)
 *  - "+ Adicionar cartão" inline no rodapé de cada coluna
 *  - Renomear coluna inline (click no título)
 *  - Menu ⋯ da coluna: cor, "conta como concluído", apagar
 *  - "+ Nova coluna" no fim do board
 *  - Card abre a TarefaSheet existente (URL ?tarefa=id)
 *  - Filtros: busca, cliente, tipo de demanda
 *  - Switcher de quadros (Agência + um por projeto) + criar quadro
 *
 * Estado: o board é otimista — toda mutação atualiza o estado local
 * primeiro e chama a API depois; rollback via refetch em caso de erro.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { TarefaSheet } from "@/components/sheets/tarefa-sheet";
import { useEntitySheet } from "@/components/entity-sheet";
import { cn } from "@/lib/utils";
import {
  Plus, MoreHorizontal, Search, X, Flag, CheckSquare, CalendarDays,
  Loader2, Trash2, CircleCheckBig, LayoutGrid, Sparkles, Pencil,
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────

export type TipoDemanda = "TRAFEGO" | "SEO" | "CONTEUDO" | "RELATORIO" | "ADMIN";

export type CardTarefa = {
  id: string;
  titulo: string;
  prioridade: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA";
  dataEntrega: string | null;
  concluida: boolean;
  tipoDemanda: TipoDemanda | null;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; nome: string } | null;
  checklistTotal: number;
  checklistFeitos: number;
};

export type ColunaBoard = {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  isConcluido: boolean;
  tarefas: CardTarefa[];
};

export type QuadroFull = {
  id: string;
  nome: string;
  icone: string | null;
  tipo: "AGENCIA" | "PROJETO";
  projeto: { id: string; nome: string } | null;
  colunas: ColunaBoard[];
};

export type QuadroResumo = {
  id: string;
  nome: string;
  icone: string | null;
  tipo: "AGENCIA" | "PROJETO";
  projetoId: string | null;
  totalCards: number;
};

// Hub 2.0 F3 — camadas: outras entidades aparecem como colunas virtuais
// (somente leitura) no fim do quadro Agência. Toggle persiste local.
export type CamadaPost = {
  id: string;
  titulo: string;
  status: string;
  formato: string;
  dataPublicacao: string;
  cliente: { id: string; nome: string } | null;
};

export type CamadaAction = {
  id: string;
  texto: string;
  responsavel: string | null;
  prazo: string | null;
  reuniaoId: string;
  reuniaoTitulo: string;
};

const CAMADAS_STORAGE_KEY = "sal-hub-quadro-camadas";

const TIPO_META: Record<TipoDemanda, { label: string; cor: string }> = {
  TRAFEGO: { label: "tráfego", cor: "#3B82F6" },
  SEO: { label: "seo", cor: "#10B981" },
  CONTEUDO: { label: "conteúdo", cor: "#EC4899" },
  RELATORIO: { label: "relatório", cor: "#8B5CF6" },
  ADMIN: { label: "admin", cor: "#6B7280" },
};

const CORES_COLUNA = ["#8B8B9D", "#3B82F6", "#F59E0B", "#EC4899", "#10B981", "#8B5CF6", "#EF4444"];

// ─── Componente principal ──────────────────────────────────────────

export function QuadroKanban({
  quadroInicial,
  quadros: quadrosIniciais,
  clientes,
  projetos,
  camadaPosts = [],
  camadaActions = [],
}: {
  quadroInicial: QuadroFull;
  quadros: QuadroResumo[];
  clientes: { id: string; nome: string }[];
  projetos: { id: string; nome: string }[];
  camadaPosts?: CamadaPost[];
  camadaActions?: CamadaAction[];
}) {
  const [quadro, setQuadro] = useState<QuadroFull>(quadroInicial);
  // Camadas visíveis (posts / actions) — persistidas em localStorage
  const [camadasAtivas, setCamadasAtivas] = useState<{ posts: boolean; actions: boolean }>({
    posts: false,
    actions: false,
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CAMADAS_STORAGE_KEY);
      if (raw) setCamadasAtivas(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  function toggleCamada(k: "posts" | "actions") {
    setCamadasAtivas((prev) => {
      const novo = { ...prev, [k]: !prev[k] };
      try { localStorage.setItem(CAMADAS_STORAGE_KEY, JSON.stringify(novo)); } catch { /* ignore */ }
      return novo;
    });
  }
  const [quadros, setQuadros] = useState<QuadroResumo[]>(quadrosIniciais);
  const [carregandoQuadro, setCarregandoQuadro] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoDemanda | "">("");
  const [novoQuadroOpen, setNovoQuadroOpen] = useState(false);
  const [renomearQuadroOpen, setRenomearQuadroOpen] = useState(false);
  const sheet = useEntitySheet("tarefa");

  const temFiltro = Boolean(busca.trim() || filtroCliente || filtroTipo);

  // ─── Data helpers ────────────────────────────────────────────────

  const refetch = useCallback(async (quadroId?: string) => {
    const id = quadroId ?? quadro.id;
    try {
      const res = await fetch(`/api/quadros/${id}`);
      if (!res.ok) return;
      setQuadro(await res.json());
    } catch {
      // silencioso — próximo evento tenta de novo
    }
  }, [quadro.id]);

  const refetchQuadros = useCallback(async () => {
    try {
      const res = await fetch("/api/quadros");
      if (res.ok) setQuadros(await res.json());
    } catch {
      // silencioso
    }
  }, []);

  async function trocarQuadro(id: string) {
    if (id === quadro.id) return;
    setCarregandoQuadro(true);
    try {
      const res = await fetch(`/api/quadros/${id}`);
      if (!res.ok) throw new Error();
      setQuadro(await res.json());
      try { localStorage.setItem("sal-hub-quadro-ativo", id); } catch { /* ignore */ }
    } catch {
      toast.error("Falha ao abrir o quadro");
    } finally {
      setCarregandoQuadro(false);
    }
  }

  // Reabre o último quadro usado (persistido). Roda só no mount.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("sal-hub-quadro-ativo");
      if (salvo && salvo !== quadroInicial.id && quadrosIniciais.some((q) => q.id === salvo)) {
        void trocarQuadro(salvo);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sheet fechou → tarefa pode ter mudado (título, cliente, concluída...)
  const sheetAberta = sheet.isOpen;
  const sheetAbertaAnterior = useRef(sheetAberta);
  useEffect(() => {
    if (sheetAbertaAnterior.current && !sheetAberta) void refetch();
    sheetAbertaAnterior.current = sheetAberta;
  }, [sheetAberta, refetch]);

  // ─── Drag-drop ───────────────────────────────────────────────────

  async function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const { source, destination, type, draggableId } = r;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === "COLUNA") {
      // Reordena colunas otimista
      const colunas = [...quadro.colunas];
      const [mov] = colunas.splice(source.index, 1);
      colunas.splice(destination.index, 0, mov);
      setQuadro({ ...quadro, colunas });
      const res = await fetch(`/api/quadros/${quadro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colunasOrdem: colunas.map((c) => c.id) }),
      });
      if (!res.ok) { toast.error("Falha ao reordenar"); void refetch(); }
      return;
    }

    // Card
    const colunas = quadro.colunas.map((c) => ({ ...c, tarefas: [...c.tarefas] }));
    const origem = colunas.find((c) => c.id === source.droppableId);
    const destino = colunas.find((c) => c.id === destination.droppableId);
    if (!origem || !destino) return;
    const [card] = origem.tarefas.splice(source.index, 1);
    if (!card) return;
    card.concluida = destino.isConcluido;
    destino.tarefas.splice(destination.index, 0, card);
    setQuadro({ ...quadro, colunas });

    const res = await fetch(`/api/quadros/${quadro.id}/mover-tarefa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarefaId: draggableId, colunaId: destino.id, ordem: destination.index }),
    });
    if (!res.ok) { toast.error("Falha ao mover — desfazendo"); void refetch(); }
  }

  // ─── Mutações do quadro (renomear / apagar) ──────────────────────

  async function renomearQuadro(nome: string, icone: string) {
    const nomeFinal = nome.trim();
    if (!nomeFinal) return;
    const res = await fetch(`/api/quadros/${quadro.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeFinal, icone: icone.trim() || null }),
    });
    if (!res.ok) {
      toast.error("Falha ao renomear o quadro");
      return;
    }
    // Atualiza board aberto + pill do switcher sem refetch
    setQuadro((q) => ({ ...q, nome: nomeFinal, icone: icone.trim() || null }));
    setQuadros((prev) =>
      prev.map((q) => (q.id === quadro.id ? { ...q, nome: nomeFinal, icone: icone.trim() || null } : q))
    );
    toast.success("Quadro renomeado");
    setRenomearQuadroOpen(false);
  }

  async function apagarQuadro() {
    const totalCards = quadro.colunas.reduce((s, c) => s + c.tarefas.length, 0);
    const msg =
      totalCards > 0
        ? `Apagar o quadro "${quadro.nome}"? Os ${totalCards} cards NÃO são perdidos — voltam pro quadro Agência automaticamente.`
        : `Apagar o quadro "${quadro.nome}"?`;
    if (!confirm(msg)) return;

    const res = await fetch(`/api/quadros/${quadro.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Falha ao apagar o quadro");
      return;
    }
    toast.success(`Quadro "${quadro.nome}" apagado`);
    try { localStorage.removeItem("sal-hub-quadro-ativo"); } catch { /* ignore */ }
    // Vai pro primeiro quadro restante (Agência vem primeiro na ordenação)
    const restantes = quadros.filter((q) => q.id !== quadro.id);
    setQuadros(restantes);
    if (restantes.length > 0) {
      await trocarQuadro(restantes[0].id);
    }
    await refetchQuadros();
  }

  // ─── Mutações de coluna ──────────────────────────────────────────

  async function renomearColuna(colunaId: string, nome: string) {
    setQuadro((q) => ({
      ...q,
      colunas: q.colunas.map((c) => (c.id === colunaId ? { ...c, nome } : c)),
    }));
    const res = await fetch(`/api/colunas/${colunaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!res.ok) { toast.error("Falha ao renomear"); void refetch(); }
  }

  async function corColuna(colunaId: string, cor: string) {
    setQuadro((q) => ({
      ...q,
      colunas: q.colunas.map((c) => (c.id === colunaId ? { ...c, cor } : c)),
    }));
    await fetch(`/api/colunas/${colunaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cor }),
    }).catch(() => undefined);
  }

  async function toggleConcluiColuna(colunaId: string, atual: boolean) {
    const res = await fetch(`/api/colunas/${colunaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isConcluido: !atual }),
    });
    if (res.ok) {
      toast.success(!atual ? "Cards desta coluna agora contam como concluídos" : "Coluna deixou de concluir cards");
      void refetch();
    }
  }

  async function apagarColuna(colunaId: string, nome: string, qtd: number) {
    const msg = qtd > 0
      ? `Apagar a coluna "${nome}"? Os ${qtd} cards vão pra coluna vizinha.`
      : `Apagar a coluna "${nome}"?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/colunas/${colunaId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error ?? "Falha ao apagar");
      return;
    }
    void refetch();
  }

  async function criarColuna(nome: string) {
    const res = await fetch(`/api/quadros/${quadro.id}/colunas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cor: CORES_COLUNA[quadro.colunas.length % CORES_COLUNA.length] }),
    });
    if (!res.ok) { toast.error("Falha ao criar coluna"); return; }
    void refetch();
  }

  async function criarCard(colunaId: string, titulo: string) {
    const res = await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo,
        colunaId,
        // Board de projeto: card novo já nasce vinculado ao projeto
        ...(quadro.projeto ? { projetoId: quadro.projeto.id } : {}),
      }),
    });
    if (!res.ok) { toast.error("Falha ao criar card"); return; }
    void refetch();
  }

  // ─── Filtro client-side ──────────────────────────────────────────

  const colunasVisiveis = useMemo(() => {
    if (!temFiltro) return quadro.colunas;
    const q = busca.trim().toLowerCase();
    return quadro.colunas.map((c) => ({
      ...c,
      tarefas: c.tarefas.filter((t) => {
        if (q && !t.titulo.toLowerCase().includes(q) && !(t.cliente?.nome ?? "").toLowerCase().includes(q)) return false;
        if (filtroCliente && t.cliente?.id !== filtroCliente) return false;
        if (filtroTipo && t.tipoDemanda !== filtroTipo) return false;
        return true;
      }),
    }));
  }, [quadro.colunas, temFiltro, busca, filtroCliente, filtroTipo]);

  const totalVisivel = colunasVisiveis.reduce((s, c) => s + c.tarefas.length, 0);

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Barra do quadro: switcher + filtros */}
      <div className="shrink-0 px-3 sm:px-5 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Switcher de quadros */}
          <div className="flex items-center gap-1 flex-wrap">
            {quadros.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => trocarQuadro(q.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors border",
                  q.id === quadro.id
                    ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                    : "text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground"
                )}
              >
                <span>{q.icone ?? (q.tipo === "AGENCIA" ? "⚡" : "📁")}</span>
                {q.nome}
                <span className="text-[10px] font-mono opacity-60">{q.totalCards}</span>
              </button>
            ))}
            {/* Ações do quadro ativo: renomear / apagar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  title={`Ações do quadro "${quadro.nome}"`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel className="text-[11px]">Quadro "{quadro.nome}"</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRenomearQuadroOpen(true)} className="text-[12.5px] gap-2">
                  <Pencil className="h-3.5 w-3.5" /> Renomear / trocar ícone
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={apagarQuadro}
                  className="text-[12.5px] gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Apagar quadro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => setNovoQuadroOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Criar quadro novo (em branco ou de um projeto)"
            >
              <Plus className="h-3.5 w-3.5" /> Quadro
            </button>
          </div>

          {carregandoQuadro && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cards..."
                className="pl-8 h-8 w-[170px] text-[13px]"
              />
            </div>
            {/* Cliente */}
            <Select value={filtroCliente || "__todos"} onValueChange={(v) => setFiltroCliente(v === "__todos" ? "" : v)}>
              <SelectTrigger className="h-8 w-[150px] text-[13px]">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {temFiltro && (
              <Button size="sm" variant="ghost" className="h-8" onClick={() => { setBusca(""); setFiltroCliente(""); setFiltroTipo(""); }}>
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Chips de tipo de demanda */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(TIPO_META) as TipoDemanda[]).map((t) => {
            const sel = filtroTipo === t;
            const meta = TIPO_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFiltroTipo(sel ? "" : t)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                  sel ? "text-white border-transparent" : "text-muted-foreground border-border hover:border-foreground/30"
                )}
                style={sel ? { background: meta.cor } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: sel ? "rgba(255,255,255,0.8)" : meta.cor }} />
                {meta.label}
              </button>
            );
          })}
          {temFiltro && (
            <span className="text-[11px] text-muted-foreground ml-1">{totalVisivel} card{totalVisivel === 1 ? "" : "s"}</span>
          )}

          {/* Camadas — só no quadro Agência (F3) */}
          {quadro.tipo === "AGENCIA" && (camadaPosts.length > 0 || camadaActions.length > 0) && (
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Camadas:</span>
              {camadaPosts.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCamada("posts")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                    camadasAtivas.posts
                      ? "bg-[#7E30E1] text-white border-transparent"
                      : "text-muted-foreground border-border hover:border-foreground/30"
                  )}
                >
                  Conteúdo ({camadaPosts.length})
                </button>
              )}
              {camadaActions.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCamada("actions")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                    camadasAtivas.actions
                      ? "bg-amber-500 text-white border-transparent"
                      : "text-muted-foreground border-border hover:border-foreground/30"
                  )}
                >
                  Actions ({camadaActions.length})
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Board — scroll horizontal, altura toda */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUNA">
          {(boardProv) => (
            <div
              ref={boardProv.innerRef}
              {...boardProv.droppableProps}
              className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-3 sm:px-5 pb-4"
            >
              <div className="flex gap-3 h-full items-start">
                {colunasVisiveis.map((coluna, idx) => (
                  <Draggable key={coluna.id} draggableId={coluna.id} index={idx} isDragDisabled={temFiltro}>
                    {(colProv, colSnap) => (
                      <div
                        ref={colProv.innerRef}
                        {...colProv.draggableProps}
                        className={cn(
                          "w-[278px] shrink-0 flex flex-col max-h-full rounded-xl border bg-secondary/55 backdrop-blur-[2px] transition-shadow",
                          colSnap.isDragging ? "shadow-xl ring-2 ring-primary/40 border-primary/30" : "border-border/70"
                        )}
                      >
                        <ColunaHeader
                          coluna={coluna}
                          dragHandleProps={colProv.dragHandleProps}
                          onRenomear={(nome) => renomearColuna(coluna.id, nome)}
                          onCor={(cor) => corColuna(coluna.id, cor)}
                          onToggleConclui={() => toggleConcluiColuna(coluna.id, coluna.isConcluido)}
                          onApagar={() => apagarColuna(coluna.id, coluna.nome, coluna.tarefas.length)}
                        />
                        <Droppable droppableId={coluna.id} type="CARD">
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.droppableProps}
                              className={cn(
                                "flex-1 min-h-[8px] overflow-y-auto px-2 pb-1 space-y-2 transition-colors rounded-b-xl",
                                snap.isDraggingOver && "bg-primary/[0.045]"
                              )}
                            >
                              {coluna.tarefas.map((t, i) => (
                                <Draggable key={t.id} draggableId={t.id} index={i}>
                                  {(cardProv, cardSnap) => (
                                    <div
                                      ref={cardProv.innerRef}
                                      {...cardProv.draggableProps}
                                      {...cardProv.dragHandleProps}
                                      onClick={() => sheet.open(t.id)}
                                      className={cn(
                                        "group rounded-lg border bg-card px-3 py-2.5 cursor-pointer select-none",
                                        "shadow-[0_1px_2px_rgba(20,20,30,0.06)] hover:shadow-[0_3px_10px_rgba(20,20,30,0.10)] hover:-translate-y-px",
                                        "transition-[box-shadow,transform] border-border/80",
                                        cardSnap.isDragging && "shadow-xl rotate-[1.5deg] ring-2 ring-primary/50",
                                        t.concluida && "opacity-60"
                                      )}
                                    >
                                      <CardConteudo t={t} />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {prov.placeholder}
                            </div>
                          )}
                        </Droppable>
                        <AddCardInline onCriar={(titulo) => criarCard(coluna.id, titulo)} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {boardProv.placeholder}

                {/* Camadas — colunas virtuais somente leitura (F3) */}
                {quadro.tipo === "AGENCIA" && camadasAtivas.posts && camadaPosts.length > 0 && (
                  <ColunaVirtual titulo="Conteúdo em produção" cor="#7E30E1" qtd={camadaPosts.length}>
                    {camadaPosts.map((p) => (
                      <a
                        key={p.id}
                        href={`/editorial?post=${p.id}`}
                        className="block rounded-lg border border-border/80 bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(20,20,30,0.06)] hover:shadow-md hover:-translate-y-px transition-[box-shadow,transform]"
                      >
                        <div className="h-1 w-8 rounded-full mb-1.5 bg-[#7E30E1]/60" />
                        <div className="text-[13px] font-medium leading-snug">{p.titulo}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {p.cliente && (
                            <span className="text-[10.5px] font-semibold text-primary/90 bg-primary/10 px-1.5 py-px rounded">
                              {p.cliente.nome}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">{p.formato}</span>
                          <span className="text-[10.5px] font-mono text-muted-foreground ml-auto">
                            {new Date(p.dataPublicacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        </div>
                      </a>
                    ))}
                  </ColunaVirtual>
                )}
                {quadro.tipo === "AGENCIA" && camadasAtivas.actions && camadaActions.length > 0 && (
                  <ColunaVirtual titulo="Actions de reuniões" cor="#F59E0B" qtd={camadaActions.length}>
                    {camadaActions.map((a) => (
                      <a
                        key={a.id}
                        href={`/reunioes/${a.reuniaoId}`}
                        className="block rounded-lg border border-border/80 bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(20,20,30,0.06)] hover:shadow-md hover:-translate-y-px transition-[box-shadow,transform]"
                      >
                        <div className="text-[13px] font-medium leading-snug">{a.texto}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10.5px] text-muted-foreground">
                          <span className="truncate">🎙 {a.reuniaoTitulo}</span>
                          {a.prazo && <span className="font-mono ml-auto">{a.prazo}</span>}
                        </div>
                      </a>
                    ))}
                  </ColunaVirtual>
                )}

                <AddColunaInline onCriar={criarColuna} />
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Sheet da tarefa (existente) */}
      <TarefaSheet
        tarefaId={sheet.id}
        open={sheet.isOpen}
        onOpenChange={(o) => { if (!o) sheet.close(); }}
        clientes={clientes}
        projetos={projetos}
      />

      {renomearQuadroOpen && (
        <RenomearQuadroDialog
          nomeAtual={quadro.nome}
          iconeAtual={quadro.icone ?? ""}
          onClose={() => setRenomearQuadroOpen(false)}
          onSalvar={renomearQuadro}
        />
      )}

      {novoQuadroOpen && (
        <NovoQuadroDialog
          projetos={projetos}
          quadrosExistentes={quadros}
          onClose={() => setNovoQuadroOpen(false)}
          onCriado={async (id) => {
            setNovoQuadroOpen(false);
            await refetchQuadros();
            await trocarQuadro(id);
          }}
        />
      )}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────

function CardConteudo({ t }: { t: CardTarefa }) {
  const atrasada = !t.concluida && t.dataEntrega && new Date(t.dataEntrega) < new Date();
  const tipo = t.tipoDemanda ? TIPO_META[t.tipoDemanda] : null;
  const temChecklist = t.checklistTotal > 0;
  const progresso = temChecklist ? Math.round((t.checklistFeitos / t.checklistTotal) * 100) : 0;

  return (
    <>
      {/* Faixa de tipo (estilo label Trello) */}
      {tipo && (
        <div className="h-1 w-8 rounded-full mb-1.5" style={{ background: tipo.cor }} title={tipo.label} />
      )}
      <div className="text-[13px] font-medium leading-snug">{t.titulo}</div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap min-h-[16px]">
        {t.cliente && (
          <span className="text-[10.5px] font-semibold text-primary/90 bg-primary/10 px-1.5 py-px rounded">
            {t.cliente.nome}
          </span>
        )}
        {t.dataEntrega && (
          <span className={cn("inline-flex items-center gap-1 text-[10.5px] font-mono", atrasada ? "text-rose-500 font-bold" : "text-muted-foreground")}>
            <CalendarDays className="h-3 w-3" />
            {new Date(t.dataEntrega).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        )}
        {(t.prioridade === "URGENTE" || t.prioridade === "ALTA") && (
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold uppercase", t.prioridade === "URGENTE" ? "text-rose-500" : "text-amber-500")}>
            <Flag className="h-2.5 w-2.5" />
            {t.prioridade === "URGENTE" ? "urgente" : "alta"}
          </span>
        )}
        {temChecklist && (
          <span className={cn("inline-flex items-center gap-1 text-[10.5px] font-mono ml-auto", progresso === 100 ? "text-emerald-500" : "text-muted-foreground")}>
            <CheckSquare className="h-3 w-3" />
            {t.checklistFeitos}/{t.checklistTotal}
          </span>
        )}
      </div>
      {temChecklist && (
        <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-[width]", progresso === 100 ? "bg-emerald-500" : "bg-primary/60")}
            style={{ width: `${progresso}%` }}
          />
        </div>
      )}
    </>
  );
}

// ─── Header da coluna ──────────────────────────────────────────────

function ColunaHeader({
  coluna,
  dragHandleProps,
  onRenomear,
  onCor,
  onToggleConclui,
  onApagar,
}: {
  coluna: ColunaBoard;
  dragHandleProps: Record<string, unknown> | null | undefined;
  onRenomear: (nome: string) => void;
  onCor: (cor: string) => void;
  onToggleConclui: () => void;
  onApagar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(coluna.nome);
  useEffect(() => setNome(coluna.nome), [coluna.nome]);

  function salvar() {
    setEditando(false);
    const v = nome.trim();
    if (v && v !== coluna.nome) onRenomear(v);
    else setNome(coluna.nome);
  }

  return (
    <div {...(dragHandleProps ?? {})} className="flex items-center gap-2 px-3 pt-2.5 pb-2 cursor-grab active:cursor-grabbing">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: coluna.cor ?? "#8B8B9D" }} />
      {editando ? (
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") { setNome(coluna.nome); setEditando(false); } }}
          className="flex-1 min-w-0 bg-card border border-primary/40 rounded px-1.5 py-0.5 text-[12.5px] font-bold outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="flex-1 min-w-0 text-left text-[12.5px] font-bold truncate hover:text-primary transition-colors"
          title="Clique pra renomear"
        >
          {coluna.nome}
        </button>
      )}
      {coluna.isConcluido && <CircleCheckBig className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
      <span className="text-[10.5px] font-mono text-muted-foreground bg-card border border-border/70 rounded-full px-1.5 shrink-0">
        {coluna.tarefas.length}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-card hover:text-foreground transition-colors shrink-0">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[11px]">Coluna "{coluna.nome}"</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 flex gap-1.5">
            {CORES_COLUNA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCor(c)}
                className={cn("h-5 w-5 rounded-full border-2 transition-transform hover:scale-110", coluna.cor === c ? "border-foreground" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onToggleConclui} className="text-[12.5px] gap-2">
            <CircleCheckBig className="h-3.5 w-3.5" />
            {coluna.isConcluido ? "Não concluir cards aqui" : "Cards aqui contam como concluídos"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onApagar} className="text-[12.5px] gap-2 text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Apagar coluna
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Add card inline ───────────────────────────────────────────────

function AddCardInline({ onCriar }: { onCriar: (titulo: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    const v = titulo.trim();
    if (!v) { setAberto(false); return; }
    setSalvando(true);
    await onCriar(v);
    setTitulo("");
    setSalvando(false);
    // Mantém aberto pra adicionar vários em sequência (comportamento Trello)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mx-2 mb-2 mt-1 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-muted-foreground hover:bg-card hover:text-foreground transition-colors flex items-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar cartão
      </button>
    );
  }

  return (
    <div className="mx-2 mb-2 mt-1 space-y-1.5">
      <textarea
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void confirmar(); }
          if (e.key === "Escape") { setAberto(false); setTitulo(""); }
        }}
        placeholder="Título do card... (Enter cria)"
        rows={2}
        className="w-full rounded-lg border border-primary/40 bg-card px-2.5 py-2 text-[13px] outline-none resize-none shadow-sm"
      />
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="h-7 text-[12px]" onClick={confirmar} disabled={salvando}>
          {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Adicionar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[12px]" onClick={() => { setAberto(false); setTitulo(""); }}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── Coluna virtual (camadas F3 — somente leitura) ─────────────────

function ColunaVirtual({
  titulo,
  cor,
  qtd,
  children,
}: {
  titulo: string;
  cor: string;
  qtd: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-[278px] shrink-0 flex flex-col max-h-full rounded-xl border border-dashed bg-secondary/35"
      style={{ borderColor: `${cor}55` }}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cor }} />
        <span className="flex-1 text-[12.5px] font-bold truncate">{titulo}</span>
        <span className="text-[10.5px] font-mono text-muted-foreground bg-card border border-border/70 rounded-full px-1.5 shrink-0">
          {qtd}
        </span>
      </div>
      <div className="flex-1 min-h-[8px] overflow-y-auto px-2 pb-2 space-y-2">
        {children}
      </div>
      <div className="px-3 pb-2 text-[10px] text-muted-foreground/60 italic">
        Camada informativa — clique abre o item na origem
      </div>
    </div>
  );
}

// ─── Add coluna inline ─────────────────────────────────────────────

function AddColunaInline({ onCriar }: { onCriar: (nome: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");

  async function confirmar() {
    const v = nome.trim();
    if (!v) { setAberto(false); return; }
    await onCriar(v);
    setNome("");
    setAberto(false);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-[278px] shrink-0 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-[13px] text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-secondary/40 transition-colors flex items-center gap-2 self-start"
      >
        <Plus className="h-4 w-4" /> Nova coluna
      </button>
    );
  }

  return (
    <div className="w-[278px] shrink-0 rounded-xl border border-primary/40 bg-secondary/55 p-2 space-y-1.5 self-start">
      <Input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void confirmar();
          if (e.key === "Escape") { setAberto(false); setNome(""); }
        }}
        placeholder="Nome da coluna..."
        className="h-8 text-[13px] bg-card"
      />
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="h-7 text-[12px]" onClick={confirmar}>Criar</Button>
        <Button size="sm" variant="ghost" className="h-7 text-[12px]" onClick={() => { setAberto(false); setNome(""); }}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Renomear quadro ───────────────────────────────────────────────

function RenomearQuadroDialog({
  nomeAtual,
  iconeAtual,
  onClose,
  onSalvar,
}: {
  nomeAtual: string;
  iconeAtual: string;
  onClose: () => void;
  onSalvar: (nome: string, icone: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(nomeAtual);
  const [icone, setIcone] = useState(iconeAtual);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Dá um nome pro quadro");
      return;
    }
    setSalvando(true);
    await onSalvar(nome, icone);
    setSalvando(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" /> Renomear quadro
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="space-y-1.5 w-16">
              <Label>Ícone</Label>
              <Input
                value={icone}
                onChange={(e) => setIcone(e.target.value)}
                placeholder="⚡"
                maxLength={4}
                className="text-center"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label>Nome</Label>
              <Input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void salvar(); }}
              />
            </div>
          </div>
          <p className="text-[10.5px] text-muted-foreground/70">
            Ícone é um emoji (opcional) — aparece no seletor de quadros.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Novo quadro ───────────────────────────────────────────────────

function NovoQuadroDialog({
  projetos,
  quadrosExistentes,
  onClose,
  onCriado,
}: {
  projetos: { id: string; nome: string }[];
  quadrosExistentes: QuadroResumo[];
  onClose: () => void;
  onCriado: (id: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [salvando, setSalvando] = useState(false);

  const projetosSemQuadro = projetos.filter(
    (p) => !quadrosExistentes.some((q) => q.projetoId === p.id)
  );

  async function criar() {
    const proj = projetosSemQuadro.find((p) => p.id === projetoId);
    const nomeFinal = nome.trim() || proj?.nome || "";
    if (!nomeFinal) { toast.error("Dá um nome pro quadro"); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/quadros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeFinal, projetoId: projetoId || null }),
      });
      if (!res.ok) throw new Error();
      const q = await res.json();
      toast.success(`Quadro "${nomeFinal}" criado`);
      onCriado(q.id);
    } catch {
      toast.error("Falha ao criar quadro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" /> Novo quadro
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: SEO Q4, Black Friday, Interno..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Vincular a um projeto (opcional)</Label>
            <Select value={projetoId || "__nenhum"} onValueChange={(v) => setProjetoId(v === "__nenhum" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum">Nenhum — quadro livre</SelectItem>
                {projetosSemQuadro.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-muted-foreground/70">
              Quadro de projeto: cards criados nele já nascem vinculados ao projeto. Nasce com o fluxo padrão da agência — edite as colunas à vontade.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Criar quadro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
