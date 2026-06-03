import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { WorkspaceClient } from "@/components/workspace-client";

export const dynamic = "force-dynamic";

export default async function WorkspaceIndexPage() {
  const pages = await prisma.page.findMany({
    orderBy: [{ parentId: "asc" }, { ordem: "asc" }, { titulo: "asc" }],
    select: { id: true, titulo: true, icone: true, ordem: true, parentId: true },
  });

  return (
    <PageShell title="Páginas" subtitle="Documentos livres do workspace">
      <WorkspaceClient pages={pages} activePage={null} />
    </PageShell>
  );
}
