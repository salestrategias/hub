import { Prisma } from "@prisma/client";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { diagnosticoSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.diagnostico.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true, email: true } },
        lead: { select: { id: true, empresa: true } },
        reuniao: { select: { id: true, titulo: true } },
      },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = diagnosticoSchema.partial().parse(await req.json());

    // Re-sincroniza clienteNome se o clienteId muda pra um cliente cadastrado
    if (data.clienteId !== undefined && data.clienteId) {
      const c = await prisma.cliente.findUnique({
        where: { id: data.clienteId },
        select: { nome: true, email: true },
      });
      if (c) {
        data.clienteNome = c.nome;
        if (!data.clienteEmail) data.clienteEmail = c.email;
      }
    }

    // `secoes` é Json — precisa do cast pro tipo do Prisma.
    const { secoes, ...rest } = data;
    return prisma.diagnostico.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(secoes !== undefined
          ? { secoes: secoes as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.diagnostico.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
