import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { PropostaEditor } from "@/components/proposta-editor";

export const dynamic = "force-dynamic";

export default async function PropostaPage({ params }: { params: { id: string } }) {
  const [proposta, clientes] = await Promise.all([
    prisma.proposta.findUnique({
      where: { id: params.id },
      include: { cliente: { select: { id: true, nome: true } } },
    }),
    prisma.cliente.findMany({
      select: { id: true, nome: true, email: true },
      orderBy: { nome: "asc" },
    }),
  ]);
  if (!proposta) notFound();

  return (
    <PageShell title={`Proposta ${proposta.numero}`} subtitle={`${proposta.clienteNome} · ${proposta.titulo}`}>
      <PropostaEditor
        proposta={{
          id: proposta.id,
          numero: proposta.numero,
          titulo: proposta.titulo,
          clienteId: proposta.clienteId,
          clienteNome: proposta.clienteNome,
          clienteEmail: proposta.clienteEmail,
          capa: proposta.capa,
          diagnostico: proposta.diagnostico,
          objetivo: proposta.objetivo,
          escopo: proposta.escopo,
          cronograma: proposta.cronograma,
          investimento: proposta.investimento,
          proximosPassos: proposta.proximosPassos,
          termos: proposta.termos,
          valorMensal: proposta.valorMensal ? Number(proposta.valorMensal) : null,
          valorTotal: proposta.valorTotal ? Number(proposta.valorTotal) : null,
          duracaoMeses: proposta.duracaoMeses,
          validadeDias: proposta.validadeDias,
          status: proposta.status,
          shareToken: proposta.shareToken,
          shareExpiraEm: proposta.shareExpiraEm?.toISOString() ?? null,
          shareViews: proposta.shareViews,
          enviadaEm: proposta.enviadaEm?.toISOString() ?? null,
          vistaEm: proposta.vistaEm?.toISOString() ?? null,
          aceitaEm: proposta.aceitaEm?.toISOString() ?? null,
          recusadaEm: proposta.recusadaEm?.toISOString() ?? null,
          recusaMotivo: proposta.recusaMotivo,
        }}
        clientes={clientes}
      />
    </PageShell>
  );
}
