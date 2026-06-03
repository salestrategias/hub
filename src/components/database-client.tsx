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
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import {
  Plus, Trash2, MoreHorizontal, Table as TableIcon,
  GripVertical, X, ExternalLink, Check,
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
  type PropertyConfig, type SelectOption, type SelectCor, type CellValue,
  type NumeroFormato,
  lerConfig, coerceValor, formatarNumero, formatarData,
  metaDe, iconeDoTipo, TIPOS_DISPONIVEIS,
  SELECT_CORES, SELECT_COR_CLASSES, SELECT_COR_SWATCH,
  novaOpcao,
} from "@/lib/database";
import type { PropertyTipo, ViewTipo } from "@prisma/client";

// ─── Tipos do payload (serializado do server) ──────────────────────
export type DbProperty = {
  id: string;
  nome: string;
  tipo: PropertyTipo;
  config: unknown;
  ordem: number;
};
export type DbView = {
  id: string;
  nome: string;
  tipo: ViewTipo;
  config: unknown;
  ordem: number;
};
export type DbRow = {
  id: string;
  valores: Record<string, unknown>;
  ordem: number;
};
export type DatabaseFull = {
  id: string;
  nome: string;
  icone: string | null;
  descricao: string | null;
  parentPageId: string | null;
  propriedades: DbProperty[];
  views: DbView[];
  linhas: DbRow[];
};

// ─── Ícone lucide dinâmico por nome (do engine) ────────────────────
function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Cmp) return <TableIcon className={className} />;
  return <Cmp className={className} />;
}

