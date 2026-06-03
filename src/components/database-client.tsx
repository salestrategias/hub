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
  novaOpcao,
} from "@/lib/database";
import type { PropertyTipo, ViewTipo } from "@prisma/client";
import {
  type DbProperty, type DbView, type DbRow, type DatabaseFull, type ViewConfig,
  LucideIcon, api, CelulaEditavel, lerViewConfig,
} from "@/components/database-cells";
import { RowPanel } from "@/components/database-row-panel";
import { BoardView } from "@/components/database-board";

// Re-export dos tipos do payload (consumidos por quem importa este módulo).
export type { DbProperty, DbView, DbRow, DatabaseFull };

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

  const viewCfg = viewAtiva ? lerViewConfig(viewAtiva.config) : {};

  return (
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
      />

      {/* View ativa */}
      {viewAtiva?.tipo === "BOARD" ? (
        <BoardView
          propriedades={db.propriedades}
          linhas={db.linhas}
          config={viewCfg}
          onSetCelula={(rowId, propId, valor) => setCelula(rowId, propId, valor)}
          onAddCard={addCardBoard}
          onAbrirRow={setRowPanelId}
          onConfigurar={() => setConfigViewId(viewAtiva.id)}
        />
      ) : viewAtiva?.tipo === "TABELA" ? (
        <TabelaView
          propriedades={db.propriedades}
          linhas={db.linhas}
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
          Use as abas <strong>Tabela</strong> ou <strong>Board</strong> por enquanto.
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

  return (
    <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
      {ordenadas.map((v) => {
        const ativo = v.id === ativaId;
        const desabilitada = v.tipo === "CALENDARIO"; // Calendário: próximo bloco.
        return (
          <div key={v.id} className="flex items-center -mb-px shrink-0">
            <button
              type="button"
              onClick={() => !desabilitada && onTrocar(v.id)}
              onDoubleClick={() => !desabilitada && renomear(v)}
              disabled={desabilitada}
              title={desabilitada ? "Calendário chega num próximo bloco" : "Duplo-clique pra renomear"}
              className={cn(
                "inline-flex items-center gap-1.5 pl-3 pr-1.5 py-2 text-[13px] border-b-2 transition-colors",
                ativo
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                desabilitada && "opacity-40 cursor-not-allowed"
              )}
            >
              <LucideIcon name={VIEW_ICONE[v.tipo]} className="h-3.5 w-3.5" />
              {v.nome}
              {desabilitada && <span className="text-[10px] text-muted-foreground/60">(em breve)</span>}
            </button>

            {/* Config + menu da view (só na aba ativa e habilitada) */}
            {ativo && !desabilitada && (
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

      {/* "+ view" — escolhe Tabela / Board (Calendário em breve). */}
      <AddViewBtn onAdd={onAddView} />
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
  const tipos: { tipo: ViewTipo; label: string; desabilitada?: boolean }[] = [
    { tipo: "TABELA", label: "Tabela" },
    { tipo: "BOARD", label: "Board" },
    { tipo: "CALENDARIO", label: "Calendário", desabilitada: true },
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
            disabled={t.desabilitada}
            onSelect={() => {
              if (t.desabilitada) return;
              onAdd(t.tipo);
              setAberto(false);
            }}
            className={cn(t.desabilitada && "opacity-40 cursor-not-allowed")}
          >
            <LucideIcon name={VIEW_ICONE[t.tipo]} className="h-3.5 w-3.5 mr-2" />
            <span className="flex-1">{t.label}</span>
            {t.desabilitada && <span className="text-[10px] text-muted-foreground/60">em breve</span>}
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
  const rows = useMemo(() => [...linhas].sort((a, b) => a.ordem - b.ordem), [linhas]);
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
          {TIPOS_DISPONIVEIS.map((t) => (
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
  return tipo === "SELECT" || tipo === "MULTISELECT" || tipo === "NUMERO";
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

  return (
    <p className="text-[12px] text-muted-foreground">
      Este tipo não tem configurações.
    </p>
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
        {TIPOS_DISPONIVEIS.map((t) => {
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
