import { PageShell } from "@/components/page-shell";
import { AgendaClient } from "@/components/agenda-client";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  return (
    <PageShell title="Google Agenda" subtitle="Sincronizado com sua conta Google">
      <AgendaClient />
    </PageShell>
  );
}
