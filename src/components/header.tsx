import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificacoesBell } from "@/components/notificacoes-bell";
import { HideValuesToggle } from "@/components/hide-values-toggle";
import { QuickCaptureTrigger } from "@/components/quick-capture-trigger";
import { MobileNavTrigger } from "@/components/mobile-nav-trigger";
import { Button } from "@/components/ui/button";
import { ChevronLeft, LogOut } from "lucide-react";
import { AjudaTrigger } from "@/components/ajuda-trigger";
import { QuickCreateButton } from "@/components/quick-create-button";
import { TopbarSearchTrigger } from "@/components/topbar-search-trigger";

export async function Header({ title, subtitle, parent }: { title?: string; subtitle?: React.ReactNode; parent?: { label: string; href: string } }) {
  const session = await auth();

  // Avatar é dataURL grande — não cabe em cookie (limite ~4KB → erro 431).
  // Buscamos do banco separadamente pra não inflar o JWT da sessão.
  let image: string | null = null;
  if (session?.user?.id) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });
    image = u?.image ?? null;
  }

  const initial = (session?.user?.name ?? session?.user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 glass border-b border-border px-3 sm:px-6 lg:px-8 py-3 sm:py-3.5">
      {/* Esquerda: hamburger (mobile) + título */}
      <div className="flex items-center gap-2 min-w-0">
        <MobileNavTrigger />
        <div className="min-w-0">
          {parent && (
            <Link
              href={parent.href}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition mb-0.5"
            >
              <ChevronLeft className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[50vw]">{parent.label}</span>
            </Link>
          )}
          {title && (
            <h1 className="font-display text-[16px] sm:text-[20px] font-semibold tracking-tight leading-none truncate">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="hidden sm:block text-[12px] text-muted-foreground mt-1.5 truncate max-w-[60vw]">
              {subtitle}
            </p>
          )}
        </div>
        {/* Pílula de busca global — só desktop (≥lg). Abre o command palette ⌘K. */}
        <div className="hidden lg:block lg:ml-4">
          <TopbarSearchTrigger />
        </div>
      </div>

      {/* Direita: ações principais. Em mobile, escondemos as secundárias
          (Ajuda, ThemeToggle, HideValues, nome do user, logout) pra
          liberar espaço — ficam acessíveis pelo /perfil. */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <QuickCreateButton />
        <QuickCaptureTrigger />
        <span className="hidden sm:inline-flex"><HideValuesToggle /></span>
        <NotificacoesBell />
        <AjudaTrigger />
        <span className="hidden sm:inline-flex"><ThemeToggle /></span>
        {session?.user && (
          <>
            <Link
              href="/perfil"
              className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-border hover:bg-secondary/40 -my-1.5 py-1.5 -mr-1 pr-2 rounded-md transition"
              aria-label="Meu perfil"
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white overflow-hidden shrink-0"
                style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={session.user.name ?? session.user.email ?? "perfil"} className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              <div className="text-right">
                <div className="text-[12.5px] font-medium leading-tight">{session.user.name ?? session.user.email}</div>
                <div className="text-[10px] text-muted-foreground">{session.user.role}</div>
              </div>
            </Link>
            {/* Mobile: só avatar compacto, vai pra /perfil onde fica logout + configs */}
            <Link
              href="/perfil"
              className="sm:hidden ml-1"
              aria-label="Meu perfil"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white overflow-hidden"
                style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="perfil" className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </div>
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
              className="hidden sm:block"
            >
              <Button variant="ghost" size="icon" type="submit" aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
