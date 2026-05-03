import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { MapasList } from "@/components/mapas-list";

export const dynamic = "force-dynamic";

export default async function MapasPage() {
  const mapas = await prisma.mindMap.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, titulo: true, descricao: true, thumbnail: true, updatedAt: true },
  });
  return (
    <PageShell title="Mapas Mentais" subtitle="Brainstorming visual estilo Excalidraw">
      <MapasList mapas={mapas.map((m) => ({ ...m, updatedAt: m.updatedAt.toISOString() }))} />
    </PageShell>
  );
}
