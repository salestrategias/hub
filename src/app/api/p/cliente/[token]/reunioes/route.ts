/**
 * GET /api/p/cliente/[token]/reunioes
 *
 * Reuniões do cliente + action items. Read-only.
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.verReunioes) throw new Error("Sem permissão pra reuniões");

    const reunioes = await prisma.reuniao.findMany({
      where: { clienteId: r.cliente.id },
      orderBy: { data: "desc" },
      take: 30,
      select: {
        id: true,
        titulo: true,
        data: true,
        duracaoSeg: true,
        resumoIA: true,
        actionItems: {
          select: { id: true, texto: true, responsavel: true, prazo: true, concluido: true },
          orderBy: { ordem: "asc" },
        },
      },
    });

    return reunioes.map((r) => ({
      ...r,
      data: r.data.toISOString(),
    }));
  });
}
