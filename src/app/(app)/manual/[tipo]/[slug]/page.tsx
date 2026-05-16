import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { seedManualSeNecessario } from "@/lib/manual-seed";
import { ManualClient } from "@/components/manual-client";

export const dynamic = "force-dynamic";

export default async function ManualSecaoPage({
  params,
}: {
  params: { tipo: string; slug: string };
}) {
  const tipoUp = params.tipo.toUpperCase();
  if (tipoUp !== "PLAYBOOK" && tipoUp !== "MARCA" && tipoUp !== "HUB") notFound();
  const tipo = tipoUp as "PLAYBOOK" | "MARCA" | "HUB";

  await seedManualSeNecessario(tipo);

  const [secoes, atual] = await Promise.all([
    prisma.docSecao.findMany({
      where: { tipo },
      orderBy: [{ parentId: "asc" }, { ordem: "asc" }, { titulo: "asc" }],
      select: { id: true, titulo: true, slug: true, icone: true, ordem: true, publicada: true, parentId: true },
    }),
    prisma.docSecao.findUnique({
      where: { tipo_slug: { tipo, slug: params.slug } },
    }),
  ]);

  if (!atual) notFound();

  return (
    <ManualClient
      tipo={tipo}
      secaoAtual={{
        id: atual.id,
        titulo: atual.titulo,
        slug: atual.slug,
        icone: atual.icone,
        conteudo: atual.conteudo,
        publicada: atual.publicada,
        atualizadoEm: atual.updatedAt.toISOString(),
      }}
      secoes={secoes}
    />
  );
}
