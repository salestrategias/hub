import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { ContratosClient } from "@/components/contratos-client";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const [contratos, clientes] = await Promise.all([
    prisma.contrato.findMany({ include: { cliente: true }, orderBy: { dataFim: "asc" } }),
    prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <PageShell title="Contratos" subtitle={`${contratos.length} contratos`}>
      <ContratosClient
        contratos={contratos.map((c) => ({
          id: c.id,
          clienteId: c.clienteId,
          clienteNome: c.cliente.nome,
          valor: Number(c.valor),
          dataInicio: c.dataInicio.toISOString(),
          dataFim: c.dataFim.toISOString(),
          status: c.status,
          multaRescisoria: c.multaRescisoria,
          reajuste: c.reajuste,
          observacoes: c.observacoes,
          googleDriveFileId: c.googleDriveFileId,
          googleDriveFileUrl: c.googleDriveFileUrl,
        }))}
        clientes={clientes}
      />
    </PageShell>
  );
}
