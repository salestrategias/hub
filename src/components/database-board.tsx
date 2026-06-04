"use client";
/**
 * database-board.tsx — VIEW BOARD (kanban estilo Trello) de um database.
 *
 * Agrupa as rows por uma propriedade SELECT (config.groupByPropertyId).
 *  - Colunas = opções do select (na ordem do config) + 1 coluna "Sem valor".
 *  - Cards = rows da coluna; mostram o título (1ª prop por ordem) + resumo das
 *    propsVisiveis (badges por tipo via ResumoValor).
 *
 * Quatro features Trello (espelhando leads-kanban.tsx, adaptadas ao modelo de
 * linhas agrupadas por um SELECT — não um enum de status fixo):
 *  1. ADD INLINE — "+ Adicionar card" vira composer (input do título → Enter
 *     cria a row com valores[groupBy]=opção + valores[título]=texto; mantém foco).
 *  2. DnD REORDER/MOVE — arrastar reordena dentro do grupo E move entre grupos
 *     (muda o valor do SELECT). Persiste ordem + valor via /rows/reordenar.
 *  3. MENU ⋯ (hover) — Abrir (painel da row) / Excluir (confirmação). Ações que
 *     mexem em estado no fechamento do menu são adiadas via onCloseAutoFocus+ref
 *     (evita o pointer-events:none preso do Radix). stopPropagation no trigger/
 *     conteúdo (o card é o drag handle + abre o painel no clique).
 *  4. EDIÇÃO INLINE DO TÍTULO — duplo-clique no título → input → salva
 *     valores[tituloProp].
 *
 * Se groupBy não estiver setado (ou não for SELECT), mostra aviso + atalho pra
 * config. ZERO <style jsx>. Comportamento por tipo vem do engine.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Settings2, MoreHorizontal, PanelRightOpen, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { lerConfig, type SelectOption } from "@/lib/database";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type DbProperty, type DbRow, type ViewConfig,
  ChipOpcao, ResumoValor, tituloDaRow,
} from "@/components/database-cells";

// Sentinela pro droppableId da coluna "Sem valor" (não colide com cuid de opção).
const SEM_VALOR = "__sem_valor__";

export function BoardView({
  propriedades,
  linhas,
  config,
  onSetCelula,
  onAddCard,
  onCriarInline,
  onReordenar,
  onRenomearTitulo,
  onExcluirRow,
  onAbrirRow,
  onConfigurar,
}: {
  propriedades: DbProperty[];
  linhas: DbRow[];
  config: ViewConfig;
  /** Seta o SELECT de groupBy na row (PATCH valores, otimista no pai). */
  onSetCelula: (rowId: string, propId: string, valor: string | null) => void;
  /** Cria uma row já com aquele valor do select (ou null p/ "Sem valor") + abre painel. */
  onAddCard: (groupByPropId: string, valorOpcaoId: string | null) => void;
  /** Composer inline: cria row com valor do select + título, SEM abrir painel. */
  onCriarInline: (
    groupByPropId: string,
    valorOpcaoId: string | null,
    tituloPropId: string,
    titulo: string
  ) => Promise<string | null>;
  /** Reordena/move: ids da coluna destino na nova ordem + a opção daquela coluna. */
  onReordenar: (groupByPropId: string, valorOpcaoId: string | null, ids: string[]) => void;
  /** Renomeia o título da row (edição inline — seta valores[tituloProp]). */
  onRenomearTitulo: (rowId: string, tituloPropId: string, texto: string) => void;
  /** Exclui a row (menu ⋯ → Excluir, com confirmação no pai). */
  onExcluirRow: (rowId: string) => void;
  onAbrirRow: (rowId: string) => void;
  onConfigurar: () => void;
}) {
  const groupProp = useMemo(
    () => propriedades.find((p) => p.id === config.groupByPropertyId) ?? null,
    [propriedades, config.groupByPropertyId]
  );

  // Propriedade-título = 1ª por ordem (mesma regra de tituloDaRow). É onde a
  // edição inline grava o texto.
  const tituloPropId = useMemo(() => {
    const t = [...propriedades].sort((a, b) => a.ordem - b.ordem)[0];
    return t ? t.id : null;
  }, [propriedades]);

  // Qual coluna está com o composer inline aberto (+ Adicionar card).
  const [composerAberto, setComposerAberto] = useState<string | null>(null);
  // Row pendente de confirmação de exclusão (AlertDialog improvisado em Dialog).
  const [excluindo, setExcluindo] = useState<DbRow | null>(null);

  // Sem propriedade de agrupamento válida → aviso + atalho pra config.
  if (!groupProp || groupProp.tipo !== "SELECT") {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Escolha uma propriedade <strong>de seleção</strong> pra agrupar o board.
        </p>
        <button
          type="button"
          onClick={onConfigurar}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-muted"
        >
          <Settings2 className="h-3.5 w-3.5" /> Configurar agrupamento
        </button>
      </div>
    );
  }

  const opcoes: SelectOption[] = lerConfig(groupProp.config).opcoes ?? [];
  const propsVisiveis = (config.propsVisiveis ?? []).filter((id) => id !== groupProp.id);
  const visiveis = propsVisiveis
    .map((id) => propriedades.find((p) => p.id === id))
    .filter((p): p is DbProperty => !!p);

  // Colunas: cada opção do select + "Sem valor" no fim.
  const colunas: { key: string; opcao: SelectOption | null }[] = [
    ...opcoes.map((o) => ({ key: o.id, opcao: o })),
    { key: SEM_VALOR, opcao: null },
  ];

  // Agrupa rows por valor do select (id da opção, ou SEM_VALOR).
  // `linhas` já chega filtrada/ordenada do pai (aplicarView) — preserva ordem.
  const porColuna = new Map<string, DbRow[]>();
  for (const col of colunas) porColuna.set(col.key, []);
  const rows = linhas;
  for (const row of rows) {
    const raw = row.valores[groupProp.id];
    const valido = typeof raw === "string" && opcoes.some((o) => o.id === raw);
    const key = valido ? (raw as string) : SEM_VALOR;
    porColuna.get(key)?.push(row);
  }

  // Valor do select (id da opção, ou null p/ "Sem valor") a partir do key da coluna.
  function valorDaColuna(key: string): string | null {
    return key === SEM_VALOR ? null : key;
  }

  function onDragEnd(r: DropResult) {
    if (!r.destination || !groupProp) return;
    const origemKey = r.source.droppableId;
    const destinoKey = r.destination.droppableId;
    const rowId = r.draggableId;
    const row = rows.find((x) => x.id === rowId);
    if (!row) return;

    // Sem movimento real (mesma coluna, mesma posição).
    if (origemKey === destinoKey && r.source.index === r.destination.index) return;

    // Monta a ordem visível da coluna de DESTINO (a partir do agrupamento atual,
    // que já reflete `linhas` ordenada) e insere o card na posição do drop. O
    // updater do pai fica determinístico (seta ordem=index + valor do select).
    const destinoVisivel = (porColuna.get(destinoKey) ?? [])
      .filter((x) => x.id !== rowId)
      .map((x) => x.id);
    destinoVisivel.splice(r.destination.index, 0, rowId);

    onReordenar(groupProp.id, valorDaColuna(destinoKey), destinoVisivel);
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none">
          <div className="flex gap-3 sm:gap-3.5 min-w-min">
            {colunas.map((col) => {
              const lista = porColuna.get(col.key) ?? [];
              const valorOpcao = valorDaColuna(col.key);
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          {col.opcao ? (
                            <ChipOpcao opcao={col.opcao} />
                          ) : (
                            <span className="text-[12.5px] font-semibold text-muted-foreground">Sem valor</span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{lista.length}</span>
                        {tituloPropId && (
                          <button
                            type="button"
                            onClick={() => setComposerAberto(col.key)}
                            className="ml-auto text-muted-foreground opacity-0 group-hover/col:opacity-100 hover:text-foreground transition leading-none text-[15px] shrink-0"
                            aria-label="Adicionar card"
                          >
                            +
                          </button>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        {lista.map((row, i) => (
                          <Draggable draggableId={row.id} index={i} key={row.id}>
                            {(p, s) => (
                              <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                                <BoardCard
                                  row={row}
                                  propriedades={propriedades}
                                  visiveis={visiveis}
                                  tituloPropId={tituloPropId}
                                  dragging={s.isDragging}
                                  onAbrir={() => onAbrirRow(row.id)}
                                  onRenomear={onRenomearTitulo}
                                  onExcluir={(rw) => setExcluindo(rw)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {prov.placeholder}
                      </div>

                      {tituloPropId && composerAberto === col.key ? (
                        <ColumnComposer
                          onSubmit={(texto) =>
                            onCriarInline(groupProp.id, valorOpcao, tituloPropId, texto)
                          }
                          onClose={() => setComposerAberto(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            tituloPropId ? setComposerAberto(col.key) : onAddCard(groupProp.id, valorOpcao)
                          }
                          className="mt-1.5 flex items-center gap-1.5 w-full px-1.5 py-2 rounded-lg text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar card
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

      {/* Confirmação de exclusão. AlertDialog não existe em ui/, então usamos
          Dialog — aberto via setExcluindo (state) a partir do menu ⋯, que já
          fecha o DropdownMenu antes (onCloseAutoFocus), evitando o pointer-events
          lock do Radix. */}
      <Dialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir card</DialogTitle>
            <DialogDescription>
              {excluindo
                ? `"${tituloDaRow(propriedades, excluindo)}" será removido permanentemente. Esta ação não pode ser desfeita.`
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
                if (excluindo) onExcluirRow(excluindo.id);
                setExcluindo(null);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Card de uma row no board. O wrapper externo (no map do Draggable) é o drag
 * handle E abre o painel no clique — então tudo que NÃO deve disparar drag/abrir
 * (menu ⋯, input de edição inline) precisa de stopPropagation em pointerDown/click.
 */
function BoardCard({
  row,
  propriedades,
  visiveis,
  tituloPropId,
  dragging,
  onAbrir,
  onRenomear,
  onExcluir,
}: {
  row: DbRow;
  propriedades: DbProperty[];
  visiveis: DbProperty[];
  tituloPropId: string | null;
  dragging: boolean;
  onAbrir: () => void;
  onRenomear: (rowId: string, tituloPropId: string, texto: string) => void;
  onExcluir: (row: DbRow) => void;
}) {
  const titulo = tituloDaRow(propriedades, row);

  // Edição inline do título (duplo-clique).
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(titulo);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editando]);

  function abrirEdicao() {
    if (!tituloPropId) return;
    setRascunho(titulo === "Sem título" ? "" : titulo);
    setEditando(true);
  }
  function salvarEdicao() {
    const valorFinal = rascunho.trim();
    setEditando(false);
    if (tituloPropId && valorFinal && valorFinal !== titulo) {
      onRenomear(row.id, tituloPropId, valorFinal);
    }
  }

  return (
    <div
      onClick={() => {
        if (!editando) onAbrir();
      }}
      className={cn(
        "group/card w-full text-left rounded-xl border border-border bg-card p-3 space-y-2 shadow-sm transition cursor-grab hover:shadow-md hover:-translate-y-px hover:border-primary/40 active:cursor-grabbing",
        dragging && "shadow-2xl ring-2 ring-primary"
      )}
    >
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
            placeholder="Sem título"
            className="flex-1 min-w-0 font-medium text-sm leading-tight bg-background border border-primary/50 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <div
            className="font-medium text-sm break-words min-w-0 flex-1"
            onDoubleClick={(e) => {
              e.stopPropagation();
              abrirEdicao();
            }}
            title={tituloPropId ? "Duplo-clique pra renomear" : undefined}
          >
            {titulo}
          </div>
        )}
        <CardMenu onAbrir={onAbrir} onExcluir={() => onExcluir(row)} />
      </div>
      {visiveis.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {visiveis.map((vp) => (
            <ResumoValor key={vp.id} prop={vp} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Menu de ações rápidas (⋯) no canto do card. Só aparece no hover.
 *
 * Dois cuidados (iguais ao leads-kanban):
 *  1. O card é drag handle + abre o painel no clique → trigger e conteúdo levam
 *     stopPropagation em pointerDown/click pra não iniciar drag nem abrir.
 *  2. Ações que abrem Dialog (Excluir) ou mexem em estado no fechamento do menu
 *     são adiadas pra onCloseAutoFocus via ref — senão o Radix deixa
 *     pointer-events:none preso no body e trava a página. Por consistência,
 *     TODAS as ações usam o ref.
 */
function CardMenu({ onAbrir, onExcluir }: { onAbrir: () => void; onExcluir: () => void }) {
  const pendente = useRef<(() => void) | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Ações do card"
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={() => (pendente.current = onExcluir)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Composer inline pra criar card direto na coluna (estilo Trello), sem modal.
 * Enter cria e MANTÉM aberto + foco (adiciona vários em sequência). Esc ou blur
 * (com campo vazio) fecha. Shift+Enter quebra linha.
 */
function ColumnComposer({
  onSubmit,
  onClose,
}: {
  onSubmit: (titulo: string) => void;
  onClose: () => void;
}) {
  const [valor, setValor] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function submeter() {
    const texto = valor.trim();
    if (!texto) return;
    onSubmit(texto);
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
          // Fecha ao perder foco — só se vazio, pra não engolir texto digitado.
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
        placeholder="Título do card…"
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
