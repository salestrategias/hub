/**
 * POST /api/databases/[id]/properties — adiciona uma coluna (propriedade).
 *   Aceita { nome?, tipo?, config? }. Se config não vier, semeia o default
 *   do tipo (engine: defaultConfigDe). Ordem = depois da última coluna.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { databasePropertySchema } from "@/lib/schemas";
import { defaultConfigDe, lerConfig } from "@/lib/database";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = databasePropertySchema.parse(await req.json());

    const max = await prisma.databaseProperty.aggregate({
      where: { databaseId: params.id },
      _max: { ordem: true },
    });
    const ordem = data.ordem || (max._max.ordem ?? -1) + 1;

    // Config: usa a enviada (sanitizada) ou o default do tipo.
    const config =
      data.config != null ? lerConfig(data.config) : defaultConfigDe(data.tipo);

    return prisma.databaseProperty.create({
      data: {
        databaseId: params.id,
        nome: data.nome?.trim() || "Propriedade",
        tipo: data.tipo,
        config: config as Prisma.InputJsonValue,
        ordem,
      },
    });
  });
}
