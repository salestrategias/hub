import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { ConfiguracoesAdminClient } from "@/components/configuracoes-admin-client";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") {
    return (
      <PageShell title="Configurações — acesso restrito" subtitle="Apenas administradores podem editar configurações do sistema">
        <p className="text-sm text-muted-foreground">Você não tem permissão para acessar essa área.</p>
      </PageShell>
    );
  }

  // Pega ou cria a config singleton — usa upsert pra evitar 404 na primeira
  // visita após deploy de schema novo.
  const config = await prisma.configuracao.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  return (
    <PageShell
      title="Configurações"
      subtitle="Preferências globais do sistema — onboarding, integrações, etc."
    >
      <ConfiguracoesAdminClient configInicial={config} />
    </PageShell>
  );
}
