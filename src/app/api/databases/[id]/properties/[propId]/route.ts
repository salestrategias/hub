/**
 * PATCH  /api/databases/[id]/properties/[propId] — renomeia / muda tipo /
 *        configura (config) / reordena. Ao MUDAR de tipo sem mandar config,
 *        reinicializa config com o default do novo tipo (engine).
 * DELETE /api/databases/[id]/properties/[propId] — remove a coluna.
 *        Obs: os valores órfãos nas linhas (keyed por propId) ficam inertes
 *        no Json — a UI só lê propriedades existentes. Sem migração de dados.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { databasePropertySchema } from "@/lib/schemas";
import { defaultConfigDe, lerConfig } from "@/lib/database";
import type { Prisma } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; propId: string } }
) {
  return apiHandler(async () => {
    await requireAuth();
    const data = databasePropertySchema.partial().parse(await req.json());

    // Tipo mudou? Precisamos saber o tipo atual pra decidir o config.
    const atual = await prisma.databaseProperty.findUniqueOrThrow({
      where: { id: params.propId },
      select: { tipo: true },
    });
    const tipoMudou = data.tipo !== undefined && data.tipo !== atual.tipo;

    let configUpdate: Prisma.InputJsonValue | undefined;
    if (data.config !== undefined && data.config !== null) {
      configUpdate = lerConfig(data.config) as Prisma.InputJsonValue;
    } else if (tipoMudou) {
      // Reinicia config ao trocar de tipo (opções de SELECT antigas não
      // fazem sentido pra NUMERO, etc.).
      configUpdate = defaultConfigDe(data.tipo!) as Prisma.InputJsonValue;
    }

    return prisma.databaseProperty.update({
      where: { id: params.propId },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome.trim() || "Propriedade" } : {}),
        ...(data.tipo !== undefined ? { tipo: data.tipo } : {}),
        ...(configUpdate !== undefined ? { config: configUpdate } : {}),
        ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
      },
    });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; propId: string } }
) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.databaseProperty.delete({ where: { id: params.propId } });
    return { ok: true };
  });
}
