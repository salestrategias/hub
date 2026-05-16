import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { seedManualSeNecessario } from "@/lib/manual-seed";

export const dynamic = "force-dynamic";

/**
 * Página de categoria — redireciona pra primeira seção da categoria.
 * Roda seed inicial (idempotente) na primeira visita.
 *
 * URL: /manual/playbook ou /manual/marca (lowercase)
 */
export default async function ManualTipoPage({ params }: { params: { tipo: string } }) {
  const tipoUp = params.tipo.toUpperCase();
  if (tipoUp !== "PLAYBOOK" && tipoUp !== "MARCA" && tipoUp !== "HUB") notFound();
  const tipo = tipoUp as "PLAYBOOK" | "MARCA" | "HUB";

  // Lazy seed na primeira visita
  await seedManualSeNecessario(tipo);

  // Primeira seção
  const primeira = await prisma.docSecao.findFirst({
    where: { tipo, publicada: true },
    orderBy: [{ parentId: "asc" }, { ordem: "asc" }],
    select: { slug: true },
  });

  if (primeira) {
    redirect(`/manual/${params.tipo}/${primeira.slug}`);
  }

  // Fallback: nenhuma seção publicada (todas em rascunho ou recém-criada)
  redirect(`/manual`);
}
