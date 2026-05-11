/**
 * Helper genérico de export CSV no browser.
 *
 * Recebe array de objetos + mapeamento de colunas, gera CSV com BOM
 * UTF-8 (pra Excel abrir acentos certo), escapa aspas/quebras, dispara
 * download via Blob URL temporário.
 *
 * Por que CSV e não XLSX:
 *  - Zero deps (XLSX exige sheetjs/exceljs, +200KB no bundle)
 *  - Excel abre CSV direto com double-click
 *  - Google Sheets / Looker importam CSV nativamente
 *  - Compatível com upload de Custom Audience no Meta Ads
 *
 * Separador padrão: `;` (vírgula é problema com números BR "2.500,50"
 * que viram "2,500,50" no CSV — usar `;` evita ambiguidade).
 */

export type Coluna<T> = {
  /** Cabeçalho exibido na primeira linha do CSV */
  header: string;
  /** Função que extrai/formata o valor da linha */
  get: (row: T) => string | number | null | undefined;
};

export function exportarCsv<T>(
  filename: string,
  rows: T[],
  colunas: Coluna<T>[],
  opts: { delimiter?: "," | ";" | "\t"; bom?: boolean } = {}
): void {
  const delim = opts.delimiter ?? ";";
  const bom = opts.bom ?? true;

  const linhas: string[] = [];
  linhas.push(colunas.map((c) => escapar(c.header, delim)).join(delim));
  for (const row of rows) {
    linhas.push(colunas.map((c) => escapar(c.get(row), delim)).join(delim));
  }

  const csv = linhas.join("\r\n");
  // BOM UTF-8 (U+FEFF) — força Excel a interpretar como UTF-8 e renderizar acentos
  const payload = bom ? "﻿" + csv : csv;
  const blob = new Blob([payload], { type: "text/csv;charset=utf-8" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libera memória do Blob URL após o tick
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Escapa um valor pra CSV — envolve em aspas se contém delimitador,
 * quebra de linha ou aspas. Aspas internas viram aspas duplas (RFC 4180).
 */
function escapar(v: string | number | null | undefined, delim: string): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  const precisaAspas = s.includes(delim) || s.includes("\n") || s.includes("\r") || s.includes('"');
  if (!precisaAspas) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Timestamp formatado pra nome de arquivo: "2026-05-11_15-42"
 */
export function timestampArquivo(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}
