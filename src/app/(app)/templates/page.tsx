import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { TemplatesClient } from "@/components/templates-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    orderBy: [{ ultimoUso: "desc" }, { quantidadeUsos: "desc" }, { nome: "asc" }],
  });

  return (
    <PageShell
      title="Templates"
      subtitle="Esqueletos pré-prontos pra notas, reuniões, briefings, tarefas e projetos. Use {{variáveis}} pra preenchimento automático."
    >
      <TemplatesClient
        initial={templates.map((t) => ({
          id: t.id,
          nome: t.nome,
          descricao: t.descricao,
          tipo: t.tipo,
          categoria: t.categoria,
          icone: t.icone,
          cor: t.cor,
          conteudo: t.conteudo,
          criadoPor: t.criadoPor,
          quantidadeUsos: t.quantidadeUsos,
          ultimoUso: t.ultimoUso?.toISOString() ?? null,
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </PageShell>
  );
}
