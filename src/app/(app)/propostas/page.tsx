import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PropostasList } from "@/components/propostas-list";

export const dynamic = "force-dynamic";

export default async function PropostasPage() {
  const [propostas, clientes] = await Promise.all([
    prisma.proposta.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { cliente: { select: { id: true, nome: true } } },
      take: 100,
    }),
    prisma.cliente.findMany({
      select: { id: true, nome: true, email: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <PageShell
      title="Propostas comerciais"
      subtitle={`${propostas.length} ${propostas.length === 1 ? "proposta" : "propostas"} cadastradas`}
    >
      <PropostasList
        initial={propostas.map((p) => ({
          id: p.id,
          numero: p.numero,
          titulo: p.titulo,
          clienteNome: p.clienteNome,
          clienteId: p.clienteId,
          status: p.status,
          valorMensal: p.valorMensal ? Number(p.valorMensal) : null,
          valorTotal: p.valorTotal ? Number(p.valorTotal) : null,
          shareToken: p.shareToken,
          shareExpiraEm: p.shareExpiraEm?.toISOString() ?? null,
          shareViews: p.shareViews,
          enviadaEm: p.enviadaEm?.toISOString() ?? null,
          aceitaEm: p.aceitaEm?.toISOString() ?? null,
          updatedAt: p.updatedAt.toISOString(),
        }))}
        clientes={clientes}
      />
    </PageShell>
  );
}
