import { PageShell } from "@/components/page-shell";
import { TagsAdmin } from "@/components/tags-admin";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  return (
    <PageShell title="Tags de clientes" subtitle="Crie, edite e remova tags. Use no formulário de cliente para classificar.">
      <TagsAdmin />
    </PageShell>
  );
}
