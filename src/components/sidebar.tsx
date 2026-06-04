"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Users, CalendarDays, KanbanSquare, ListChecks,
  Wallet, FileSignature, FolderOpen, CalendarRange, BarChart3, Search, Megaphone,
  Mic, FileText, GitBranch, Cpu, Database, Send, TrendingUp, Settings, Calendar, BookOpen,
  ChevronLeft, ChevronRight,
  Palette, Target, LayoutTemplate, Stethoscope, NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarSearchTrigger } from "@/components/sidebar-search-trigger";
import { useSidebarCollapsed } from "@/components/sidebar-collapsed-provider";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Calendário", href: "/calendario", icon: Calendar },
    ],
  },
  { label: "Clientes", items: [{ label: "Clientes", href: "/clientes", icon: Users }] },
  {
    label: "Produção",
    items: [
      { label: "Editorial", href: "/editorial", icon: CalendarDays },
      // Palette: assets visuais (imagens/videos) pra ads — destaca o aspecto criativo
      { label: "Criativos Ads", href: "/criativos", icon: Palette },
      { label: "Projetos", href: "/projetos", icon: KanbanSquare },
      { label: "Tarefas", href: "/tarefas", icon: ListChecks },
    ],
  },
  {
    label: "Workspace",
    items: [
      // NotebookPen: páginas livres estilo Notion (árvore + editor de blocos)
      { label: "Páginas", href: "/workspace", icon: NotebookPen },
      { label: "Reuniões", href: "/reunioes", icon: Mic },
      { label: "Notas", href: "/notas", icon: FileText },
      { label: "Mapas mentais", href: "/mapas", icon: GitBranch },
      // LayoutTemplate evita conflito com Sparkles (usado em botoes "Gerar com IA")
      { label: "Templates", href: "/templates", icon: LayoutTemplate },
    ],
  },
  {
    label: "Marketing SAL",
    items: [
      // Megaphone mantido aqui — agencia "anunciando" conteudo proprio
      { label: "Conteúdo SAL", href: "/conteudo-sal", icon: Megaphone },
      { label: "Manual SAL", href: "/manual", icon: BookOpen },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Leads", href: "/leads", icon: TrendingUp },
      { label: "Diagnósticos", href: "/diagnosticos", icon: Stethoscope },
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
      // Target: trafego pago = segmentacao + conversao (alvo)
      { label: "Tráfego Pago", href: "/relatorios/trafego-pago", icon: Target },
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

/**
 * Conteúdo interno da sidebar — usado tanto na versão desktop (aside
 * fixa à esquerda) quanto no drawer mobile. `onNavigate` é chamado
 * quando user clica num item — drawer mobile usa pra fechar.
 *
 * Retorna os 3 blocos (header / nav / footer) como Fragment. O pai
 * (aside desktop ou drawer mobile) já é `flex flex-col`, então esses
 * 3 elementos viram filhos diretos do flex container — sem wrapper
 * intermediário, que causava colapso do nav em alguns browsers mobile.
 *
 * Header e footer têm `shrink-0`. Nav tem `flex-1 min-h-0` pra esticar
 * e habilitar scroll interno.
 *
 * `collapsed=true` (só no desktop): mostra apenas ícones (sem labels nem
 * grupos), tooltip nativo via `title` ao hover. Botão de toggle ao final.
 */
function SidebarConteudo({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      <div
        className={cn(
          "border-b border-border shrink-0 bg-card",
          collapsed ? "px-2 pt-3 pb-3" : "px-4 pt-5 pb-4"
        )}
      >
        <Link
          href="/"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5",
            collapsed && "justify-center"
          )}
          title={collapsed ? "SAL Hub" : undefined}
        >
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)",
              boxShadow: "0 4px 14px rgba(126,48,225,0.4), 0 1px 0 rgba(255,255,255,0.1) inset",
            }}
          >
            <Image src="/sal-logo-white.svg" alt="SAL" width={20} height={20} className="brightness-0 invert" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-display font-semibold text-[14px] leading-none">SAL Hub</div>
              <div className="text-[10px] text-muted-foreground/70 mt-0.5 uppercase tracking-wider">
                Estratégias de Marketing
              </div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <div className="mt-3.5">
            <SidebarSearchTrigger />
          </div>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 min-h-0 overflow-y-auto py-3 space-y-5",
          collapsed ? "px-1.5" : "px-2.5"
        )}
      >
        {groups.map((g) => (
          <div key={g.label}>
            {!collapsed && (
              <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/60">
                {g.label}
              </div>
            )}
            <ul className="space-y-px">
              {g.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                const isPrivilegedRoute = item.href.startsWith("/admin");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={isPrivilegedRoute ? false : undefined}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "relative flex items-center rounded-lg text-[13px] transition-colors",
                        collapsed
                          ? "justify-center px-2 py-2"
                          : "gap-2.5 px-2.5 py-2 md:py-[7px]",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground font-medium hover:text-foreground hover:bg-secondary/60"
                      )}
                    >
                      {/* Indicador sutil do item ativo — barra arredondada na cor primária */}
                      {active && !collapsed && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-primary"
                        />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "border-t border-border shrink-0",
          collapsed ? "px-2 py-2" : "px-4 py-3"
        )}
      >
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "w-full flex items-center rounded-md py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition",
              collapsed ? "justify-center px-2" : "justify-end px-2.5 gap-1.5"
            )}
            title={collapsed ? "Expandir menu (atalho: [ )" : "Recolher menu (atalho: [ )"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <span>Recolher</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        )}
        {!collapsed && (
          <div className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
            v1.0.0 · Self-hosted
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Sidebar desktop — fixa à esquerda. Escondida no mobile (< md).
 *
 * Largura é dinâmica conforme `collapsed` do SidebarCollapsedProvider:
 *   expandida: 232px (labels + grupos visíveis)
 *   colapsada: 56px (só ícones, tooltip nativo no hover)
 *
 * A transição é animada (transição de width). O conteúdo da page se
 * ajusta automaticamente porque o aside é `shrink-0` num flex parent.
 */
export function Sidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();
  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r border-border bg-card sticky top-0 h-screen transition-[width] duration-200 ease-out",
        collapsed ? "w-[56px]" : "w-[232px]"
      )}
    >
      <SidebarConteudo collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  );
}

