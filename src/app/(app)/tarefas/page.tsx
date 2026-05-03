import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { TarefasClient } from "@/components/tarefas-client";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const [tarefas, clientes, projetos] = await Promise.all([
    prisma.tarefa.findMany({
      include: { cliente: true, projeto: true, checklist: { orderBy: { ordem: "asc" } } },
      orderBy: [{ concluida: "asc" }, { dataEntrega: "asc" }],
    }),
    prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.projeto.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <PageShell title="Tarefas" subtitle={`${tarefas.length} tarefas no total`}>
      <TarefasClient
        tarefas={tarefas.map((t) => ({
          ...t,
          dataEntrega: t.dataEntrega?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }))}
        clientes={clientes}
        projetos={projetos}
      />
    </PageShell>
  );
}
