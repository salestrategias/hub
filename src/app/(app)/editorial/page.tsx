import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { EditorialCalendarClient } from "@/components/editorial-calendar";

export const dynamic = "force-dynamic";

export default async function EditorialPage() {
  const [posts, clientes] = await Promise.all([
    prisma.post.findMany({ include: { cliente: true }, orderBy: { dataPublicacao: "asc" } }),
    prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <PageShell title="Calendário Editorial" subtitle={`${posts.length} posts`}>
      <EditorialCalendarClient
        posts={posts.map((p) => ({
          id: p.id,
          titulo: p.titulo,
          legenda: p.legenda,
          pilar: p.pilar,
          formato: p.formato,
          status: p.status,
          dataPublicacao: p.dataPublicacao.toISOString(),
          clienteId: p.clienteId,
          clienteNome: p.cliente.nome,
          googleEventId: p.googleEventId,
        }))}
        clientes={clientes}
      />
    </PageShell>
  );
}