/**
 * Sidebar mobile — drawer slide-in da esquerda. Controlado externamente
 * pelo Header (que tem o botão hamburger). Auto-fecha ao navegar e ao
 * trocar de página.
 *
 * RENDERIZADO VIA PORTAL no `document.body`. Motivo: o `<Header>` global
 * tem `glass` que aplica `backdrop-filter`. Qualquer ancestral com
 * `filter`/`transform`/`backdrop-filter` cria um novo containing block
 * pra elementos `position: fixed`, fazendo eles ficarem fixed dentro
 * do header (altura ~64px) em vez do viewport. Portal escapa essa armadilha
 * renderizando direto no body — `fixed` volta a ser relativo ao viewport.
 */
export function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pathname = usePathname();
  const [montado, setMontado] = useState(false);

  // Portal só renderiza depois de mount (evita SSR + window undefined)
  useEffect(() => setMontado(true), []);

  // Fecha automaticamente ao mudar de rota (caso usuário use back/forward)
  useEffect(() => {
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock scroll do body quando drawer aberto (evita scroll behind no iOS)
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open || !montado) return null;

  return createPortal(
    <>
      {/* Overlay — z-[60] pra ficar acima do Header (z-30) e qualquer
          conteúdo da página. */}
      <div
        className="md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/* Drawer — z-[70] acima do overlay. Largura 260px clamp pra não
          estourar em telas muito pequenas. */}
      <aside className="md:hidden fixed inset-y-0 left-0 z-[70] w-[min(260px,85vw)] flex flex-col border-r border-border bg-card shadow-2xl">
        <SidebarConteudo onNavigate={() => onOpenChange(false)} />
      </aside>
    </>,
    document.body
  );
}
