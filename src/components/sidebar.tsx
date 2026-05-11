"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarDays, KanbanSquare, ListChecks,
  Wallet, FileSignature, FolderOpen, CalendarRange, BarChart3, Search, Megaphone,
  Mic, FileText, GitBranch, Cpu, Database, Sparkles, Send, TrendingUp, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarSearchTrigger } from "@/components/sidebar-search-trigger";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Visão Geral", items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }] },
  { label: "Clientes", items: [{ label: "CRM", href: "/clientes", icon: Users }] },
  {
    label: "Produção",
    items: [
      { label: "Editorial", href: "/editorial", icon: CalendarDays },
      { label: "Projetos", href: "/projetos", icon: KanbanSquare },
      { label: "Tarefas", href: "/tarefas", icon: ListChecks },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Reuniões", href: "/reunioes", icon: Mic },
      { label: "Notas", href: "/notas", icon: FileText },
      { label: "Mapas mentais", href: "/mapas", icon: GitBranch },
      { label: "Templates", href: "/templates", icon: Sparkles },
    ],
  },
  {
    label: "Marketing SAL",
    items: [
      { label: "Conteúdo SAL", href: "/conteudo-sal", icon: Megaphone },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Pipeline", href: "/leads", icon: TrendingUp },
      { label: "Propostas", href: "/propostas", icon: Send },
      { label: "Contratos", href: "/contratos", icon: FileSignature },
      { label: "Financeiro", href: "/financeiro", icon: Wallet },
    ],
  },
  {
    label: "Google",
    items: [
      { label: "Drive", href: "/drive", icon: FolderOpen },
      { label: "Agenda", href: "/agenda", icon: CalendarRange },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { label: "Redes Sociais", href: "/relatorios/redes-sociais", icon: BarChart3 },
      { label: "SEO", href: "/relatorios/seo", icon: Search },
      { label: "Tráfego Pago", href: "/relatorios/trafego-pago", icon: Megaphone },
    ],
  },
  {
    label: "Administração",
    items: [
      { label: "Configurações", href: "/admin/configuracoes", icon: Settings },
      { label: "Claude / MCP", href: "/admin/mcp", icon: Cpu },
      { label: "Backups", href: "/admin/backups", icon: Database },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-[232px] shrink-0 flex-col border-r border-border bg-card/40 sticky top-0 h-screen">
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)",
              boxShadow: "0 4px 14px rgba(126,48,225,0.4), 0 1px 0 rgba(255,255,255,0.1) inset",
            }}
          >
            <Image src="/sal-logo-white.svg" alt="SAL" width={20} height={20} className="brightness-0 invert" />
          </div>
          <div>
            <div className="font-display font-semibold text-[14px] leading-none">SAL Hub</div>
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 uppercase tracking-wider">Estratégias de Marketing</div>
          </div>
        </Link>
        <div className="mt-3.5">
          <SidebarSearchTrigger />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                // Rotas admin têm auth/role check + acesso a filesystem;
                // prefetch RSC nelas pode gerar 404 cosmético no DevTools.
                // Desabilitamos pra evitar ruído + economizar payload.
                const isPrivilegedRoute = item.href.startsWith("/admin");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={isPrivilegedRoute ? false : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors font-medium",
                        active
                          ? "bg-primary/15 text-sal-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      )}
                      style={active ? { boxShadow: "inset 2px 0 0 #7E30E1" } : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border text-[10px] text-muted-foreground/60">
        v1.0.0 · Self-hosted
      </div>
    </aside>
  );
}
