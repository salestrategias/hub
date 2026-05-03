import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PerfilForm } from "@/components/perfil-form";
import { AtividadeList } from "@/components/atividade-list";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, atividades] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: {
        id: true, name: true, email: true, image: true, role: true,
        passwordHash: true, createdAt: true,
        googleAccessToken: true,
      },
    }),
    prisma.atividadeConta.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, tipo: true, ip: true, userAgent: true, meta: true, createdAt: true },
    }),
  ]);

  return (
    <PageShell title="Meu perfil" subtitle="Atualize foto, nome e senha — veja sua atividade recente">
      <PerfilForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
          temSenhaLocal: !!user.passwordHash,
          googleConectado: !!user.googleAccessToken,
        }}
      />
      <div className="max-w-5xl">
        <AtividadeList
          atividades={atividades.map((a) => ({
            id: a.id,
            tipo: a.tipo,
            ip: a.ip,
            userAgent: a.userAgent,
            meta: (a.meta as Record<string, unknown> | null) ?? null,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      </div>
    </PageShell>
  );
}