// ─── helper fetch JSON com erro ────────────────────────────────────
async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Falha na operação");
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

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
  async function addLinha() {
    try {
      const nova: { id: string; valores: Record<string, unknown>; ordem: number } = await api(
        `/api/databases/${db.id}/rows`,
        "POST",
        {}
      );
      setDb((d) => ({
        ...d,
        linhas: [...d.linhas, { id: nova.id, valores: nova.valores ?? {}, ordem: nova.ordem }],
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar linha");
    }
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

  return (
    <div className="space-y-4">
      <DatabaseHeader db={db} onPatch={patchDb} />

      {/* Barra de views (abas). Só Tabela funciona neste bloco. */}
      <BarraViews
        views={db.views}
        ativaId={viewAtiva?.id ?? ""}
        onTrocar={setViewAtivaId}
        dbId={db.id}
        onRenomeada={(viewId, nome) =>
          setDb((d) => ({
            ...d,
            views: d.views.map((v) => (v.id === viewId ? { ...v, nome } : v)),
          }))
        }
      />

      {/* View ativa */}
      {viewAtiva?.tipo === "TABELA" ? (
        <TabelaView
          propriedades={db.propriedades}
          linhas={db.linhas}
          onAddColuna={addColuna}
          onPatchColuna={patchColuna}
          onDeleteColuna={deleteColuna}
          onAddLinha={addLinha}
          onDeleteLinha={deleteLinha}
          onSetCelula={setCelula}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          A view <strong>{viewAtiva?.nome}</strong> ({viewAtiva?.tipo}) chega num próximo bloco.
          Use a aba <strong>Tabela</strong> por enquanto.
        </div>
      )}
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
  ativaId,
  onTrocar,
  dbId,
  onRenomeada,
}: {
  views: DbView[];
  ativaId: string;
  onTrocar: (id: string) => void;
  dbId: string;
  onRenomeada: (viewId: string, nome: string) => void;
}) {
  async function renomear(view: DbView) {
    const nome = window.prompt("Nome da view:", view.nome);
    if (nome == null) return;
    const limpo = nome.trim() || "Tabela";
    onRenomeada(view.id, limpo);
    try {
      await api(`/api/databases/${dbId}/views/${view.id}`, "PATCH", { nome: limpo });
    } catch {
      toast.error("Falha ao renomear view");
    }
  }

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {views.map((v) => {
        const ativo = v.id === ativaId;
        const desabilitada = v.tipo !== "TABELA";
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => !desabilitada && onTrocar(v.id)}
            onDoubleClick={() => renomear(v)}
            disabled={desabilitada}
            title={desabilitada ? "Disponível num próximo bloco" : "Duplo-clique pra renomear"}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-[13px] -mb-px border-b-2 transition-colors",
              ativo
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
              desabilitada && "opacity-40 cursor-not-allowed"
            )}
          >
            <LucideIcon name={VIEW_ICONE[v.tipo]} className="h-3.5 w-3.5" />
            {v.nome}
          </button>
        );
      })}
      {/* Placeholder "+ view" — criação de views chega num próximo bloco. */}
      <span
        className="inline-flex items-center gap-1 px-2 py-2 text-[13px] text-muted-foreground/40 cursor-not-allowed"
        title="Novas views (Board/Calendário) chegam num próximo bloco"
      >
        <Plus className="h-3.5 w-3.5" />
      </span>
    </div>
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
}: {
  propriedades: DbProperty[];
  linhas: DbRow[];
  onAddColuna: (tipo: PropertyTipo) => void;
  onPatchColuna: (propId: string, campos: Partial<DbProperty>) => void;
  onDeleteColuna: (propId: string) => void;
  onAddLinha: () => void;
  onDeleteLinha: (rowId: string) => void;
  onSetCelula: (rowId: string, propId: string, valor: CellValue) => void;
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
                    {/* Menu da linha — só na 1ª coluna, aparece no hover */}
                    {i === 0 && (
                      <div className="flex items-center pr-1 opacity-0 group-hover/row:opacity-100 transition">
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
// Célula editável — switch por tipo
// ════════════════════════════════════════════════════════════════════
function CelulaEditavel({
  prop,
  valor,
  onChange,
}: {
  prop: DbProperty;
  valor: unknown;
  onChange: (v: CellValue) => void;
}) {
  const cfg = lerConfig(prop.config);
  // Normaliza o valor cru pro formato canônico antes de renderizar.
  const v = coerceValor(prop.tipo, valor, cfg);

  switch (prop.tipo) {
    case "NUMERO":
      return <CelulaNumero valor={v as number | null} cfg={cfg} onChange={onChange} />;
    case "CHECKBOX":
      return <CelulaCheckbox valor={v as boolean} onChange={onChange} />;
    case "SELECT":
      return <CelulaSelect valor={v as string | null} cfg={cfg} onChange={onChange} />;
    case "MULTISELECT":
      return <CelulaMultiSelect valor={v as string[]} cfg={cfg} onChange={onChange} />;
    case "DATA":
      return <CelulaData valor={v as string | null} onChange={onChange} />;
    case "URL":
      return <CelulaUrl valor={v as string} onChange={onChange} />;
    case "RELACAO":
      return (
        <div className="px-2 py-1.5 text-[12px] text-muted-foreground/60 italic">
          relação (próximo bloco)
        </div>
      );
    default:
      return <CelulaTexto valor={v as string} onChange={onChange} />;
  }
}

// ── TEXTO (input, debounce) ────────────────────────────────────────
function CelulaTexto({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(valor);
  const timer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => setLocal(valor), [valor]);

  function digitar(novo: string) {
    setLocal(novo);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(novo), 600);
  }
  function flush() {
    if (timer.current) clearTimeout(timer.current);
    if (local !== valor) onChange(local);
  }

  return (
    <input
      value={local}
      onChange={(e) => digitar(e.target.value)}
      onBlur={flush}
      className="w-full bg-transparent px-2 py-1.5 text-[13px] outline-none focus:bg-muted/40"
    />
  );
}

// ── NÚMERO (number, debounce, exibe formatado quando blur) ─────────
function CelulaNumero({
  valor,
  cfg,
  onChange,
}: {
  valor: number | null;
  cfg: PropertyConfig;
  onChange: (v: CellValue) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [local, setLocal] = useState(valor == null ? "" : String(valor));
  const timer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!editando) setLocal(valor == null ? "" : String(valor));
  }, [valor, editando]);

  function digitar(novo: string) {
    setLocal(novo);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onChange(novo === "" ? null : coerceValor("NUMERO", novo, cfg));
    }, 600);
  }
  function flush() {
    if (timer.current) clearTimeout(timer.current);
    setEditando(false);
    onChange(local === "" ? null : coerceValor("NUMERO", local, cfg));
  }

  if (editando) {
    return (
      <input
        autoFocus
        type="number"
        value={local}
        onChange={(e) => digitar(e.target.value)}
        onBlur={flush}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        className="w-full bg-transparent px-2 py-1.5 text-[13px] font-mono outline-none focus:bg-muted/40"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="w-full text-left px-2 py-1.5 text-[13px] font-mono hover:bg-muted/30 min-h-[30px]"
    >
      {valor == null ? (
        <span className="text-muted-foreground/40">—</span>
      ) : (
        formatarNumero(valor, cfg)
      )}
    </button>
  );
}

