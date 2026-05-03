import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClienteFormButton } from "@/components/cliente-form";
import { ClientesList } from "@/components/clientes-list";
import { Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const [clientes, tags] = await Promise.all([
    prisma.cliente.findMany({ orderBy: { nome: "asc" }, include: { tags: true } }),
    prisma.tag.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <PageShell
      title="Clientes"
      subtitle={`${clientes.length} clientes cadastrados`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/clientes/tags"><Tag className="h-4 w-4" /> Gerenciar tags</Link>
          </Button>
          <ClienteFormButton />
        </div>
      }
    >
      <ClientesList
        clientes={clientes.map((c) => ({
          id: c.id,
          nome: c.nome,
          email: c.email,
          status: c.status,
          valorContratoMensal: Number(c.valorContratoMensal),
          tags: c.tags,
        }))}
        tags={tags}
      />
    </PageShell>
  );
}
