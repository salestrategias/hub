import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { SeoClient } from "@/components/relatorio-seo";

export const dynamic = "force-dynamic";

export default async function RelatorioSeoPage() {
  const clientes = await prisma.cliente.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return (
    <PageShell title="SEO" subtitle="Posições, cliques orgânicos, keywords monitoradas e score">
      <SeoClient clientes={clientes} />
    </PageShell>
  );
}
