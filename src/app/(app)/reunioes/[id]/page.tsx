import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ReuniaoDetalhe } from "@/components/reuniao-detalhe";

export const dynamic = "force-dynamic";

export default async function ReuniaoDetalhePage({ params }: { params: { id: string } }) {
  const reuniao = await prisma.reuniao.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, nome: true } },
      blocks: { orderBy: { ordem: "asc" } },
      actionItems: { orderBy: { ordem: "asc" } },
      capitulos: { orderBy: { ordem: "asc" } },
    },
  });
  if (!reuniao) notFound();

  const dataStr = reuniao.data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const horaStr = reuniao.data.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const dur = reuniao.duracaoSeg ? `${Math.floor(reuniao.duracaoSeg / 60)}m` : "";

  return (
    <PageShell
      title={reuniao.titulo}
      subtitle={`${dataStr} · ${horaStr}${dur ? ` · ${dur}` : ""} · ${reuniao.participantes.length} participante(s)`}
    >
      <ReuniaoDetalhe
        reuniao={{
          id: reuniao.id,
          titulo: reuniao.titulo,
          data: reuniao.data.toISOString(),
          duracaoSeg: reuniao.duracaoSeg,
          status: reuniao.status,
          participantes: reuniao.participantes,
          tagsLivres: reuniao.tagsLivres,
          clienteNome: reuniao.cliente?.nome ?? null,
          resumoIA: reuniao.resumoIA,
          notasLivres: reuniao.notasLivres,
          blocks: reuniao.blocks.map((b) => ({ id: b.id, ordem: b.ordem, timestamp: b.timestamp, speaker: b.speaker, speakerCor: b.speakerCor, texto: b.texto })),
          actions: reuniao.actionItems.map((a) => ({ id: a.id, texto: a.texto, responsavel: a.responsavel, prazo: a.prazo, concluido: a.concluido })),
          capitulos: reuniao.capitulos.map((c) => ({ id: c.id, timestamp: c.timestamp, titulo: c.titulo })),
        }}
      />
    </PageShell>
  );
}
