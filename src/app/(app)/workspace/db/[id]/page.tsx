import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { DatabaseClient, type DatabaseFull } from "@/components/database-client";

export const dynamic = "force-dynamic";

export default async function WorkspaceDatabasePage({
  params,
}: {
  params: { id: string };
}) {
  const db = await prisma.database.findUnique({
    where: { id: params.id },
    include: {
      propriedades: { orderBy: { ordem: "asc" } },
      views: { orderBy: { ordem: "asc" } },
      linhas: { orderBy: { ordem: "asc" } },
    },
  });

  if (!db) notFound();

  // Serializa pro client (Json -> tipos do componente; datas -> ISO).
  const payload: DatabaseFull = {
    id: db.id,
    nome: db.nome,
    icone: db.icone,
    descricao: db.descricao,
    parentPageId: db.parentPageId,
    propriedades: db.propriedades.map((p) => ({
      id: p.id,
      nome: p.nome,
      tipo: p.tipo,
      config: p.config ?? null,
      ordem: p.ordem,
    })),
    views: db.views.map((v) => ({
      id: v.id,
      nome: v.nome,
      tipo: v.tipo,
      config: v.config ?? null,
      ordem: v.ordem,
    })),
    linhas: db.linhas.map((r) => ({
      id: r.id,
      valores: (r.valores ?? {}) as Record<string, unknown>,
      ordem: r.ordem,
    })),
  };

  return (
    <PageShell
      title={db.nome || "Database"}
      parent={{ label: "Páginas", href: "/workspace" }}
    >
      <DatabaseClient db={payload} />
    </PageShell>
  );
}
