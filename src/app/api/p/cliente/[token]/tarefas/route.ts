/**
 * GET /api/p/cliente/[token]/tarefas
 *
 * Tarefas em andamento + concluídas do cliente. Read-only.
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.verTarefas) throw new Error("Sem permissão pra tarefas");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const trintaDiasAtras = new Date(hoje);
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const tarefas = await prisma.tarefa.findMany({
      where: {
        clienteId: r.cliente.id,
        OR: [
          { concluida: false },
          { concluida: true, updatedAt: { gte: trintaDiasAtras } }, // mostra concluídas recentes
        ],
      },
      orderBy: [{ concluida: "asc" }, { dataEntrega: "asc" }],
      take: 100,
      select: {
        id: true,
        titulo: true,
        descricao: true,
        prioridade: true,
        dataEntrega: true,
        concluida: true,
        updatedAt: true,
      },
    });

    return tarefas.map((t) => ({
      ...t,
      dataEntrega: t.dataEntrega?.toISOString() ?? null,
      updatedAt: t.updatedAt.toISOString(),
    }));
  });
}
