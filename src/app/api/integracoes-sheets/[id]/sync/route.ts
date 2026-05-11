/**
 * POST /api/integracoes-sheets/[id]/sync
 *
 * Executa a sincronização: baixa CSV da planilha pública → parseia →
 * retorna rows pro front (que então chama /api/relatorios/import).
 *
 * Por que dois passos (sync retorna rows, import grava)?
 *  - Permite preview no front antes de gravar
 *  - Reusa exatamente o mesmo pipeline do "Colar CSV"
 *  - Caso falhe ao gravar, integração não fica com ultimaSync errado
 *
 * Em caso de erro de download, atualiza `ultimoErro` na integração pra
 * Marcelo ver o motivo no card.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { fetchSheetCsv } from "@/lib/google-sheets-public";
import { parseCsv } from "@/lib/csv-parser";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const integ = await prisma.integracaoSheets.findUnique({
      where: { id: params.id },
      include: { cliente: { select: { id: true, nome: true } } },
    });
    if (!integ) throw new Error("Integração não encontrada");

    try {
      const csv = await fetchSheetCsv(integ.sheetUrl);
      const parsed = parseCsv(csv);

      // Não gravar `ultimaSync` aqui — o passo de import faz isso após
      // confirmar persistência. Só limpamos `ultimoErro` se a leitura
      // funcionou.
      await prisma.integracaoSheets.update({
        where: { id: integ.id },
        data: { ultimoErro: null },
      });

      return {
        ok: true,
        integracaoId: integ.id,
        clienteId: integ.clienteId,
        fonte: integ.fonte,
        headers: parsed.headers,
        headersNorm: parsed.headersNorm,
        rows: parsed.rows,
        totalLinhas: parsed.totalLinhas,
        delimiter: parsed.delimiter,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      await prisma.integracaoSheets.update({
        where: { id: integ.id },
        data: { ultimoErro: msg },
      });
      throw err;
    }
  });
}
