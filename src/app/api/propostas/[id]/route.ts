import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { propostaSchema } from "@/lib/schemas";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.proposta.findUniqueOrThrow({
      where: { id: params.id },
      include: { cliente: { select: { id: true, nome: true, email: true } } },
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const data = propostaSchema.partial().parse(await req.json());

    // Re-sincroniza clienteNome se o clienteId muda
    if (data.clienteId !== undefined) {
      if (data.clienteId) {
        const c = await prisma.cliente.findUnique({
          where: { id: data.clienteId },
          select: { nome: true, email: true },
        });
        if (c) {
          data.clienteNome = c.nome;
          if (!data.clienteEmail) data.clienteEmail = c.email;
        }
      }
    }

    return prisma.proposta.update({ where: { id: params.id }, data });
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.proposta.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
