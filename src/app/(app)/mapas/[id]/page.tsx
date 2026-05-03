import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { MindMapCanvas } from "@/components/mind-map-canvas";

export const dynamic = "force-dynamic";

export default async function MapaPage({ params }: { params: { id: string } }) {
  const mapa = await prisma.mindMap.findUnique({ where: { id: params.id } });
  if (!mapa) notFound();

  return (
    <PageShell title={mapa.titulo} subtitle={mapa.descricao ?? "Canvas livre — arraste, conecte, edite"}>
      <MindMapCanvas
        id={mapa.id}
        titulo={mapa.titulo}
        descricao={mapa.descricao}
        data={(mapa.data as { nodes: unknown[]; edges: unknown[] }) ?? { nodes: [], edges: [] }}
      />
    </PageShell>
  );
}
