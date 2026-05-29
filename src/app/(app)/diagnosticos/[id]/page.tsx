import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { DiagnosticoEditor } from "@/components/diagnostico-editor";
import { normalizarSecoes } from "@/lib/diagnostico-secoes";

export const dynamic = "force-dynamic";

export default async function DiagnosticoPage({ params }: { params: { id: string } }) {
  const [diagnostico, clientes, reunioes] = await Promise.all([
    prisma.diagnostico.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nome: true } },
        lead: { select: { id: true, empresa: true } },
        reuniao: {
          select: {
            id: true,
            titulo: true,
            audioUrl: true,
            resumoIA: true,
            blocks: {
              select: { id: true, ordem: true, timestamp: true, speaker: true, speakerCor: true, texto: true },
              orderBy: { ordem: "asc" },
            },
            capitulos: {
              select: { id: true, timestamp: true, titulo: true },
              orderBy: { timestamp: "asc" },
            },
          },
        },
      },
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

  if (!diagnostico) notFound();

  const r = diagnostico.reuniao;

  return (
    <PageShell
      title={`Diagnóstico ${diagnostico.numero}`}
      subtitle={`${diagnostico.clienteNome} · ${diagnostico.titulo}`}
      parent={{ label: "Diagnósticos", href: "/diagnosticos" }}
    >
      <DiagnosticoEditor
        diagnostico={{
          id: diagnostico.id,
          numero: diagnostico.numero,
          titulo: diagnostico.titulo,
          clienteId: diagnostico.clienteId,
          clienteNome: diagnostico.clienteNome,
          clienteEmail: diagnostico.clienteEmail,
          leadId: diagnostico.leadId,
          reuniaoId: diagnostico.reuniaoId,
          secoes: normalizarSecoes(diagnostico.secoes),
          logoUrl: diagnostico.logoUrl,
          corPrimaria: diagnostico.corPrimaria,
          capaImagemUrl: diagnostico.capaImagemUrl,
          status: diagnostico.status,
          shareToken: diagnostico.shareToken,
          shareExpiraEm: diagnostico.shareExpiraEm?.toISOString() ?? null,
          shareViews: diagnostico.shareViews,
          propostaId: diagnostico.propostaId,
          enviadoEm: diagnostico.enviadoEm?.toISOString() ?? null,
          vistoEm: diagnostico.vistoEm?.toISOString() ?? null,
        }}
        reuniaoContexto={
          r
            ? {
                id: r.id,
                titulo: r.titulo,
                audioUrl: r.audioUrl,
                resumoIA: r.resumoIA,
                blocks: r.blocks,
                capitulos: r.capitulos,
              }
            : null
        }
        clientes={clientes}
        reunioes={reunioes.map((rr) => ({
          id: rr.id,
          titulo: rr.titulo,
          data: rr.data.toISOString(),
        }))}
      />
    </PageShell>
  );
}
