import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { WorkspaceClient } from "@/components/workspace-client";

export const dynamic = "force-dynamic";

export default async function WorkspacePaginaPage({
  params,
}: {
  params: { id: string };
}) {
  const [pages, databases, atual] = await Promise.all([
    prisma.page.findMany({
      orderBy: [{ parentId: "asc" }, { ordem: "asc" }, { titulo: "asc" }],
      select: { id: true, titulo: true, icone: true, ordem: true, parentId: true },
    }),
    prisma.database.findMany({
      orderBy: [{ parentPageId: "asc" }, { ordem: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, icone: true, ordem: true, parentPageId: true },
    }),
    prisma.page.findUnique({ where: { id: params.id } }),
  ]);

  if (!atual) notFound();

  // Breadcrumb do Header (volta pro índice). O breadcrumb completo de
  // ancestrais fica dentro do WorkspaceClient (precisa da árvore).
  return (
    <PageShell
      title={atual.titulo || "Sem título"}
      parent={{ label: "Páginas", href: "/workspace" }}
    >
      <WorkspaceClient
        pages={pages}
        databases={databases}
        activePage={{
          id: atual.id,
          titulo: atual.titulo,
          icone: atual.icone,
          capaUrl: atual.capaUrl,
          conteudo: atual.conteudo,
          parentId: atual.parentId,
          atualizadoEm: atual.updatedAt.toISOString(),
        }}
      />
    </PageShell>
  );
}
