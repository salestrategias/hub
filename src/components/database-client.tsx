"use client";
/**
 * DatabaseClient — motor de databases configuráveis (estilo Notion).
 *
 * Layout:
 *  - HEADER: ícone (emoji editável) + nome editável + descrição editável.
 *  - BARRA DE VIEWS: abas (por ora só "Tabela" funciona; o seletor já existe
 *    pra Board/Calendário dos próximos blocos).
 *  - VIEW TABELA: grade onde colunas = propriedades e linhas = rows.
 *      · Header de coluna: nome + ícone do tipo + menu (renomear, mudar tipo,
 *        configurar, deletar). Botão "+ coluna" no fim.
 *      · Célula editável INLINE por tipo (texto/número/select/multiselect/
 *        data/checkbox/url). Auto-save por célula (PATCH /rows/[rowId] com
 *        merge de `valores`; debounce em texto/número).
 *      · "+ nova linha" embaixo; menu por linha (excluir). 1ª coluna fixa.
 *
 * Estado: cópia local otimista do database. Cada mutação atualiza o estado e
 * dispara o fetch; em erro, toast + router.refresh() pra ressincronizar.
 *
 * O COMPORTAMENTO de cada tipo (config, coerção, formatação, cores) vem de
 * src/lib/database.ts — este arquivo é só a casca de UI. ZERO <style jsx>.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import {
  Plus, Trash2, MoreHorizontal,
  GripVertical, X, Check, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  type PropertyConfig, type SelectCor, type CellValue,
  type NumeroFormato,
  lerConfig, metaDe, iconeDoTipo, TIPOS_DISPONIVEIS,
  SELECT_CORES, SELECT_COR_SWATCH,
  novaOpcao, cryptoId,
} from "@/lib/database";
import type { PropertyTipo, ViewTipo } from "@prisma/client";
import {
  type DbProperty, type DbView, type DbRow, type DatabaseFull, type ViewConfig,
  LucideIcon, api, CelulaEditavel, lerViewConfig,
} from "@/components/database-cells";
import {
  type Filtro, type Ordenacao, type FiltroOperador, type Direcao,
  aplicarView, operadoresDoTipo, operadorPadraoDe, metaDoOperador,
} from "@/lib/database-query";
import { RowPanel } from "@/components/database-row-panel";
import { BoardView } from "@/components/database-board";
import { CalendarView } from "@/components/database-calendar";
import { RelacaoProvider, useDatabasesLista } from "@/components/database-relacao";

// Re-export dos tipos do payload (consumidos por quem importa este módulo).
export type { DbProperty, DbView, DbRow, DatabaseFull };

/**
 * Tipos oferecidos ao criar/converter uma COLUNA aqui na UI. Reusa a lista do
 * engine (`TIPOS_DISPONIVEIS`) e acrescenta RELACAO (link pra outro database),
 * que o engine mantém fora do set "filtrável" de propósito.
 */
const TIPOS_COLUNA: PropertyTipo[] = [...TIPOS_DISPONIVEIS, "RELACAO"];

