import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { CriativosKanban } from "@/components/criativos-kanban";

export const dynamic = "force-dynamic";

export default async function CriativosPage() {
  const [criativos, clientes] = await Promise.all([
    prisma.criativo.findMany({
      include: {
        cliente: { select: { id: true, nome: true } },
        _count: { select: { arquivos: true, comentarios: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.cliente.findMany({
      select: { id: true, nome: true },
      where: { status: { in: ["ATIVO", "PROSPECT"] } },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <PageShell title="Criativos de Anúncio" subtitle={`${criativos.length} criativos`}>
      <CriativosKanban
        criativos={criativos.map((c) => ({
          id: c.id,
          titulo: c.titulo,
          status: c.status,
          plataforma: c.plataforma,
          formato: c.formato,
          clienteNome: c.cliente?.nome ?? "—",
          orcamento: c.orcamento ? Number(c.orcamento) : null,
          inicio: c.inicio?.toISOString() ?? null,
          fim: c.fim?.toISOString() ?? null,
          totalArquivos: c._count.arquivos,
          totalComentarios: c._count.comentarios,
        }))}
        clientes={clientes}
      />
    </PageShell>
  );
}
