/**
 * Parser CSV/TSV tolerante a vários formatos de export.
 *
 * Por que escrevemos um do zero ao invés de usar Papaparse:
 *  - Volume estimado é baixo (~500 rows/import) → sem ganho perf real
 *  - Evitamos +30kb de bundle no client
 *  - Precisamos de auto-detect de delimitador (Meta Ads, Google Ads, Sheets
 *    BR e Looker usam separadores diferentes — `,`, `;`, `\t`)
 *  - Precisamos de header fuzzy match ("Investimento", "Investido (R$)" e
 *    "Spend" todos devem mapear pro mesmo campo). Bibliotecas genéricas
 *    não fazem isso.
 *
 * Pipeline:
 *   raw text → detect delimitador → split em rows respeitando aspas →
 *   primeira row = headers → normalizar headers (lower + sem acento +
 *   trim) → rows seguintes viram objetos { headerNormalizado: valor }
 *
 * Headers fuzzy match acontece num passo posterior (mapeadores),
 * usando dicionários por fonte. Aqui apenas normalizamos chaves.
 */

export type ParsedCsv = {
  headers: string[];               // headers originais (pra UI)
  headersNorm: string[];           // headers normalizados (pra mapeador)
  rows: Record<string, string>[];  // chaves = headersNorm
  delimiter: "," | ";" | "\t";
  totalLinhas: number;
};

/**
 * Parsea texto CSV/TSV. Lança Error se não conseguir detectar formato.
 */
export function parseCsv(texto: string): ParsedCsv {
  // Normaliza line breaks (Windows/Mac → Unix)
  const t = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!t) throw new Error("Texto vazio");

  const delimiter = detectDelimiter(t);
  const allRows = splitRows(t, delimiter);
  if (allRows.length < 2) throw new Error("Cole pelo menos 1 linha de header + 1 de dados");

  const headers = allRows[0].map((h) => h.trim());
  const headersNorm = headers.map(normalizarHeader);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < allRows.length; i++) {
    const cols = allRows[i];
    // Linha completamente vazia → skip
    if (cols.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let j = 0; j < headersNorm.length; j++) {
      obj[headersNorm[j]] = (cols[j] ?? "").trim();
    }
    rows.push(obj);
  }

  return { headers, headersNorm, rows, delimiter, totalLinhas: rows.length };
}

/**
 * Detecta delimitador pelo maior número de ocorrências consistentes
 * em todas as linhas. Tab > vírgula > ponto-vírgula como tie-breaker.
 */
function detectDelimiter(texto: string): "," | ";" | "\t" {
  const linhas = texto.split("\n").slice(0, 10); // amostra
  const candidatos: Array<"," | ";" | "\t"> = [",", ";", "\t"];
  let melhor: "," | ";" | "\t" = ",";
  let melhorScore = -1;

  for (const d of candidatos) {
    const counts = linhas.map((l) => contarFora<string>(l, d));
    // Todas as linhas têm o mesmo número de separadores?
    if (counts.length === 0) continue;
    const primeiro = counts[0];
    if (primeiro === 0) continue;
    const consistente = counts.every((c) => c === primeiro);
    // Score = (separadores por linha) × bonus de consistência
    const score = primeiro * (consistente ? 10 : 1);
    if (score > melhorScore) {
      melhorScore = score;
      melhor = d;
    }
  }
  return melhor;
}

/**
 * Conta ocorrências do delimitador respeitando aspas duplas.
 */
function contarFora<_>(linha: string, delim: string): number {
  let dentroAspas = false;
  let n = 0;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      // "" dentro de aspas = aspas literal
      if (dentroAspas && linha[i + 1] === '"') { i++; continue; }
      dentroAspas = !dentroAspas;
      continue;
    }
    if (!dentroAspas && ch === delim) n++;
  }
  return n;
}

/**
 * Split linhas/colunas respeitando aspas (RFC 4180 simplificado).
 */
function splitRows(texto: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let campo = "";
  let dentroAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (dentroAspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else dentroAspas = false;
      } else {
        campo += ch;
      }
    } else {
      if (ch === '"') dentroAspas = true;
      else if (ch === delim) { row.push(campo); campo = ""; }
      else if (ch === "\n") { row.push(campo); rows.push(row); row = []; campo = ""; }
      else campo += ch;
    }
  }
  // Último campo / linha
  if (campo !== "" || row.length > 0) {
    row.push(campo);
    rows.push(row);
  }
  return rows;
}

/**
 * Normaliza header: lower, sem acento, sem caracteres especiais,
 * espaços → underscore. "Investimento (R$)" → "investimento_r"
 */
export function normalizarHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .replace(/[^a-z0-9]+/g, "_")     // não-alfa-num → _
    .replace(/^_+|_+$/g, "");        // trim _
}

/**
 * Encontra o valor de uma row testando múltiplos aliases.
 * Retorna o primeiro alias que existir e não for string vazia.
 */
export function pegarValor(row: Record<string, string>, aliases: string[]): string | null {
  for (const a of aliases) {
    const k = normalizarHeader(a);
    const v = row[k];
    if (v !== undefined && v !== "") return v;
  }
  return null;
}
