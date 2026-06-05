import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { BriefingsList } from "@/components/briefings-list";
import { normalizarPerguntas } from "@/lib/briefing";

export const dynamic = "force-dynamic";

export default async function BriefingsPage() {
  const [briefings, clientes] = await Promise.all([
    prisma.briefing.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { cliente: { select: { id: true, nome: true } } },
      take: 100,
    }),
    prisma.cliente.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <PageShell
      title="Briefings"
      subtitle={`${briefings.length} ${briefings.length === 1 ? "briefing" : "briefings"}`}
    >
      <BriefingsList
        initial={briefings.map((b) => ({
          id: b.id,
          titulo: b.titulo,
          status: b.status,
          clienteId: b.clienteId,
          clienteNome: b.cliente?.nome ?? b.clienteNome ?? null,
          totalPerguntas: normalizarPerguntas(b.perguntas).length,
          temRespostas: !!b.respostas,
          shareToken: b.shareToken,
          enviadoEm: b.enviadoEm?.toISOString() ?? null,
          respondidoEm: b.respondidoEm?.toISOString() ?? null,
          updatedAt: b.updatedAt.toISOString(),
        }))}
        clientes={clientes}
      />
    </PageShell>
  );
}
