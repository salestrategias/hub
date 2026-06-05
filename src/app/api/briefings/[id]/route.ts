import { Prisma } from "@prisma/client";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { briefingSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.briefing.findUniqueOrThrow({
      where: { id: params.id },
      include: { cliente: { select: { id: true, nome: true } } },
    });
  });
}

/**
 * PATCH parcial — o editor manda só os campos que mudaram (titulo, perguntas,
 * status, respostas, clienteId/clienteNome). Efeitos colaterais:
 *  - clienteId mudou → re-snapshot do clienteNome a partir do cadastro.
 *  - status virou RESPONDIDO → carimba respondidoEm (uma vez).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = briefingSchema.parse(await req.json());

    const patch: Prisma.BriefingUpdateInput = {};

    if (data.titulo !== undefined) patch.titulo = data.titulo;
    if (data.perguntas !== undefined) {
      patch.perguntas = data.perguntas as unknown as Prisma.InputJsonValue;
    }
    if (data.respostas !== undefined) {
      patch.respostas =
        data.respostas === null
          ? Prisma.JsonNull
          : (data.respostas as unknown as Prisma.InputJsonValue);
    }
    if (data.clienteNome !== undefined) patch.clienteNome = data.clienteNome;

    // Vínculo com cliente — re-snapshot do nome quando (re)vincula.
    if (data.clienteId !== undefined) {
      if (data.clienteId) {
        const c = await prisma.cliente.findUnique({
          where: { id: data.clienteId },
          select: { nome: true },
        });
        patch.cliente = { connect: { id: data.clienteId } };
        if (data.clienteNome === undefined && c) patch.clienteNome = c.nome;
      } else {
        patch.cliente = { disconnect: true };
      }
    }

    // Status + carimbos de tempo derivados.
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "RESPONDIDO") {
        const atual = await prisma.briefing.findUniqueOrThrow({
          where: { id: params.id },
          select: { respondidoEm: true },
        });
        if (!atual.respondidoEm) patch.respondidoEm = new Date();
      }
    }

    return prisma.briefing.update({
      where: { id: params.id },
      data: patch,
      include: { cliente: { select: { id: true, nome: true } } },
    });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.briefing.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