// ── CHECKBOX ───────────────────────────────────────────────────────
function CelulaCheckbox({ valor, onChange }: { valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-center px-2 py-1.5 min-h-[30px]">
      <button
        type="button"
        role="checkbox"
        aria-checked={valor}
        onClick={() => onChange(!valor)}
        className={cn(
          "h-4 w-4 rounded border flex items-center justify-center transition-colors",
          valor ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background hover:border-primary"
        )}
      >
        {valor && <Check className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ── SELECT (uma opção colorida) ────────────────────────────────────
function CelulaSelect({
  valor,
  cfg,
  onChange,
}: {
  valor: string | null;
  cfg: PropertyConfig;
  onChange: (v: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const opcoes = cfg.opcoes ?? [];
  const atual = opcoes.find((o) => o.id === valor) ?? null;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left px-2 py-1.5 min-h-[30px] hover:bg-muted/30 flex items-center"
        >
          {atual ? (
            <ChipOpcao opcao={atual} />
          ) : (
            <span className="text-muted-foreground/40 text-[13px]">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <ListaOpcoes
          opcoes={opcoes}
          selecionadas={valor ? [valor] : []}
          onToggle={(id) => {
            onChange(valor === id ? null : id);
            setAberto(false);
          }}
          permitirLimpar={!!valor}
          onLimpar={() => {
            onChange(null);
            setAberto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ── MULTISELECT (chips multi) ──────────────────────────────────────
function CelulaMultiSelect({
  valor,
  cfg,
  onChange,
}: {
  valor: string[];
  cfg: PropertyConfig;
  onChange: (v: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const opcoes = cfg.opcoes ?? [];
  const selec = opcoes.filter((o) => valor.includes(o.id));

  function toggle(id: string) {
    onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left px-2 py-1.5 min-h-[30px] hover:bg-muted/30 flex items-center gap-1 flex-wrap"
        >
          {selec.length ? (
            selec.map((o) => <ChipOpcao key={o.id} opcao={o} />)
          ) : (
            <span className="text-muted-foreground/40 text-[13px]">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <ListaOpcoes opcoes={opcoes} selecionadas={valor} onToggle={toggle} multi />
      </PopoverContent>
    </Popover>
  );
}

function ChipOpcao({ opcao }: { opcao: SelectOption }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11.5px] font-medium border",
        SELECT_COR_CLASSES[opcao.cor]
      )}
    >
      {opcao.nome}
    </span>
  );
}

function ListaOpcoes({
  opcoes,
  selecionadas,
  onToggle,
  multi,
  permitirLimpar,
  onLimpar,
}: {
  opcoes: SelectOption[];
  selecionadas: string[];
  onToggle: (id: string) => void;
  multi?: boolean;
  permitirLimpar?: boolean;
  onLimpar?: () => void;
}) {
  if (opcoes.length === 0) {
    return (
      <p className="px-2 py-3 text-[12px] text-muted-foreground text-center">
        Sem opções. Configure a coluna (menu ⋯ → Configurar).
      </p>
    );
  }
  return (
    <div className="space-y-0.5 max-h-60 overflow-y-auto">
      {permitirLimpar && onLimpar && (
        <button
          type="button"
          onClick={onLimpar}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[12px] text-muted-foreground hover:bg-muted"
        >
          <X className="h-3 w-3" /> Limpar
        </button>
      )}
      {opcoes.map((o) => {
        const on = selecionadas.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left"
          >
            {multi && (
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                  on ? "bg-primary border-primary text-primary-foreground" : "border-input"
                )}
              >
                {on && <Check className="h-2.5 w-2.5" />}
              </span>
            )}
            <ChipOpcao opcao={o} />
            {!multi && on && <Check className="h-3.5 w-3.5 ml-auto text-foreground" />}
          </button>
        );
      })}
    </div>
  );
}

// ── DATA ───────────────────────────────────────────────────────────
function CelulaData({ valor, onChange }: { valor: string | null; onChange: (v: string | null) => void }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <input
        autoFocus
        type="date"
        defaultValue={valor ?? ""}
        onBlur={(e) => {
          setEditando(false);
          const v = e.target.value;
          onChange(v || null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        className="w-full bg-transparent px-2 py-1.5 text-[13px] font-mono outline-none focus:bg-muted/40"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="w-full text-left px-2 py-1.5 text-[13px] hover:bg-muted/30 min-h-[30px] flex items-center"
    >
      {valor ? (
        <span className="inline-flex items-center gap-1.5">
          <Icons.Calendar className="h-3 w-3 text-muted-foreground" />
          {formatarData(valor)}
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      )}
    </button>
  );
}

// ── URL (link clicável + edição inline) ────────────────────────────
function CelulaUrl({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [local, setLocal] = useState(valor);
  useEffect(() => setLocal(valor), [valor]);

  if (editando) {
    return (
      <input
        autoFocus
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          setEditando(false);
          if (local !== valor) onChange(local);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setLocal(valor);
            setEditando(false);
          }
        }}
        placeholder="https://…"
        className="w-full bg-transparent px-2 py-1.5 text-[13px] outline-none focus:bg-muted/40"
      />
    );
  }
  return (
    <div className="group/url flex items-center gap-1 px-2 py-1.5 min-h-[30px]">
      {valor ? (
        <>
          <a
            href={hrefSeguro(valor)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-primary hover:underline truncate flex items-center gap-1 min-w-0"
            title={valor}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{valor}</span>
          </a>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="opacity-0 group-hover/url:opacity-100 text-muted-foreground/60 hover:text-foreground shrink-0"
            title="Editar"
          >
            <Icons.Pencil className="h-3 w-3" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="w-full text-left text-muted-foreground/40 text-[13px]"
        >
          —
        </button>
      )}
    </div>
  );
}

function hrefSeguro(url: string): string {
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("mailto:")) return u;
  return `https://${u}`;
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
