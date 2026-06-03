"use client";
/**
 * database-board.tsx — VIEW BOARD (kanban) de um database.
 *
 * Agrupa as rows por uma propriedade SELECT (config.groupByPropertyId).
 *  - Colunas = opções do select (na ordem do config) + 1 coluna "Sem valor".
 *  - Cards = rows da coluna; mostram o título (1ª prop) + resumo das
 *    propsVisiveis (badges por tipo via ResumoValor).
 *  - Arrastar card entre colunas → seta aquele SELECT na row (otimista),
 *    reusando @hello-pangea/dnd (mesmo padrão de projetos-kanban).
 *  - "+ card" por coluna cria a row já com aquele valor do select e abre o
 *    painel da linha.
 *
 * Se groupBy não estiver setado (ou não for SELECT), mostra aviso + atalho
 * pra config. ZERO <style jsx>. Comportamento por tipo vem do engine.
 */
import { useMemo } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { lerConfig, type SelectOption } from "@/lib/database";
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
  onAbrirRow,
  onConfigurar,
}: {
  propriedades: DbProperty[];
  linhas: DbRow[];
  config: ViewConfig;
  /** Seta o SELECT de groupBy na row (PATCH valores, otimista no pai). */
  onSetCelula: (rowId: string, propId: string, valor: string | null) => void;
  /** Cria uma row já com aquele valor do select (ou null p/ "Sem valor"). */
  onAddCard: (groupByPropId: string, valorOpcaoId: string | null) => void;
  onAbrirRow: (rowId: string) => void;
  onConfigurar: () => void;
}) {
  const groupProp = useMemo(
    () => propriedades.find((p) => p.id === config.groupByPropertyId) ?? null,
    [propriedades, config.groupByPropertyId]
  );

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

  function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const destino = r.destination.droppableId;
    const rowId = r.draggableId;
    if (!groupProp) return;
    const novoValor = destino === SEM_VALOR ? null : destino;
    const row = rows.find((x) => x.id === rowId);
    if (!row) return;
    const atual = typeof row.valores[groupProp.id] === "string" ? row.valores[groupProp.id] : null;
    const atualNorm = atual && opcoes.some((o) => o.id === atual) ? atual : null;
    if (atualNorm === novoValor) return;
    onSetCelula(rowId, groupProp.id, novoValor);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-min">
          {colunas.map((col) => {
            const lista = porColuna.get(col.key) ?? [];
            return (
              <Droppable droppableId={col.key} key={col.key}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className={cn(
                      "w-[280px] shrink-0 rounded-lg border border-border bg-card/40 p-2 min-h-[400px]",
                      snap.isDraggingOver && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between px-1.5 py-1.5 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {col.opcao ? (
                          <ChipOpcao opcao={col.opcao} />
                        ) : (
                          <span className="text-[12px] font-medium text-muted-foreground">Sem valor</span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{lista.length}</span>
                    </div>

                    <div className="space-y-2">
                      {lista.map((row, i) => (
                        <Draggable draggableId={row.id} index={i} key={row.id}>
                          {(p, s) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                              <button
                                type="button"
                                onClick={() => onAbrirRow(row.id)}
                                className={cn(
                                  "w-full text-left rounded-lg border border-border bg-card p-3 space-y-2 transition cursor-pointer hover:border-primary/40",
                                  s.isDragging && "shadow-2xl ring-2 ring-primary"
                                )}
                              >
                                <div className="font-medium text-sm break-words">
                                  {tituloDaRow(propriedades, row)}
                                </div>
                                {visiveis.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {visiveis.map((vp) => (
                                      <ResumoValor key={vp.id} prop={vp} row={row} />
                                    ))}
                                  </div>
                                )}
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </div>

                    <button
                      type="button"
                      onClick={() => onAddCard(groupProp.id, col.opcao ? col.opcao.id : null)}
                      className="mt-2 flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> card
                    </button>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
