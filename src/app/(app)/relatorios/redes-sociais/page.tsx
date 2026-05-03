import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { RedesSociaisClient } from "@/components/relatorio-redes";

export const dynamic = "force-dynamic";

export default async function RelatorioRedesPage() {
  const clientes = await prisma.cliente.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return (
    <PageShell title="Redes Sociais" subtitle="Métricas mensais, comparativo MoM e exportação em PDF">
      <RedesSociaisClient clientes={clientes} />
    </PageShell>
  );
}
