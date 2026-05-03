import Link from "next/link";
import { auth, signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, HelpCircle } from "lucide-react";

export async function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  const session = await auth();
  const initial = (session?.user?.name ?? session?.user?.email ?? "?").charAt(0).toUpperCase();
  const image = session?.user?.image;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 glass border-b border-border px-8 py-3.5">
      <div>
        {title && <h1 className="font-display text-[20px] font-semibold tracking-tight leading-none">{title}</h1>}
        {subtitle && <p className="text-[12px] text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notificações"><Bell className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Ajuda"><HelpCircle className="h-4 w-4" /></Button>
        <ThemeToggle />
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
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
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
