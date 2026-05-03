import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { NotasClient } from "@/components/notas-client";

export const dynamic = "force-dynamic";

export default async function NotasPage() {
  const notas = await prisma.nota.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <PageShell title="Notas" subtitle="Bloco de notas estilo Obsidian — markdown, wikilinks, tags">
      <NotasClient
        notas={notas.map((n) => ({
          id: n.id,
          titulo: n.titulo,
          pasta: n.pasta,
          conteudo: n.conteudo,
          tags: n.tags,
          favorita: n.favorita,
          updatedAt: n.updatedAt.toISOString(),
        }))}
      />
    </PageShell>
  );
}
