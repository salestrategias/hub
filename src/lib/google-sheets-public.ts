/**
 * Fetcher de planilhas Google Sheets PÚBLICAS via URL de export CSV.
 *
 * Funciona sem OAuth — pré-requisito: a planilha precisa estar com
 * "Qualquer pessoa com o link → Leitor". Marcelo libera manualmente
 * antes de colar a URL no SAL Hub.
 *
 * Formatos de URL aceitos:
 *   1. URL "share" normal:
 *      https://docs.google.com/spreadsheets/d/{ID}/edit?usp=sharing
 *   2. URL "edit" com gid de aba:
 *      https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
 *   3. URL "view" sem edição:
 *      https://docs.google.com/spreadsheets/d/{ID}/view
 *   4. URL de export direto (já bate na API):
 *      https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}
 *
 * Estratégia: extrair ID + gid (opcional), reconstruir URL de export
 * canônica, fazer fetch sem cache.
 */

export type SheetUrlParts = {
  id: string;
  gid: string | null; // null = primeira aba (gid=0)
};

/**
 * Extrai ID e gid de qualquer formato suportado. Lança Error se inválido.
 */
export function parseSheetUrl(url: string): SheetUrlParts {
  const u = url.trim();
  if (!u.includes("docs.google.com/spreadsheets")) {
    throw new Error("URL precisa ser do Google Sheets (docs.google.com/spreadsheets)");
  }

  // ID — sempre depois de `/d/`
  const idMatch = u.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error("Não consegui extrair o ID da planilha");
  const id = idMatch[1];

  // gid — em `#gid=`, `&gid=` ou `?gid=`
  const gidMatch = u.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : null;

  return { id, gid };
}

/**
 * Monta URL de export CSV pronta pra GET.
 */
export function montarUrlExport({ id, gid }: SheetUrlParts): string {
  const params = new URLSearchParams({ format: "csv" });
  if (gid) params.set("gid", gid);
  return `https://docs.google.com/spreadsheets/d/${id}/export?${params.toString()}`;
}

/**
 * Baixa CSV bruto de uma URL pública. Retorna texto.
 *
 * Erros possíveis:
 *  - 401/403 → planilha não está pública
 *  - 404 → ID errado ou planilha deletada
 *  - 5xx → Google instável (raro)
 */
export async function fetchSheetCsv(url: string): Promise<string> {
  const parts = parseSheetUrl(url);
  const exportUrl = montarUrlExport(parts);

  const res = await fetch(exportUrl, {
    // Sem cache — sempre fetch fresh
    cache: "no-store",
    // Sem cookies (planilha pública não precisa de auth)
    credentials: "omit",
    headers: { Accept: "text/csv" },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Planilha não está pública. Compartilhe via 'Qualquer pessoa com o link → Leitor'."
      );
    }
    if (res.status === 404) {
      throw new Error("Planilha não encontrada. Confira a URL.");
    }
    throw new Error(`Falha ao baixar planilha (HTTP ${res.status})`);
  }

  // Google pode redirecionar pra HTML quando a planilha não é pública
  // mesmo retornando 200 — checamos pelo content-type.
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) {
    throw new Error(
      "Planilha não está pública (Google retornou HTML, esperava CSV). " +
        "Compartilhe via 'Qualquer pessoa com o link → Leitor'."
    );
  }

  return await res.text();
}
