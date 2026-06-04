"use client";
/**
 * Bottom-nav app-like (mobile < md). Fixa no rodapé, glass, com FAB "+"
 * central e item "Mais" que abre o drawer da sidebar (MobileSidebar).
 *
 * - Itens essenciais: Início (/), Comercial (/leads), Editorial (/editorial).
 * - FAB central: abre o QuickCreate (mesmo provider/dropdown do "+ Novo" do
 *   header) — reusa useQuickCreate, sem duplicar lógica.
 * - "Mais": abre o MobileSidebar (drawer completo com todos os módulos).
 *
 * O conteúdo da página recebe padding-bottom via PageShell pra nada ficar
 * atrás da barra. Some em ≥md (onde a sidebar desktop assume).
 *
 * Reusa o padrão de bottom-nav do Portal do Cliente (portal-cliente.tsx).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";
import { Home, TrendingUp, CalendarDays, MoreHorizontal, Plus, ListTodo, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileSidebar } from "@/components/sidebar";
import { useQuickCreate } from "@/components/quick-create-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type Item = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const ITEMS: Item[] = [
  { label: "Início", href: "/", icon: Home },
  { label: "Comercial", href: "/leads", icon: TrendingUp },
  { label: "Editorial", href: "/editorial", icon: CalendarDays },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { abrir } = useQuickCreate();
  // Abre o modal só depois do dropdown fechar (evita o body travado do Radix).
  const pendente = useRef<"lead" | "tarefa" | "lancamento" | null>(null);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 glass border-t border-border pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação principal"
      >
        <div className="flex items-stretch justify-around">
          {/* 2 primeiros itens */}
          {ITEMS.slice(0, 2).map((it) => (
            <BottomLink key={it.href} item={it} active={isActive(it.href)} />
          ))}

          {/* FAB central — abre QuickCreate */}
          <div className="flex flex-1 items-start justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Criar novo"
                  className="-mt-5 h-[52px] w-[52px] rounded-2xl grid place-items-center text-white shadow-lg active:scale-95 transition-transform"
                  style={{
                    background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)",
                    boxShadow: "0 10px 22px -8px rgba(126,48,225,0.7)",
                  }}
                >
                  <Plus className="h-6 w-6" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                side="top"
                sideOffset={12}
                className="w-48"
                onCloseAutoFocus={(e) => {
                  if (!pendente.current) return;
                  e.preventDefault();
                  const alvo = pendente.current;
                  pendente.current = null;
                  abrir(alvo);
                }}
              >
                <DropdownMenuItem onSelect={() => (pendente.current = "lead")}>
                  <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                  Lead
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => (pendente.current = "tarefa")}>
                  <ListTodo className="h-4 w-4 mr-2 text-primary" />
                  Tarefa
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => (pendente.current = "lancamento")}>
                  <DollarSign className="h-4 w-4 mr-2 text-primary" />
                  Lançamento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Editorial */}
          <BottomLink item={ITEMS[2]} active={isActive(ITEMS[2].href)} />

          {/* Mais — abre o drawer completo */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu completo"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-muted-foreground active:bg-secondary/40 transition-colors"
          >
            <MoreHorizontal className="h-[21px] w-[21px]" />
            <span className="text-[10px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </nav>

      <MobileSidebar open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}

function BottomLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors",
        active ? "text-primary" : "text-muted-foreground active:bg-secondary/40"
      )}
    >
      <Icon className="h-[21px] w-[21px]" />
      <span className="text-[10px] font-medium leading-none">{item.label}</span>
    </Link>
  );
}
