import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { ProjetosKanban } from "@/components/projetos-kanban";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const [projetos, clientes] = await Promise.all([
    prisma.projeto.findMany({
      include: { cliente: true, tarefas: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <PageShell title="Projetos" subtitle={`${projetos.length} projetos`}>
      <ProjetosKanban
        projetos={projetos.map((p) => ({
          id: p.id,
          nome: p.nome,
          status: p.status,
          prioridade: p.prioridade,
          dataEntrega: p.dataEntrega?.toISOString() ?? null,
          clienteNome: p.cliente?.nome ?? null,
          totalTarefas: p.tarefas.length,
        }))}
        clientes={clientes}
      />
    </PageShell>
  );
}