// ════════════════════════════════════════════════════════════════════
// Componente raiz
// ════════════════════════════════════════════════════════════════════
export function DatabaseClient({ db: dbInicial }: { db: DatabaseFull }) {
  const router = useRouter();
  const [db, setDb] = useState<DatabaseFull>(dbInicial);
  useEffect(() => setDb(dbInicial), [dbInicial]);

  const [viewAtivaId, setViewAtivaId] = useState<string>(
    dbInicial.views[0]?.id ?? ""
  );
  const viewAtiva = db.views.find((v) => v.id === viewAtivaId) ?? db.views[0];

  // ── Painel da linha (row detail) ─────────────────────────────────
  const [rowPanelId, setRowPanelId] = useState<string | null>(null);
  const rowPanel = rowPanelId ? db.linhas.find((r) => r.id === rowPanelId) ?? null : null;

  // Qual view tem o popover de config aberto (controlado p/ o board abrir).
  const [configViewId, setConfigViewId] = useState<string | null>(null);

  // ── Mutadores de meta (nome/ícone/descrição) ─────────────────────
  async function patchDb(campos: Partial<Pick<DatabaseFull, "nome" | "icone" | "descricao">>) {
    setDb((d) => ({ ...d, ...campos }));
    try {
      await api(`/api/databases/${db.id}`, "PATCH", campos);
      // Nome/ícone aparecem na árvore do workspace → refresca server tree.
      if ("nome" in campos || "icone" in campos) router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
      router.refresh();
    }
  }

  // ── Propriedades (colunas) ───────────────────────────────────────
  async function addColuna(tipo: PropertyTipo) {
    const meta = metaDe(tipo);
    try {
      const nova: DbProperty = await api(`/api/databases/${db.id}/properties`, "POST", {
        nome: meta.label,
        tipo,
      });
      setDb((d) => ({ ...d, propriedades: [...d.propriedades, nova] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar coluna");
    }
  }

  async function patchColuna(propId: string, campos: Partial<DbProperty>) {
    // Otimista
    setDb((d) => ({
      ...d,
      propriedades: d.propriedades.map((p) => (p.id === propId ? { ...p, ...campos } : p)),
    }));
    try {
      const atualizada: DbProperty = await api(
        `/api/databases/${db.id}/properties/${propId}`,
        "PATCH",
        campos
      );
      // O server pode ter resetado config (mudança de tipo) — adota o retorno.
      setDb((d) => ({
        ...d,
        propriedades: d.propriedades.map((p) => (p.id === propId ? atualizada : p)),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar coluna");
      router.refresh();
    }
  }

  async function deleteColuna(propId: string) {
    setDb((d) => ({ ...d, propriedades: d.propriedades.filter((p) => p.id !== propId) }));
    try {
      await api(`/api/databases/${db.id}/properties/${propId}`, "DELETE");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir coluna");
      router.refresh();
    }
  }

  // ── Linhas (rows) ────────────────────────────────────────────────
  /** Cria uma linha (opcionalmente com valores iniciais). Retorna o id. */
  async function addLinhaCom(valores?: Record<string, CellValue>): Promise<string | null> {
    try {
      const nova: { id: string; valores: Record<string, unknown>; ordem: number } = await api(
        `/api/databases/${db.id}/rows`,
        "POST",
        valores ? { valores } : {}
      );
      setDb((d) => ({
        ...d,
        linhas: [...d.linhas, { id: nova.id, valores: nova.valores ?? {}, ordem: nova.ordem }],
      }));
      return nova.id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar linha");
      return null;
    }
  }
  function addLinha() {
    void addLinhaCom();
  }

  async function deleteLinha(rowId: string) {
    setDb((d) => ({ ...d, linhas: d.linhas.filter((r) => r.id !== rowId) }));
    try {
      await api(`/api/databases/${db.id}/rows/${rowId}`, "DELETE");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir linha");
      router.refresh();
    }
  }

  /** Atualiza UMA célula (merge no Json). Otimista + PATCH. */
  async function setCelula(rowId: string, propId: string, valor: CellValue) {
    setDb((d) => ({
      ...d,
      linhas: d.linhas.map((r) =>
        r.id === rowId ? { ...r, valores: { ...r.valores, [propId]: valor } } : r
      ),
    }));
    try {
      await api(`/api/databases/${db.id}/rows/${rowId}`, "PATCH", {
        valores: { [propId]: valor },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar célula");
      router.refresh();
    }
  }

  // ── Views (criar / renomear / config / excluir / trocar) ─────────
  async function addView(tipo: ViewTipo) {
    try {
      const nova: DbView = await api(`/api/databases/${db.id}/views`, "POST", { tipo });
      setDb((d) => ({ ...d, views: [...d.views, nova] }));
      setViewAtivaId(nova.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar view");
    }
  }

  function renomearViewLocal(viewId: string, nome: string) {
    setDb((d) => ({
      ...d,
      views: d.views.map((v) => (v.id === viewId ? { ...v, nome } : v)),
    }));
  }

  async function patchViewConfig(viewId: string, config: ViewConfig) {
    setDb((d) => ({
      ...d,
      views: d.views.map((v) => (v.id === viewId ? { ...v, config } : v)),
    }));
    try {
      await api(`/api/databases/${db.id}/views/${viewId}`, "PATCH", { config });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar a view");
      router.refresh();
    }
  }

  async function deleteView(viewId: string) {
    if (db.views.length <= 1) {
      toast.error("Não dá pra excluir a última view.");
      return;
    }
    const restantes = db.views.filter((v) => v.id !== viewId);
    setDb((d) => ({ ...d, views: restantes }));
    if (viewAtivaId === viewId) setViewAtivaId(restantes[0]?.id ?? "");
    try {
      await api(`/api/databases/${db.id}/views/${viewId}`, "DELETE");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir view");
      router.refresh();
    }
  }

  // "+ card" do board: cria a row já com o valor do select e abre o painel.
  async function addCardBoard(groupByPropId: string, valorOpcaoId: string | null) {
    const id = await addLinhaCom({ [groupByPropId]: valorOpcaoId });
    if (id) setRowPanelId(id);
  }

  // Calendário: clicar num dia cria a row já com aquela data e abre o painel.
  async function criarNoDia(datePropId: string, iso: string) {
    const id = await addLinhaCom({ [datePropId]: iso });
    if (id) setRowPanelId(id);
  }

  const viewCfg: ViewConfig = viewAtiva ? lerViewConfig(viewAtiva.config) : {};

  // Filtros/ordenação da view ativa aplicados às rows (todas as views).
  // Baseline por `ordem` (estado otimista pode estar fora de ordem após
  // inserts); quando há `ordenacoes`, o engine reordena por cima disso.
  const linhasView = useMemo(() => {
    const base = [...db.linhas].sort((a, b) => a.ordem - b.ordem);
    return aplicarView(base, viewCfg, db.propriedades);
  }, [db.linhas, db.propriedades, viewCfg]);

  // Persiste só filtros/ordenacoes da view ativa (merge no config existente).
  function patchQueryView(campos: Pick<ViewConfig, "filtros" | "ordenacoes">) {
    if (!viewAtiva) return;
    void patchViewConfig(viewAtiva.id, { ...viewCfg, ...campos });
  }

  return (
    <RelacaoProvider>
    <div className="space-y-4">
      <DatabaseHeader db={db} onPatch={patchDb} />

      {/* Barra de views (abas + criar/renomear/config/excluir). */}
      <BarraViews
        views={db.views}
        propriedades={db.propriedades}
        ativaId={viewAtiva?.id ?? ""}
        onTrocar={setViewAtivaId}
        dbId={db.id}
        onRenomeada={renomearViewLocal}
        onAddView={addView}
        onPatchConfig={patchViewConfig}
        onDeleteView={deleteView}
        configViewId={configViewId}
        onConfigViewIdChange={setConfigViewId}
        viewAtivaCfg={viewCfg}
        onPatchQuery={patchQueryView}
      />

      {/* View ativa */}
      {viewAtiva?.tipo === "BOARD" ? (
        <BoardView
          propriedades={db.propriedades}
          linhas={linhasView}
          config={viewCfg}
          onSetCelula={(rowId, propId, valor) => setCelula(rowId, propId, valor)}
          onAddCard={addCardBoard}
          onAbrirRow={setRowPanelId}
          onConfigurar={() => setConfigViewId(viewAtiva.id)}
        />
      ) : viewAtiva?.tipo === "CALENDARIO" ? (
        <CalendarView
          propriedades={db.propriedades}
          linhas={linhasView}
          config={viewCfg}
          onCriarNoDia={(iso) => {
            if (viewCfg.datePropertyId) void criarNoDia(viewCfg.datePropertyId, iso);
          }}
          onAbrirRow={setRowPanelId}
          onConfigurar={() => setConfigViewId(viewAtiva.id)}
        />
      ) : viewAtiva?.tipo === "TABELA" ? (
        <TabelaView
          propriedades={db.propriedades}
          linhas={linhasView}
          onAddColuna={addColuna}
          onPatchColuna={patchColuna}
          onDeleteColuna={deleteColuna}
          onAddLinha={addLinha}
          onDeleteLinha={deleteLinha}
          onSetCelula={setCelula}
          onAbrirRow={setRowPanelId}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          A view <strong>{viewAtiva?.nome}</strong> ({viewAtiva?.tipo}) chega num próximo bloco.
        </div>
      )}

      {/* Painel da linha — compartilhado entre Tabela e Board. */}
      <RowPanel
        open={rowPanelId !== null}
        onOpenChange={(o) => {
          if (!o) setRowPanelId(null);
        }}
        row={rowPanel}
        propriedades={db.propriedades}
        onSetCelula={setCelula}
        onDelete={deleteLinha}
      />
    </div>
    </RelacaoProvider>
  );
}

// ════════════════════════════════════════════════════════════════════
// Header (ícone + nome + descrição)
// ════════════════════════════════════════════════════════════════════
function DatabaseHeader({
  db,
  onPatch,
}: {
  db: DatabaseFull;
  onPatch: (campos: Partial<Pick<DatabaseFull, "nome" | "icone" | "descricao">>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <EmojiBotao
          inicial={db.icone ?? ""}
          fallback="🗂️"
          onSave={(v) => onPatch({ icone: v })}
        />
        <TextoEditavel
          inicial={db.nome}
          onSave={(v) => onPatch({ nome: v })}
          placeholder="Sem título"
          className="font-display text-xl md:text-2xl font-semibold flex-1"
          inputClassName="h-10 font-display text-xl font-semibold"
        />
      </div>
      <TextoEditavel
        inicial={db.descricao ?? ""}
        onSave={(v) => onPatch({ descricao: v })}
        placeholder="Adicionar descrição…"
        className="text-sm text-muted-foreground"
        inputClassName="h-8 text-sm"
        multiline
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Barra de views
// ════════════════════════════════════════════════════════════════════
const VIEW_ICONE: Record<ViewTipo, string> = {
  TABELA: "Table",
  BOARD: "Columns3",
  CALENDARIO: "Calendar",
};

function BarraViews({
  views,
  propriedades,
  ativaId,
  onTrocar,
  dbId,
  onRenomeada,
  onAddView,
  onPatchConfig,
  onDeleteView,
  configViewId,
  onConfigViewIdChange,
  viewAtivaCfg,
  onPatchQuery,
}: {
  views: DbView[];
  propriedades: DbProperty[];
  ativaId: string;
  onTrocar: (id: string) => void;
  dbId: string;
  onRenomeada: (viewId: string, nome: string) => void;
  onAddView: (tipo: ViewTipo) => void;
  onPatchConfig: (viewId: string, config: ViewConfig) => void;
  onDeleteView: (viewId: string) => void;
  configViewId: string | null;
  onConfigViewIdChange: (id: string | null) => void;
  viewAtivaCfg: ViewConfig;
  onPatchQuery: (campos: Pick<ViewConfig, "filtros" | "ordenacoes">) => void;
}) {
  const ordenadas = [...views].sort((a, b) => a.ordem - b.ordem);
  const podeExcluir = views.length > 1;

  async function renomear(view: DbView) {
    const nome = window.prompt("Nome da view:", view.nome);
    if (nome == null) return;
    const limpo = nome.trim() || view.nome;
    onRenomeada(view.id, limpo);
    try {
      await api(`/api/databases/${dbId}/views/${view.id}`, "PATCH", { nome: limpo });
    } catch {
      toast.error("Falha ao renomear view");
    }
  }

  const propsOrd = [...propriedades].sort((a, b) => a.ordem - b.ordem);
  const filtros = viewAtivaCfg.filtros ?? [];
  const ordenacoes = viewAtivaCfg.ordenacoes ?? [];

  return (
    <div className="flex items-center gap-2 border-b border-border">
      <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
        {ordenadas.map((v) => {
          const ativo = v.id === ativaId;
          return (
            <div key={v.id} className="flex items-center -mb-px shrink-0">
              <button
                type="button"
                onClick={() => onTrocar(v.id)}
                onDoubleClick={() => renomear(v)}
                title="Duplo-clique pra renomear"
                className={cn(
                  "inline-flex items-center gap-1.5 pl-3 pr-1.5 py-2 text-[13px] border-b-2 transition-colors",
                  ativo
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <LucideIcon name={VIEW_ICONE[v.tipo]} className="h-3.5 w-3.5" />
                {v.nome}
              </button>

              {/* Config + menu da view (só na aba ativa) */}
              {ativo && (
                <ViewMenu
                  view={v}
                  propriedades={propriedades}
                  podeExcluir={podeExcluir}
                  onRenomear={() => renomear(v)}
                  onPatchConfig={(cfg) => onPatchConfig(v.id, cfg)}
                  onExcluir={() => onDeleteView(v.id)}
                  configAberto={configViewId === v.id}
                  onConfigAbertoChange={(o) => onConfigViewIdChange(o ? v.id : null)}
                />
              )}
            </div>
          );
        })}

        {/* "+ view" — escolhe Tabela / Board / Calendário. */}
        <AddViewBtn onAdd={onAddView} />
      </div>

      {/* Filtros + Ordenar (aplicados em TODAS as views da view ativa). */}
      {ativaId && propsOrd.length > 0 && (
        <div className="flex items-center gap-1 shrink-0 pb-1.5">
          <FiltrosBtn
            propriedades={propsOrd}
            filtros={filtros}
            onChange={(f) => onPatchQuery({ filtros: f, ordenacoes })}
          />
          <OrdenarBtn
            propriedades={propsOrd}
            ordenacoes={ordenacoes}
            onChange={(o) => onPatchQuery({ filtros, ordenacoes: o })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Menu + config da view (groupBy / data / props visíveis) ───────
function ViewMenu({
  view,
  propriedades,
  podeExcluir,
  onRenomear,
  onPatchConfig,
  onExcluir,
  configAberto,
  onConfigAbertoChange,
}: {
  view: DbView;
  propriedades: DbProperty[];
  podeExcluir: boolean;
  onRenomear: () => void;
  onPatchConfig: (config: ViewConfig) => void;
  onExcluir: () => void;
  configAberto: boolean;
  onConfigAbertoChange: (aberto: boolean) => void;
}) {
  const cfg = lerViewConfig(view.config);
  const props = [...propriedades].sort((a, b) => a.ordem - b.ordem);
  const selects = props.filter((p) => p.tipo === "SELECT");
  const datas = props.filter((p) => p.tipo === "DATA");

  return (
    <div className="flex items-center">
      <Popover open={configAberto} onOpenChange={onConfigAbertoChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted"
            title="Configurar view"
          >
            <Icons.SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3">
          {view.tipo === "BOARD" && (
            <SeletorPropriedade
              label="Agrupar por (seleção)"
              vazioLabel="Escolha uma propriedade de seleção"
              opcoes={selects}
              valor={cfg.groupByPropertyId}
              onChange={(id) => onPatchConfig({ ...cfg, groupByPropertyId: id ?? undefined })}
              avisoSemOpcoes="Crie uma coluna do tipo Seleção primeiro."
            />
          )}
          {view.tipo === "CALENDARIO" && (
            <SeletorPropriedade
              label="Propriedade de data"
              vazioLabel="Escolha uma propriedade de data"
              opcoes={datas}
              valor={cfg.datePropertyId}
              onChange={(id) => onPatchConfig({ ...cfg, datePropertyId: id ?? undefined })}
              avisoSemOpcoes="Crie uma coluna do tipo Data primeiro."
            />
          )}
          <PropsVisiveis
            propriedades={props}
            selecionadas={cfg.propsVisiveis ?? []}
            onChange={(ids) => onPatchConfig({ ...cfg, propsVisiveis: ids })}
          />
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-6 w-6 mr-1 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted"
            title="Opções da view"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setTimeout(onRenomear, 0)}>
            <Icons.Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => onConfigAbertoChange(true), 0)}>
            <Icons.SlidersHorizontal className="h-3.5 w-3.5 mr-2" /> Configurar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!podeExcluir}
            onSelect={() => {
              if (!podeExcluir) return;
              if (confirm(`Excluir a view "${view.nome}"?`)) onExcluir();
            }}
            className={cn("text-destructive", !podeExcluir && "opacity-40 cursor-not-allowed")}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SeletorPropriedade({
  label,
  vazioLabel,
  opcoes,
  valor,
  onChange,
  avisoSemOpcoes,
}: {
  label: string;
  vazioLabel: string;
  opcoes: DbProperty[];
  valor: string | undefined;
  onChange: (id: string | null) => void;
  avisoSemOpcoes: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      {opcoes.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">{avisoSemOpcoes}</p>
      ) : (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 rounded text-[12px] text-left hover:bg-muted",
              !valor && "bg-accent/50"
            )}
          >
            <span className="flex-1 text-muted-foreground">{vazioLabel}</span>
            {!valor && <Check className="h-3.5 w-3.5" />}
          </button>
          {opcoes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 rounded text-[12px] text-left hover:bg-muted",
                valor === p.id && "bg-accent/50"
              )}
            >
              <LucideIcon name={iconeDoTipo(p.tipo)} className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">{p.nome}</span>
              {valor === p.id && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PropsVisiveis({
  propriedades,
  selecionadas,
  onChange,
}: {
  propriedades: DbProperty[];
  selecionadas: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selecionadas.includes(id) ? selecionadas.filter((x) => x !== id) : [...selecionadas, id]);
  }
  return (
    <div className="space-y-1.5 border-t border-border pt-2">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        Propriedades visíveis
      </p>
      <p className="text-[10px] text-muted-foreground/70">Resumo mostrado nos cards do board.</p>
      <div className="space-y-0.5 max-h-44 overflow-y-auto">
        {propriedades.map((p) => {
          const on = selecionadas.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left"
            >
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                  on ? "bg-primary border-primary text-primary-foreground" : "border-input"
                )}
              >
                {on && <Check className="h-2.5 w-2.5" />}
              </span>
              <LucideIcon name={iconeDoTipo(p.tipo)} className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate text-[12px]">{p.nome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddViewBtn({ onAdd }: { onAdd: (tipo: ViewTipo) => void }) {
  const [aberto, setAberto] = useState(false);
  const tipos: { tipo: ViewTipo; label: string }[] = [
    { tipo: "TABELA", label: "Tabela" },
    { tipo: "BOARD", label: "Board" },
    { tipo: "CALENDARIO", label: "Calendário" },
  ];
  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-2 text-[13px] text-muted-foreground hover:text-foreground shrink-0"
          title="Nova view"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Nova view
        </DropdownMenuLabel>
        {tipos.map((t) => (
          <DropdownMenuItem
            key={t.tipo}
            onSelect={() => {
              onAdd(t.tipo);
              setAberto(false);
            }}
          >
            <LucideIcon name={VIEW_ICONE[t.tipo]} className="h-3.5 w-3.5 mr-2" />
            <span className="flex-1">{t.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ════════════════════════════════════════════════════════════════════
// FILTROS (popover) — lista/adiciona/edita/remove; aplica em todas as views
// ════════════════════════════════════════════════════════════════════
function FiltrosBtn({
  propriedades,
  filtros,
  onChange,
}: {
  propriedades: DbProperty[];
  filtros: Filtro[];
  onChange: (filtros: Filtro[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  // Só propriedades com operadores disponíveis (RELACAO fica de fora).
  const filtraveis = propriedades.filter((p) => operadoresDoTipo(p.tipo).length > 0);
  const byId = new Map(propriedades.map((p) => [p.id, p]));

  function adicionar(prop: DbProperty) {
    const novo: Filtro = {
      id: cryptoId(),
      propertyId: prop.id,
      operador: operadorPadraoDe(prop.tipo),
      valor: undefined,
    };
    onChange([...filtros, novo]);
  }
  function atualizar(id: string, campos: Partial<Filtro>) {
    onChange(filtros.map((f) => (f.id === id ? { ...f, ...campos } : f)));
  }
  function remover(id: string) {
    onChange(filtros.filter((f) => f.id !== id));
  }

  const ativos = filtros.filter((f) => byId.has(f.propertyId)).length;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] border transition-colors",
            ativos > 0
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Filtrar"
        >
          <Icons.Filter className="h-3.5 w-3.5" />
          Filtros
          {ativos > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {ativos}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-2 space-y-2">
        {filtros.length === 0 ? (
          <p className="px-1 py-2 text-[12px] text-muted-foreground">
            Nenhum filtro. Adicione um abaixo pra estreitar as linhas.
          </p>
        ) : (
          <div className="space-y-2">
            {filtros.map((f) => {
              const prop = byId.get(f.propertyId);
              if (!prop) return null;
              return (
                <FiltroLinha
                  key={f.id}
                  filtro={f}
                  prop={prop}
                  onChange={(campos) => atualizar(f.id, campos)}
                  onRemover={() => remover(f.id)}
                />
              );
            })}
          </div>
        )}

        {/* Adicionar filtro (escolhe a propriedade). */}
        <div className="border-t border-border pt-2">
          <AddFiltroProp filtraveis={filtraveis} onAdd={adicionar} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FiltroLinha({
  filtro,
  prop,
  onChange,
  onRemover,
}: {
  filtro: Filtro;
  prop: DbProperty;
  onChange: (campos: Partial<Filtro>) => void;
  onRemover: () => void;
}) {
  const ops = operadoresDoTipo(prop.tipo);
  const meta = metaDoOperador(prop.tipo, filtro.operador);
  const precisaValor = meta?.precisaValor ?? false;

  return (
    <div className="rounded-md border border-border p-2 space-y-1.5 bg-card/40">
      <div className="flex items-center gap-1.5">
        <LucideIcon name={iconeDoTipo(prop.tipo)} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[12px] font-medium truncate flex-1 min-w-0" title={prop.nome}>
          {prop.nome}
        </span>
        <button
          type="button"
          onClick={onRemover}
          className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 hover:text-destructive"
          title="Remover filtro"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={filtro.operador}
          onChange={(e) => {
            const novoOp = e.target.value as FiltroOperador;
            const m = metaDoOperador(prop.tipo, novoOp);
            // Se o novo operador não usa valor, limpa o valor guardado.
            onChange({ operador: novoOp, ...(m?.precisaValor ? {} : { valor: undefined }) });
          }}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-[12px] outline-none focus:ring-1 focus:ring-ring shrink-0"
        >
          {ops.map((o) => (
            <option key={o.op} value={o.op}>
              {o.label}
            </option>
          ))}
        </select>
        {precisaValor && (
          <div className="flex-1 min-w-0">
            <ValorFiltroInput
              prop={prop}
              valor={filtro.valor}
              onChange={(v) => onChange({ valor: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Input do valor de comparação, adequado ao tipo da propriedade. */
function ValorFiltroInput({
  prop,
  valor,
  onChange,
}: {
  prop: DbProperty;
  valor: unknown;
  onChange: (v: unknown) => void;
}) {
  const cfg = lerConfig(prop.config);

  if (prop.tipo === "SELECT" || prop.tipo === "MULTISELECT") {
    const opcoes = cfg.opcoes ?? [];
    const atual = typeof valor === "string" ? valor : "";
    return (
      <select
        value={atual}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-[12px] outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— escolher —</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    );
  }

  if (prop.tipo === "NUMERO") {
    return (
      <Input
        type="number"
        value={valor == null ? "" : String(valor)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        placeholder="valor"
        className="h-7 text-[12px] px-2"
      />
    );
  }

  if (prop.tipo === "DATA") {
    return (
      <Input
        type="date"
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 text-[12px] px-2 font-mono"
      />
    );
  }

  // TEXTO / URL
  return (
    <Input
      value={typeof valor === "string" ? valor : ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder="valor"
      className="h-7 text-[12px] px-2"
    />
  );
}

function AddFiltroProp({
  filtraveis,
  onAdd,
}: {
  filtraveis: DbProperty[];
  onAdd: (prop: DbProperty) => void;
}) {
  const [aberto, setAberto] = useState(false);
  if (filtraveis.length === 0) {
    return (
      <p className="px-1 text-[11px] text-muted-foreground italic">
        Nenhuma propriedade filtrável.
      </p>
    );
  }
  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar filtro
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Filtrar por
        </DropdownMenuLabel>
        {filtraveis.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => {
              onAdd(p);
              setAberto(false);
            }}
          >
            <LucideIcon name={iconeDoTipo(p.tipo)} className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <span className="flex-1 truncate">{p.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ════════════════════════════════════════════════════════════════════
// ORDENAR (popover) — regras multi-nível propriedade + asc/desc
// ════════════════════════════════════════════════════════════════════
function OrdenarBtn({
  propriedades,
  ordenacoes,
  onChange,
}: {
  propriedades: DbProperty[];
  ordenacoes: Ordenacao[];
  onChange: (ordenacoes: Ordenacao[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const byId = new Map(propriedades.map((p) => [p.id, p]));
  // Propriedades ainda não usadas numa regra (evita ordenar 2x pela mesma).
  const usadas = new Set(ordenacoes.map((o) => o.propertyId));
  const disponiveis = propriedades.filter((p) => !usadas.has(p.id));

  function adicionar(prop: DbProperty) {
    onChange([...ordenacoes, { propertyId: prop.id, direcao: "asc" }]);
  }
  function atualizar(propertyId: string, direcao: Direcao) {
    onChange(ordenacoes.map((o) => (o.propertyId === propertyId ? { ...o, direcao } : o)));
  }
  function remover(propertyId: string) {
    onChange(ordenacoes.filter((o) => o.propertyId !== propertyId));
  }

  const ativos = ordenacoes.filter((o) => byId.has(o.propertyId)).length;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] border transition-colors",
            ativos > 0
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Ordenar"
        >
          <Icons.ArrowUpDown className="h-3.5 w-3.5" />
          Ordenar
          {ativos > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {ativos}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-2 space-y-2">
        {ordenacoes.length === 0 ? (
          <p className="px-1 py-2 text-[12px] text-muted-foreground">
            Sem ordenação. As linhas seguem a ordem manual.
          </p>
        ) : (
          <div className="space-y-1.5">
            {ordenacoes.map((o) => {
              const prop = byId.get(o.propertyId);
              if (!prop) return null;
              return (
                <div
                  key={o.propertyId}
                  className="flex items-center gap-1.5 rounded-md border border-border p-1.5 bg-card/40"
                >
                  <LucideIcon name={iconeDoTipo(prop.tipo)} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[12px] truncate flex-1 min-w-0" title={prop.nome}>
                    {prop.nome}
                  </span>
                  <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => atualizar(o.propertyId, "asc")}
                      className={cn(
                        "h-6 px-1.5 flex items-center gap-1 text-[11px]",
                        o.direcao === "asc"
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                      title="Crescente"
                    >
                      <Icons.ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => atualizar(o.propertyId, "desc")}
                      className={cn(
                        "h-6 px-1.5 flex items-center gap-1 text-[11px] border-l border-border",
                        o.direcao === "desc"
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                      title="Decrescente"
                    >
                      <Icons.ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remover(o.propertyId)}
                    className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 hover:text-destructive"
                    title="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-border pt-2">
          <AddOrdenarProp disponiveis={disponiveis} onAdd={adicionar} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddOrdenarProp({
  disponiveis,
  onAdd,
}: {
  disponiveis: DbProperty[];
  onAdd: (prop: DbProperty) => void;
}) {
  const [aberto, setAberto] = useState(false);
  if (disponiveis.length === 0) {
    return (
      <p className="px-1 text-[11px] text-muted-foreground italic">
        Todas as propriedades já estão na ordenação.
      </p>
    );
  }
  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar ordenação
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Ordenar por
        </DropdownMenuLabel>
        {disponiveis.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => {
              onAdd(p);
              setAberto(false);
            }}
          >
            <LucideIcon name={iconeDoTipo(p.tipo)} className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <span className="flex-1 truncate">{p.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ════════════════════════════════════════════════════════════════════
// VIEW TABELA
// ════════════════════════════════════════════════════════════════════
function TabelaView({
  propriedades,
  linhas,
  onAddColuna,
  onPatchColuna,
  onDeleteColuna,
  onAddLinha,
  onDeleteLinha,
  onSetCelula,
  onAbrirRow,
}: {
  propriedades: DbProperty[];
  linhas: DbRow[];
  onAddColuna: (tipo: PropertyTipo) => void;
  onPatchColuna: (propId: string, campos: Partial<DbProperty>) => void;
  onDeleteColuna: (propId: string) => void;
  onAddLinha: () => void;
  onDeleteLinha: (rowId: string) => void;
  onSetCelula: (rowId: string, propId: string, valor: CellValue) => void;
  onAbrirRow: (rowId: string) => void;
}) {
  const props = useMemo(
    () => [...propriedades].sort((a, b) => a.ordem - b.ordem),
    [propriedades]
  );
  // `linhas` já chega filtrada/ordenada do pai (aplicarView) — não re-ordena.
  const rows = linhas;
  const podeExcluirColuna = props.length > 1;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/40">
            {props.map((p, i) => (
              <th
                key={p.id}
                className={cn(
                  "text-left font-medium border-b border-r border-border px-0 align-middle",
                  i === 0 && "sticky left-0 z-10 bg-muted/40",
                  "min-w-[160px]"
                )}
              >
                <ColunaHeader
                  prop={p}
                  podeExcluir={podeExcluirColuna}
                  onPatch={(campos) => onPatchColuna(p.id, campos)}
                  onDelete={() => onDeleteColuna(p.id)}
                />
              </th>
            ))}
            {/* Botão + coluna */}
            <th className="border-b border-border px-1 w-10">
              <AddColunaBtn onAdd={onAddColuna} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group/row hover:bg-muted/20">
              {props.map((p, i) => (
                <td
                  key={p.id}
                  className={cn(
                    "border-b border-r border-border p-0 align-top",
                    i === 0 && "sticky left-0 z-10 bg-background group-hover/row:bg-muted/20"
                  )}
                >
                  <div className="flex items-stretch">
                    <div className="flex-1 min-w-0">
                      <CelulaEditavel
                        prop={p}
                        valor={row.valores[p.id]}
                        onChange={(v) => onSetCelula(row.id, p.id, v)}
                      />
                    </div>
                    {/* Abrir painel + menu da linha — só na 1ª coluna, no hover */}
                    {i === 0 && (
                      <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover/row:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => onAbrirRow(row.id)}
                          className="h-5 px-1 flex items-center gap-0.5 rounded text-[11px] text-muted-foreground/70 hover:text-foreground hover:bg-muted"
                          title="Abrir linha"
                        >
                          <ChevronRight className="h-3.5 w-3.5" /> abrir
                        </button>
                        <MenuLinha onExcluir={() => onDeleteLinha(row.id)} />
                      </div>
                    )}
                  </div>
                </td>
              ))}
              <td className="border-b border-border" />
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={props.length + 1}
                className="px-3 py-6 text-center text-[13px] text-muted-foreground italic border-b border-border"
              >
                Sem linhas ainda — clique em “+ nova linha”.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={props.length + 1} className="p-0">
              <button
                type="button"
                onClick={onAddLinha}
                className="flex items-center gap-1.5 w-full px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition"
              >
                <Plus className="h-3.5 w-3.5" /> nova linha
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Header de coluna (nome + ícone do tipo + menu) ────────────────
function ColunaHeader({
  prop,
  podeExcluir,
  onPatch,
  onDelete,
}: {
  prop: DbProperty;
  podeExcluir: boolean;
  onPatch: (campos: Partial<DbProperty>) => void;
  onDelete: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
  const [renomeando, setRenomeando] = useState(false);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 group/col">
      <LucideIcon name={iconeDoTipo(prop.tipo)} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {renomeando ? (
        <Input
          autoFocus
          defaultValue={prop.nome}
          onBlur={(e) => {
            setRenomeando(false);
            const v = e.target.value.trim();
            if (v && v !== prop.nome) onPatch({ nome: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            else if (e.key === "Escape") setRenomeando(false);
          }}
          className="h-6 text-[13px] px-1 py-0 flex-1 min-w-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setRenomeando(true)}
          className="flex-1 min-w-0 truncate text-left text-[13px] text-foreground/90 hover:text-foreground"
          title={`${prop.nome} · ${metaDe(prop.tipo).label}`}
        >
          {prop.nome}
        </button>
      )}

      {/* Popover de configuração (opções de SELECT, formato de NÚMERO) */}
      <Popover open={configAberto} onOpenChange={setConfigAberto}>
        <PopoverTrigger asChild>
          <span className="sr-only">Configurar</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <ConfigurarColuna prop={prop} onPatch={onPatch} onFechar={() => setConfigAberto(false)} />
        </PopoverContent>
      </Popover>

      <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted opacity-60 group-hover/col:opacity-100"
            title="Opções da coluna"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setTimeout(() => setRenomeando(true), 0)}>
            <Icons.Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
          </DropdownMenuItem>
          {temConfig(prop.tipo) && (
            <DropdownMenuItem onSelect={() => setTimeout(() => setConfigAberto(true), 0)}>
              <Icons.Settings2 className="h-3.5 w-3.5 mr-2" /> Configurar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Mudar tipo
          </DropdownMenuLabel>
          {TIPOS_COLUNA.map((t) => (
            <DropdownMenuItem
              key={t}
              onSelect={() => {
                if (t !== prop.tipo) onPatch({ tipo: t });
                setMenuAberto(false);
              }}
              className={cn(prop.tipo === t && "bg-accent/50")}
            >
              <LucideIcon name={iconeDoTipo(t)} className="h-3.5 w-3.5 mr-2" />
              {metaDe(t).label}
              {prop.tipo === t && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!podeExcluir}
            onSelect={() => {
              if (!podeExcluir) return;
              if (confirm(`Excluir a coluna "${prop.nome}"?`)) onDelete();
            }}
            className={cn("text-destructive", !podeExcluir && "opacity-40 cursor-not-allowed")}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir coluna
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function temConfig(tipo: PropertyTipo): boolean {
  return tipo === "SELECT" || tipo === "MULTISELECT" || tipo === "NUMERO" || tipo === "RELACAO";
}

// ─── Configurar coluna (opções de SELECT / formato de NÚMERO) ──────
function ConfigurarColuna({
  prop,
  onPatch,
  onFechar,
}: {
  prop: DbProperty;
  onPatch: (campos: Partial<DbProperty>) => void;
  onFechar: () => void;
}) {
  const cfg = lerConfig(prop.config);

  if (prop.tipo === "NUMERO") {
    const formatos: { v: NumeroFormato; label: string }[] = [
      { v: "PLAIN", label: "Número" },
      { v: "INTEIRO", label: "Inteiro" },
      { v: "MOEDA", label: "Moeda (R$)" },
      { v: "PORCENTAGEM", label: "Porcentagem (%)" },
    ];
    return (
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Formato do número
        </p>
        <div className="grid grid-cols-2 gap-1">
          {formatos.map((f) => (
            <button
              key={f.v}
              type="button"
              onClick={() => {
                onPatch({ config: { ...cfg, formato: f.v } });
              }}
              className={cn(
                "px-2 py-1.5 text-[12px] rounded-md border text-left transition-colors",
                (cfg.formato ?? "PLAIN") === f.v
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (prop.tipo === "SELECT" || prop.tipo === "MULTISELECT") {
    return <EditorOpcoes cfg={cfg} onPatch={(c) => onPatch({ config: c })} />;
  }

  if (prop.tipo === "RELACAO") {
    return <RelacaoConfig cfg={cfg} onPatch={(c) => onPatch({ config: c })} />;
  }

  return (
    <p className="text-[12px] text-muted-foreground">
      Este tipo não tem configurações.
    </p>
  );
}

// ─── Configurar RELACAO (escolher o database ALVO) ─────────────────
function RelacaoConfig({
  cfg,
  onPatch,
}: {
  cfg: PropertyConfig;
  onPatch: (config: PropertyConfig) => void;
}) {
  const { lista, loading } = useDatabasesLista();
  const atualId = cfg.databaseAlvoId;
  const alvo = lista.find((d) => d.id === atualId) ?? null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        Database alvo
      </p>
      <p className="text-[10px] text-muted-foreground/70">
        Linhas desta coluna vão linkar pra linhas do database escolhido.
      </p>

      {atualId && (
        <div className="flex items-center gap-1.5 text-[12px] rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <Icons.Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate">{alvo ? alvo.nome : "Database selecionado"}</span>
          <button
            type="button"
            onClick={() => onPatch({ ...cfg, databaseAlvoId: undefined })}
            className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 hover:text-destructive"
            title="Remover alvo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-[11px] text-muted-foreground italic">Carregando databases…</p>
      ) : lista.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhum database disponível.</p>
      ) : (
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {lista.map((d) => {
            const on = d.id === atualId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onPatch({ ...cfg, databaseAlvoId: d.id })}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded text-[12px] text-left hover:bg-muted",
                  on && "bg-accent/50"
                )}
              >
                <span className="text-base leading-none shrink-0">{d.icone || "🗂️"}</span>
                <span className="flex-1 truncate">{d.nome}</span>
                {on && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditorOpcoes({
  cfg,
  onPatch,
}: {
  cfg: PropertyConfig;
  onPatch: (config: PropertyConfig) => void;
}) {
  const opcoes = cfg.opcoes ?? [];
  const [novo, setNovo] = useState("");

  function adicionar() {
    const nome = novo.trim();
    if (!nome) return;
    const op = novaOpcao(nome, opcoes);
    onPatch({ ...cfg, opcoes: [...opcoes, op] });
    setNovo("");
  }
  function renomear(id: string, nome: string) {
    onPatch({ ...cfg, opcoes: opcoes.map((o) => (o.id === id ? { ...o, nome } : o)) });
  }
  function recolorir(id: string, cor: SelectCor) {
    onPatch({ ...cfg, opcoes: opcoes.map((o) => (o.id === id ? { ...o, cor } : o)) });
  }
  function remover(id: string) {
    onPatch({ ...cfg, opcoes: opcoes.filter((o) => o.id !== id) });
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        Opções
      </p>
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {opcoes.map((o) => (
          <div key={o.id} className="flex items-center gap-1">
            <SeletorCor cor={o.cor} onChange={(c) => recolorir(o.id, c)} />
            <Input
              defaultValue={o.nome}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== o.nome) renomear(o.id, v);
              }}
              className="h-7 text-[12px] px-2 flex-1"
            />
            <button
              type="button"
              onClick={() => remover(o.id)}
              className="h-6 w-6 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 hover:text-destructive"
              title="Remover opção"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {opcoes.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">Nenhuma opção ainda.</p>
        )}
      </div>
      <div className="flex items-center gap-1 pt-1 border-t border-border">
        <Input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder="Nova opção…"
          className="h-7 text-[12px] px-2 flex-1"
        />
        <Button size="sm" variant="secondary" className="h-7 px-2" onClick={adicionar}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SeletorCor({ cor, onChange }: { cor: SelectCor; onChange: (c: SelectCor) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("h-5 w-5 shrink-0 rounded-full border border-white/20", SELECT_COR_SWATCH[cor])}
          title="Cor da opção"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex gap-1.5 flex-wrap max-w-[140px]">
          {SELECT_CORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setAberto(false);
              }}
              className={cn(
                "h-5 w-5 rounded-full border-2",
                SELECT_COR_SWATCH[c],
                c === cor ? "border-foreground" : "border-transparent"
              )}
              title={c}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Botão "+ coluna" (escolher tipo) ──────────────────────────────
function AddColunaBtn({ onAdd }: { onAdd: (tipo: PropertyTipo) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="h-7 w-7 mx-auto flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Adicionar coluna"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Nova coluna
        </DropdownMenuLabel>
        {TIPOS_COLUNA.map((t) => {
          const meta = metaDe(t);
          return (
            <DropdownMenuItem
              key={t}
              onSelect={() => {
                onAdd(t);
                setAberto(false);
              }}
            >
              <LucideIcon name={meta.icone} className="h-3.5 w-3.5 mr-2" />
              <span className="flex-1">{meta.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Menu da linha ─────────────────────────────────────────────────
function MenuLinha({ onExcluir }: { onExcluir: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted"
          title="Opções da linha"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem
          onSelect={() => {
            if (confirm("Excluir esta linha?")) onExcluir();
          }}
          className="text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir linha
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
// ════════════════════════════════════════════════════════════════════
// Inline genéricos (nome/descrição do header)
// ════════════════════════════════════════════════════════════════════
function TextoEditavel({
  inicial,
  onSave,
  placeholder,
  className,
  inputClassName,
  multiline,
}: {
  inicial: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(inicial);
  useEffect(() => setValor(inicial), [inicial]);

  function salvar() {
    setEditando(false);
    if (valor.trim() !== inicial.trim()) onSave(valor.trim());
  }

  if (editando) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValor(inicial);
              setEditando(false);
            }
          }}
          rows={2}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:ring-2 focus:ring-ring resize-y",
            inputClassName
          )}
        />
      );
    }
    return (
      <Input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setValor(inicial);
            setEditando(false);
          }
        }}
        placeholder={placeholder}
        className={cn(inputClassName)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className={cn("text-left cursor-text", className)}
      title="Clique pra editar"
    >
      {valor || <span className="text-muted-foreground/50">{placeholder}</span>}
    </button>
  );
}

function EmojiBotao({
  inicial,
  fallback,
  onSave,
}: {
  inicial: string;
  fallback: string;
  onSave: (v: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(inicial);
  useEffect(() => setValor(inicial), [inicial]);

  if (editando) {
    return (
      <Input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          setEditando(false);
          if (valor !== inicial) onSave(valor);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setValor(inicial);
            setEditando(false);
          }
        }}
        maxLength={4}
        placeholder="🙂"
        className="h-10 w-12 text-center text-xl shrink-0"
        aria-label="Ícone do database (emoji)"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="h-10 w-10 shrink-0 flex items-center justify-center text-2xl rounded-md hover:bg-secondary/60 transition"
      title="Clique pra escolher um emoji"
    >
      {valor || fallback}
    </button>
  );
}
