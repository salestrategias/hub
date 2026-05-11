import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { LeadsKanban } from "@/components/leads-kanban";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [leads, clientes] = await Promise.all([
    prisma.lead.findMany({
      orderBy: [{ status: "asc" }, { prioridade: "asc" }, { updatedAt: "desc" }],
      include: {
        cliente: { select: { id: true, nome: true } },
        _count: { select: { propostas: true } },
      },
      take: 500,
    }),
    prisma.cliente.findMany({
      select: { id: true, nome: true, status: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  const total = leads.filter((l) => l.status !== "PERDIDO" && l.status !== "GANHO").length;

  return (
    <PageShell
      title="Pipeline de leads"
      subtitle={`${total} ${total === 1 ? "oportunidade ativa" : "oportunidades ativas"} no funil`}
    >
      <LeadsKanban
        initial={leads.map((l) => ({
          id: l.id,
          empresa: l.empresa,
          contatoNome: l.contatoNome,
          contatoEmail: l.contatoEmail,
          contatoTelefone: l.contatoTelefone,
          segmento: l.segmento,
          porte: l.porte,
          origem: l.origem,
          status: l.status,
          prioridade: l.prioridade,
          valorEstimadoMensal: l.valorEstimadoMensal ? Number(l.valorEstimadoMensal) : null,
          duracaoEstimadaMeses: l.duracaoEstimadaMeses,
          proximaAcao: l.proximaAcao,
          proximaAcaoEm: l.proximaAcaoEm?.toISOString() ?? null,
          tags: l.tags,
          clienteId: l.clienteId,
          clienteNome: l.cliente?.nome ?? null,
          convertidoEm: l.convertidoEm?.toISOString() ?? null,
          motivoPerdido: l.motivoPerdido,
          score: l.score,
          scoreManual: l.scoreManual,
          totalPropostas: l._count.propostas,
          updatedAt: l.updatedAt.toISOString(),
        }))}
        clientes={clientes}
      />
    </PageShell>
  );
}
