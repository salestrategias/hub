/**
 * GET  /api/integracoes-sheets?clienteId=...&fonte=...
 *   Lista integrações ativas filtradas por cliente/fonte.
 *
 * POST /api/integracoes-sheets
 *   Cria nova integração (vincula uma URL de planilha pública a um
 *   cliente + fonte de relatório). Valida que a URL é parseável.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { integracaoSheetsSchema } from "@/lib/schemas";
import { parseSheetUrl } from "@/lib/google-sheets-public";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId");
    const fonte = searchParams.get("fonte");

    const where: Record<string, unknown> = {};
    if (clienteId) where.clienteId = clienteId;
    if (fonte) where.fonte = fonte;

    return prisma.integracaoSheets.findMany({
      where,
      include: { cliente: { select: { id: true, nome: true } } },
      orderBy: { updatedAt: "desc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = integracaoSheetsSchema.parse(await req.json());

    // Sanity check da URL — lança Error humanizado se inválida
    parseSheetUrl(data.sheetUrl);

    return prisma.integracaoSheets.create({
      data: {
        clienteId: data.clienteId,
        fonte: data.fonte,
        sheetUrl: data.sheetUrl,
        rotulo: data.rotulo || null,
        ativo: data.ativo,
        criadoPor: user.id,
      },
      include: { cliente: { select: { id: true, nome: true } } },
    });
  });
}
