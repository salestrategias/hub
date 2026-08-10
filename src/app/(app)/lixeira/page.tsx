import { PageShell } from "@/components/page-shell";
import { LixeiraClient } from "@/components/lixeira-client";

export const dynamic = "force-dynamic";

/**
 * Hub 2.0 — Lixeira universal + Arquivados.
 * Tudo que é excluído (tarefa, nota, post, lead, projeto, página,
 * proposta) passa por aqui antes de sumir de verdade (30 dias).
 */
export default function LixeiraPage() {
  return (
    <PageShell
      title="Lixeira"
      subtitle="Excluídos ficam 30 dias recuperáveis · Arquivados ficam pra sempre"
    >
      <LixeiraClient />
    </PageShell>
  );
}
