/**
 * POST /api/integracoes-sheets/fetch-temp
 *
 * Baixa CSV de uma URL pública SEM persistir integração no banco —
 * útil pra "importar agora e esquecer" (Marcelo não quer re-sincronizar
 * depois). O endpoint /sync regular requer integração persistida pra
 * registrar ultimaSync/ultimoErro; este aqui pula isso.
 *
 * Body: { sheetUrl: string }
 * Retorna: { headers, rows, totalLinhas, delimiter }
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { fetchSheetCsv } from "@/lib/google-sheets-public";
import { parseCsv } from "@/lib/csv-parser";
import { z } from "zod";

const schema = z.object({
  sheetUrl: z
    .string()
    .url("URL inválida")
    .refine((u) => u.includes("docs.google.com/spreadsheets"), "Use URL do Google Sheets"),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { sheetUrl } = schema.parse(await req.json());

    const csv = await fetchSheetCsv(sheetUrl);
    const parsed = parseCsv(csv);

    return {
      ok: true,
      headers: parsed.headers,
      headersNorm: parsed.headersNorm,
      rows: parsed.rows,
      totalLinhas: parsed.totalLinhas,
      delimiter: parsed.delimiter,
    };
  });
}
