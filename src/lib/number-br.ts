/**
 * Parser tolerante a formatos numéricos brasileiros e internacionais.
 *
 * Aceita:
 *  - "2500"        → 2500
 *  - "2.500"       → 2500   (separador BR de milhar)
 *  - "2,500"       → 2500   (separador US de milhar)
 *  - "2.500,50"    → 2500.5 (BR completo)
 *  - "2,500.50"    → 2500.5 (US completo)
 *  - "2500,50"     → 2500.5
 *  - "2500.50"     → 2500.5
 *  - "R$ 2.500,50" → 2500.5 (com símbolo)
 *  - ""            → null
 *
 * Heurística: detecta qual separador é decimal pelo ÚLTIMO símbolo
 * (vírgula ou ponto). Quando só tem um símbolo, distingue por tamanho
 * do que vem depois (2 dígitos = decimal, 3 dígitos = milhar).
 */
export function parseBRNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  // Remove tudo que não é dígito, vírgula, ponto ou menos
  const limpo = raw.replace(/[^\d.,-]/g, "").trim();
  if (!limpo) return null;

  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");

  if (temVirgula && temPonto) {
    // Quem aparece por último é o separador decimal
    const ultimaVirgula = limpo.lastIndexOf(",");
    const ultimoPonto = limpo.lastIndexOf(".");
    if (ultimaVirgula > ultimoPonto) {
      // BR: 2.500,50 → remove pontos, troca vírgula por ponto
      return num(limpo.replace(/\./g, "").replace(",", "."));
    }
    // US: 2,500.50 → remove vírgulas
    return num(limpo.replace(/,/g, ""));
  }

  if (temVirgula) {
    // Só vírgula: pode ser milhar (2,500) ou decimal (2,5 / 12,50)
    const apos = limpo.split(",")[1] ?? "";
    if (apos.length === 3 && !limpo.startsWith(",")) {
      // 2,500 — provavelmente milhar
      return num(limpo.replace(/,/g, ""));
    }
    // 12,5 / 12,50 — decimal
    return num(limpo.replace(",", "."));
  }

  if (temPonto) {
    // Só ponto: pode ser milhar BR (2.500) ou decimal US (2.5)
    const apos = limpo.split(".")[1] ?? "";
    if (apos.length === 3 && !limpo.startsWith(".")) {
      // 2.500 — milhar BR
      return num(limpo.replace(/\./g, ""));
    }
    // 2.5 / 2.50 — decimal US
    return num(limpo);
  }

  // Só dígitos
  return num(limpo);
}

function num(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Formata número em BRL completo, ex: 2500 → "R$ 2.500,00"
 */
export function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Formata número em pt-BR sem moeda, ex: 2500 → "2.500"
 */
export function formatBR(n: number, decimals = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
