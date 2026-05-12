import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { CalendarioUnificado } from "@/components/calendario-unificado";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  // Lista de clientes pro filtro — só ATIVO + PROSPECT (CHURNED não
  // gera mais eventos novos, mas filtro UI deixa Marcelo ver
  // histórico se quiser; vou incluir todos pra simplificar).
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return (
    <PageShell
      title="Calendário unificado"
      subtitle="Tarefas, posts, reuniões, contratos e propostas — tudo em uma view"
    >
      <CalendarioUnificado clientes={clientes} />
    </PageShell>
  );
}
