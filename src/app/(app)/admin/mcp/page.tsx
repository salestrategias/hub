import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { McpAdminClient } from "@/components/mcp-admin-client";

export const dynamic = "force-dynamic";

export default async function McpAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") {
    return (
      <PageShell title="MCP — acesso restrito" subtitle="Apenas administradores podem gerenciar tokens MCP">
        <p className="text-sm text-muted-foreground">Você não tem permissão para acessar essa área.</p>
      </PageShell>
    );
  }

  const tokens = await prisma.mcpToken.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, nome: true, prefixo: true, ultimoUso: true, expiraEm: true,
      revogadoEm: true, totalChamadas: true, createdAt: true, escopos: true,
    },
  });

  return (
    <PageShell
      title="Integração com Claude (MCP)"
      subtitle="Conecte o Claude Desktop ou Claude Code ao SAL Hub para automação completa via linguagem natural"
    >
      <McpAdminClient
        tokens={tokens.map((t) => ({
          ...t,
          ultimoUso: t.ultimoUso?.toISOString() ?? null,
          expiraEm: t.expiraEm?.toISOString() ?? null,
          revogadoEm: t.revogadoEm?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </PageShell>
  );
}
