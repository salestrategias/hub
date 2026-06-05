import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { BriefingEditor } from "@/components/briefing-editor";
import { normalizarPerguntas, type BriefingStatusUi } from "@/lib/briefing";

export const dynamic = "force-dynamic";

export default async function BriefingPage({ params }: { params: { id: string } }) {
  const [briefing, clientes] = await Promise.all([
    prisma.briefing.findUnique({
      where: { id: params.id },
      include: { cliente: { select: { id: true, nome: true } } },
    }),
    prisma.cliente.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  if (!briefing) notFound();

  const respostas =
    briefing.respostas && typeof briefing.respostas === "object" && !Array.isArray(briefing.respostas)
      ? (briefing.respostas as Record<string, string | string[]>)
      : null;

  return (
    <PageShell
      title="Briefing"
      subtitle={briefing.titulo}
      parent={{ label: "Briefings", href: "/briefings" }}
    >
      <BriefingEditor
        briefing={{
          id: briefing.id,
          titulo: briefing.titulo,
          status: briefing.status as BriefingStatusUi,
          clienteId: briefing.clienteId,
          clienteNome: briefing.cliente?.nome ?? briefing.clienteNome ?? null,
          perguntas: normalizarPerguntas(briefing.perguntas),
          respostas,
          shareToken: briefing.shareToken,
          shareExpiraEm: briefing.shareExpiraEm?.toISOString() ?? null,
          enviadoEm: briefing.enviadoEm?.toISOString() ?? null,
          respondidoEm: briefing.respondidoEm?.toISOString() ?? null,
        }}
        clientes={clientes}
      />
    </PageShell>
  );
}
