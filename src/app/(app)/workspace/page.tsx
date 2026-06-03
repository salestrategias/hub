import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { WorkspaceClient } from "@/components/workspace-client";

export const dynamic = "force-dynamic";

export default async function WorkspaceIndexPage() {
  const [pages, databases] = await Promise.all([
    prisma.page.findMany({
      orderBy: [{ parentId: "asc" }, { ordem: "asc" }, { titulo: "asc" }],
      select: { id: true, titulo: true, icone: true, ordem: true, parentId: true },
    }),
    prisma.database.findMany({
      orderBy: [{ parentPageId: "asc" }, { ordem: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, icone: true, ordem: true, parentPageId: true },
    }),
  ]);

  return (
    <PageShell title="Workspace" subtitle="Páginas e databases — estilo Notion">
      <WorkspaceClient pages={pages} databases={databases} activePage={null} />
    </PageShell>
  );
}
