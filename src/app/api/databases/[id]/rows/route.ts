/**
 * POST /api/databases/[id]/rows — adiciona uma linha (vazia ou com valores
 *   iniciais). `valores` é coerido por tipo de propriedade (engine).
 *   Ordem = depois da última linha.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { databaseRowSchema } from "@/lib/schemas";
import { coerceValor, lerConfig, type CellValue } from "@/lib/database";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = databaseRowSchema.parse(await req.json().catch(() => ({})));

    const [max, props] = await Promise.all([
      prisma.databaseRow.aggregate({
        where: { databaseId: params.id },
        _max: { ordem: true },
      }),
      prisma.databaseProperty.findMany({
        where: { databaseId: params.id },
        select: { id: true, tipo: true, config: true },
      }),
    ]);
    const ordem = data.ordem ?? (max._max.ordem ?? -1) + 1;

    // Coage valores iniciais (se vierem) pelo tipo de cada propriedade.
    const valores: Record<string, CellValue> = {};
    if (data.valores) {
      for (const p of props) {
        if (p.id in data.valores) {
          valores[p.id] = coerceValor(p.tipo, data.valores[p.id], lerConfig(p.config));
        }
      }
    }

    return prisma.databaseRow.create({
      data: {
        databaseId: params.id,
        valores: valores as Prisma.InputJsonValue,
        ordem,
      },
    });
  });
}
