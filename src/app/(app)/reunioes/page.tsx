import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { ReunioesList } from "@/components/reunioes-list";
import { ReuniaoFormButton } from "@/components/reuniao-form";

export const dynamic = "force-dynamic";

export default async function ReunioesPage() {
  const [reunioes, clientes] = await Promise.all([
    prisma.reuniao.findMany({
      include: {
        cliente: { select: { id: true, nome: true } },
        _count: { select: { actionItems: true, blocks: true } },
      },
      orderBy: { data: "desc" },
    }),
    prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  const totalDuracao = reunioes.reduce((s, r) => s + (r.duracaoSeg ?? 0), 0);
  const totalActions = reunioes.reduce((s, r) => s + r._count.actionItems, 0);

  return (
    <PageShell
      title="Reuniões"
      subtitle="Histórico, transcrições e action items extraídos"
      actions={<ReuniaoFormButton clientes={clientes} />}
    >
      <ReunioesList
        reunioes={reunioes.map((r) => ({
          id: r.id,
          titulo: r.titulo,
          data: r.data.toISOString(),
          duracaoSeg: r.duracaoSeg,
          status: r.status,
          participantes: r.participantes,
          tagsLivres: r.tagsLivres,
          clienteNome: r.cliente?.nome ?? null,
          totalActions: r._count.actionItems,
          totalBlocks: r._count.blocks,
        }))}
        kpi={{
          total: reunioes.length,
          duracaoSeg: totalDuracao,
          actions: totalActions,
          clientes: new Set(reunioes.map((r) => r.clienteId).filter(Boolean)).size,
        }}
      />
    </PageShell>
  );
}
