"use client";
/**
 * database-calendar.tsx — VIEW CALENDÁRIO (grade mensal) de um database.
 *
 * Posiciona as rows numa grade de mês por `config.datePropertyId` (uma coluna
 * do tipo DATA). Cada row vira um chip no dia correspondente (título via
 * tituloDaRow). Navegação de mês (‹ Hoje ›) com label "junho 2026".
 *  - Clicar num dia VAZIO → cria a row com aquela data e abre o painel.
 *  - Clicar num CHIP → abre o painel da row.
 *
 * Respeita filtros/ordenação (o pai passa rows já por aplicarView). Se a
 * propriedade de data não estiver setada, mostra aviso + atalho pra config.
 * ZERO <style jsx>. Comportamento por tipo vem do engine (database.ts).
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Settings2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { coerceValor, lerConfig } from "@/lib/database";
import {
  type DbProperty, type DbRow, type ViewConfig, tituloDaRow,
} from "@/components/database-cells";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// ─── Helpers de data (UTC, sem timezone shift — espelha formatarData) ──
/** "YYYY-MM-DD" do par (ano, mês 0-based, dia). */
function isoDe(ano: number, mes: number, dia: number): string {
  const mm = String(mes + 1).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

/** Label "junho 2026" do mês exibido. */
function rotuloMes(ano: number, mes: number): string {
  return new Date(Date.UTC(ano, mes, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CalendarView({
  propriedades,
  linhas,
  config,
  onCriarNoDia,
  onAbrirRow,
  onConfigurar,
}: {
  propriedades: DbProperty[];
  /** Rows JÁ filtradas/ordenadas pelo pai (aplicarView). */
  linhas: DbRow[];
  config: ViewConfig;
  /** Cria a row com `{ [datePropertyId]: iso }` e abre o painel. */
  onCriarNoDia: (iso: string) => void;
  onAbrirRow: (rowId: string) => void;
  onConfigurar: () => void;
}) {
  const dateProp = useMemo(
    () => propriedades.find((p) => p.id === config.datePropertyId) ?? null,
    [propriedades, config.datePropertyId]
  );

  // Mês exibido (default: hoje). Guardado como {ano, mes 0-based}.
  const hoje = new Date();
  const [cursor, setCursor] = useState<{ ano: number; mes: number }>({
    ano: hoje.getFullYear(),
    mes: hoje.getMonth(),
  });

  // Sem propriedade de data válida → aviso + atalho pra config.
  if (!dateProp || dateProp.tipo !== "DATA") {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Escolha uma propriedade <strong>de data</strong> pra montar o calendário.
        </p>
        <button
          type="button"
          onClick={onConfigurar}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-muted"
        >
          <Settings2 className="h-3.5 w-3.5" /> Configurar propriedade de data
        </button>
      </div>
    );
  }

  // Agrupa rows por dia ("YYYY-MM-DD"). Ordem do pai já vem aplicada.
  const porDia = new Map<string, DbRow[]>();
  for (const row of linhas) {
    const v = coerceValor("DATA", row.valores[dateProp.id], lerConfig(dateProp.config));
    if (typeof v !== "string" || !v) continue;
    const lista = porDia.get(v);
    if (lista) lista.push(row);
    else porDia.set(v, [row]);
  }

  // Monta a grade: semanas começando no domingo que contém/precede o dia 1.
  const primeiroDia = new Date(Date.UTC(cursor.ano, cursor.mes, 1));
  const diaSemanaInicio = primeiroDia.getUTCDay(); // 0 = domingo
  const diasNoMes = new Date(Date.UTC(cursor.ano, cursor.mes + 1, 0)).getUTCDate();
  const totalCelulas = Math.ceil((diaSemanaInicio + diasNoMes) / 7) * 7;

  type Celula = { iso: string; dia: number; doMes: boolean };
  const celulas: Celula[] = [];
  for (let i = 0; i < totalCelulas; i++) {
    // offset relativo ao dia 1 (pode ser negativo = mês anterior).
    const offset = i - diaSemanaInicio;
    const d = new Date(Date.UTC(cursor.ano, cursor.mes, 1 + offset));
    celulas.push({
      iso: isoDe(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      dia: d.getUTCDate(),
      doMes: d.getUTCMonth() === cursor.mes,
    });
  }

  const hojeIso = isoDe(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  function irMes(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.ano, c.mes + delta, 1));
      return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() };
    });
  }
  function irHoje() {
    setCursor({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho: navegação de mês + label. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-display text-base font-semibold capitalize truncate">
            {rotuloMes(cursor.ano, cursor.mes)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => irMes(-1)}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={irHoje}
            className="h-7 px-2.5 flex items-center rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => irMes(1)}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grade do mês. */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Cabeçalho dos dias da semana. */}
        <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-center"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Células. */}
        <div className="grid grid-cols-7">
          {celulas.map((cel) => {
            const rows = porDia.get(cel.iso) ?? [];
            const ehHoje = cel.iso === hojeIso;
            return (
              <DiaCelula
                key={cel.iso}
                iso={cel.iso}
                dia={cel.dia}
                doMes={cel.doMes}
                ehHoje={ehHoje}
                rows={rows}
                propriedades={propriedades}
                onCriarNoDia={onCriarNoDia}
                onAbrirRow={onAbrirRow}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Uma célula (dia) da grade ─────────────────────────────────────────
function DiaCelula({
  iso,
  dia,
  doMes,
  ehHoje,
  rows,
  propriedades,
  onCriarNoDia,
  onAbrirRow,
}: {
  iso: string;
  dia: number;
  doMes: boolean;
  ehHoje: boolean;
  rows: DbRow[];
  propriedades: DbProperty[];
  onCriarNoDia: (iso: string) => void;
  onAbrirRow: (rowId: string) => void;
}) {
  return (
    <div
      className={cn(
        "group/dia relative min-h-[104px] border-b border-r border-border p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0",
        doMes ? "bg-background" : "bg-muted/20"
      )}
    >
      {/* Número do dia + (no hover) atalho de criar. */}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <span
          className={cn(
            "text-[12px] tabular-nums",
            ehHoje
              ? "h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
              : doMes
                ? "text-foreground/80"
                : "text-muted-foreground/50"
          )}
        >
          {dia}
        </span>
        <button
          type="button"
          onClick={() => onCriarNoDia(iso)}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted opacity-0 group-hover/dia:opacity-100 transition"
          title="Criar linha neste dia"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Chips das rows do dia. */}
      <div className="mt-1 space-y-1">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onAbrirRow(row.id)}
            className="block w-full text-left truncate rounded px-1.5 py-1 text-[11.5px] font-medium border border-primary/20 bg-primary/10 text-foreground/90 hover:bg-primary/20 transition"
            title={tituloDaRow(propriedades, row)}
          >
            {tituloDaRow(propriedades, row)}
          </button>
        ))}
      </div>

      {/* Área clicável do dia vazio (cria row). Fica atrás dos chips/botões. */}
      {rows.length === 0 && (
        <button
          type="button"
          onClick={() => onCriarNoDia(iso)}
          className="absolute inset-0 z-0"
          aria-label={`Criar linha em ${iso}`}
          tabIndex={-1}
        />
      )}
    </div>
  );
}
