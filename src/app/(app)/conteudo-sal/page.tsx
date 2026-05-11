import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { ConteudoSalClient } from "@/components/conteudo-sal-client";

export const dynamic = "force-dynamic";

export default async function ConteudoSalPage() {
  const conteudos = await prisma.conteudoSAL.findMany({
    orderBy: { dataPublicacao: "asc" },
    take: 500,
  });

  const total = conteudos.length;

  return (
    <PageShell
      title="Conteúdo SAL"
      subtitle={`${total} ${total === 1 ? "peça planejada" : "peças planejadas"} pra marca SAL`}
    >
      <ConteudoSalClient
        initial={conteudos.map((c) => ({
          id: c.id,
          titulo: c.titulo,
          copy: c.copy,
          briefing: c.briefing,
          formato: c.formato,
          status: c.status,
          pilar: c.pilar,
          dataPublicacao: c.dataPublicacao.toISOString(),
          url: c.url,
          googleEventId: c.googleEventId,
        }))}
      />
    </PageShell>
  );
}
