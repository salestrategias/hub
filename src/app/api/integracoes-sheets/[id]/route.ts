/**
 * GET    /api/integracoes-sheets/[id]
 * PATCH  /api/integracoes-sheets/[id]  — atualiza url/rotulo/ativo
 * DELETE /api/integracoes-sheets/[id]
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { integracaoSheetsSchema } from "@/lib/schemas";
import { parseSheetUrl } from "@/lib/google-sheets-public";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const item = await prisma.integracaoSheets.findUnique({
      where: { id: params.id },
      include: { cliente: { select: { id: true, nome: true } } },
    });
    if (!item) throw new Error("Integração não encontrada");
    return item;
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const data = integracaoSheetsSchema.partial().parse(body);
    if (data.sheetUrl) parseSheetUrl(data.sheetUrl);

    return prisma.integracaoSheets.update({
      where: { id: params.id },
      data: {
        ...(data.sheetUrl ? { sheetUrl: data.sheetUrl } : {}),
        ...(data.rotulo !== undefined ? { rotulo: data.rotulo || null } : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      },
    });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.integracaoSheets.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
