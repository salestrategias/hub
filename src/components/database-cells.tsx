"use client";
/**
 * database-cells.tsx — peças de UI COMPARTILHADAS dos databases (estilo Notion).
 *
 * Extraído de database-client.tsx (view TABELA) pra ser reusado também no
 * PAINEL DA LINHA (database-row-panel) e nos CARDS do BOARD (database-board),
 * sem duplicar lógica. O comportamento por tipo continua vindo do engine
 * (src/lib/database.ts) — aqui é só a casca de UI. ZERO <style jsx>.
 *
 * Exporta:
 *  - tipos do payload (DbProperty/DbView/DbRow/DatabaseFull)
 *  - LucideIcon (ícone lucide por nome)
 *  - api() (fetch JSON com erro)
 *  - CelulaEditavel (switch de editor inline por tipo) + ChipOpcao
 *  - tituloDaRow / resumoValor (helpers de exibição pros cards do board)
 */
import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { Table as TableIcon, X, ExternalLink, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  type PropertyConfig,
  type SelectOption,
  type CellValue,
  lerConfig,
  coerceValor,
  formatarNumero,
  formatarData,
  SELECT_COR_CLASSES,
} from "@/lib/database";
import {
  type Filtro, type Ordenacao, lerFiltros, lerOrdenacoes,
} from "@/lib/database-query";
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

/** Convenção do config das views (Json livre). */
export type ViewConfig = {
  groupByPropertyId?: string;
  datePropertyId?: string;
  propsVisiveis?: string[];
  /** Filtros/ordenação aplicados em TODAS as views (engine: database-query). */
  filtros?: Filtro[];
  ordenacoes?: Ordenacao[];
};
export function lerViewConfig(config: unknown): ViewConfig {
  if (!config || typeof config !== "object") return {};
  const c = config as Record<string, unknown>;
  const out: ViewConfig = {};
  if (typeof c.groupByPropertyId === "string") out.groupByPropertyId = c.groupByPropertyId;
  if (typeof c.datePropertyId === "string") out.datePropertyId = c.datePropertyId;
  if (Array.isArray(c.propsVisiveis)) {
    out.propsVisiveis = c.propsVisiveis.filter((x): x is string => typeof x === "string");
  }
  const filtros = lerFiltros(c.filtros);
  if (filtros.length) out.filtros = filtros;
  const ordenacoes = lerOrdenacoes(c.ordenacoes);
  if (ordenacoes.length) out.ordenacoes = ordenacoes;
  return out;
}

// ─── Ícone lucide dinâmico por nome (do engine) ────────────────────
export function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Cmp) return <TableIcon className={className} />;
  return <Cmp className={className} />;
}

// ─── helper fetch JSON com erro ────────────────────────────────────
export async function api(url: string, method: string, body?: unknown) {
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
// Célula editável — switch por tipo (reusada na tabela, no painel e nos cards)
// ════════════════════════════════════════════════════════════════════
export function CelulaEditavel({
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
    <div className="flex items-center px-2 py-1.5 min-h-[30px]">
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

export function ChipOpcao({ opcao }: { opcao: SelectOption }) {
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
// Helpers de exibição (read-only) — usados nos cards do BOARD
// ════════════════════════════════════════════════════════════════════
/** Título de uma row = valor (texto) da 1ª propriedade por ordem. */
export function tituloDaRow(props: DbProperty[], row: DbRow): string {
  const tituloProp = [...props].sort((a, b) => a.ordem - b.ordem)[0];
  if (!tituloProp) return "Sem título";
  const v = coerceValor(tituloProp.tipo, row.valores[tituloProp.id], lerConfig(tituloProp.config));
  if (v == null || (typeof v === "string" && v.trim() === "")) return "Sem título";
  if (Array.isArray(v)) return v.length ? "(múltiplos)" : "Sem título";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (tituloProp.tipo === "NUMERO" && typeof v === "number") {
    return formatarNumero(v, lerConfig(tituloProp.config));
  }
  return String(v);
}

/**
 * Resumo read-only de UMA propriedade pra badges nos cards do board.
 * Retorna null se a célula está vazia (não renderiza nada).
 */
export function ResumoValor({ prop, row }: { prop: DbProperty; row: DbRow }) {
  const cfg = lerConfig(prop.config);
  const v = coerceValor(prop.tipo, row.valores[prop.id], cfg);

  if (prop.tipo === "SELECT") {
    const op = (cfg.opcoes ?? []).find((o) => o.id === v);
    return op ? <ChipOpcao opcao={op} /> : null;
  }
  if (prop.tipo === "MULTISELECT") {
    const sel = (cfg.opcoes ?? []).filter((o) => (v as string[]).includes(o.id));
    if (!sel.length) return null;
    return (
      <>
        {sel.map((o) => (
          <ChipOpcao key={o.id} opcao={o} />
        ))}
      </>
    );
  }
  if (prop.tipo === "CHECKBOX") {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <span
          className={cn(
            "h-3 w-3 rounded border flex items-center justify-center",
            v ? "bg-primary border-primary text-primary-foreground" : "border-input"
          )}
        >
          {v ? <Check className="h-2 w-2" /> : null}
        </span>
        {prop.nome}
      </span>
    );
  }
  if (v == null || (typeof v === "string" && v.trim() === "")) return null;

  let texto: string;
  if (prop.tipo === "NUMERO" && typeof v === "number") texto = formatarNumero(v, cfg);
  else if (prop.tipo === "DATA" && typeof v === "string") texto = formatarData(v);
  else texto = String(v);

  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border border-border bg-muted/40 text-muted-foreground max-w-full truncate">
      {texto}
    </span>
  );
}
