import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { DriveBrowser } from "@/components/drive-browser";

export const dynamic = "force-dynamic";

export default async function DrivePage() {
  const clientes = await prisma.cliente.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  return (
    <PageShell title="Google Drive" subtitle="Navegue, pesquise e vincule arquivos a clientes">
      <DriveBrowser clientes={clientes} />
    </PageShell>
  );
}
