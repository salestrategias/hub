import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { TrafegoClient } from "@/components/relatorio-trafego";

export const dynamic = "force-dynamic";

export default async function RelatorioTrafegoPage() {
  const clientes = await prisma.cliente.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return (
    <PageShell title="Tráfego Pago" subtitle="Campanhas, ROAS e investimentos por plataforma">
      <TrafegoClient clientes={clientes} />
    </PageShell>
  );
}
