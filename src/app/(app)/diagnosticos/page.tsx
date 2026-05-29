import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { DiagnosticosList } from "@/components/diagnosticos-list";
import { normalizarSecoes } from "@/lib/diagnostico-secoes";

export const dynamic = "force-dynamic";

export default async function DiagnosticosPage() {
  const [diagnosticos, clientes, reunioes] = await Promise.all([
    prisma.diagnostico.findMany({
      where: { versaoAtual: true },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        cliente: { select: { id: true, nome: true } },
        reuniao: { select: { id: true, titulo: true } },
      },
      take: 100,
    }),
    prisma.cliente.findMany({
      select: { id: true, nome: true, email: true },
      orderBy: { nome: "asc" },
    }),
    prisma.reuniao.findMany({
      select: { id: true, titulo: true, data: true },
      orderBy: { data: "desc" },
      take: 100,
    }),
  ]);

  return (
    <PageShell
      title="Diagnósticos estratégicos"
      subtitle={`${diagnosticos.length} ${diagnosticos.length === 1 ? "diagnóstico" : "diagnósticos"}`}
    >
      <DiagnosticosList
        initial={diagnosticos.map((d) => {
          const secoes = normalizarSecoes(d.secoes);
          return {
            id: d.id,
            numero: d.numero,
            titulo: d.titulo,
            clienteNome: d.clienteNome,
            clienteId: d.clienteId,
            status: d.status,
            reuniaoTitulo: d.reuniao?.titulo ?? null,
            secoesVisiveis: secoes.filter((s) => s.visivel).length,
            shareToken: d.shareToken,
            shareExpiraEm: d.shareExpiraEm?.toISOString() ?? null,
            shareViews: d.shareViews,
            enviadoEm: d.enviadoEm?.toISOString() ?? null,
            updatedAt: d.updatedAt.toISOString(),
          };
        })}
        clientes={clientes}
        reunioes={reunioes.map((r) => ({
          id: r.id,
          titulo: r.titulo,
          data: r.data.toISOString(),
        }))}
      />
    </PageShell>
  );
}
