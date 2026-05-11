import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { leadSchema } from "@/lib/schemas";
import { calcularLeadScore } from "@/lib/lead-score";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.lead.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true, status: true } },
        propostas: {
          select: { id: true, numero: true, titulo: true, status: true, valorMensal: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        },
        user: { select: { id: true, name: true } },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = leadSchema.partial().parse(await req.json());

    // Atualiza e recalcula score automático (usa estado completo final)
    const updated = await prisma.lead.update({ where: { id: params.id }, data });

    // Se scoreManual está definido, ele tem precedência; senão recalcula
    if (updated.scoreManual === null || updated.scoreManual === undefined) {
      const novoScore = calcularLeadScore({
        contatoEmail: updated.contatoEmail,
        contatoTelefone: updated.contatoTelefone,
        notas: updated.notas,
        valorEstimadoMensal: updated.valorEstimadoMensal ? Number(updated.valorEstimadoMensal) : null,
        proximaAcaoEm: updated.proximaAcaoEm,
        status: updated.status,
        origem: updated.origem,
        updatedAt: updated.updatedAt,
      }).total;
      if (novoScore !== updated.score) {
        return prisma.lead.update({
          where: { id: params.id },
          data: { score: novoScore },
        });
      }
    }
    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.lead.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
