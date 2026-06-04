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
  ChevronLeft, ChevronRight, ChevronDown,
  Palette, Target, LayoutTemplate, Stethoscope, NotebookPen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarSearchTrigger } from "@/components/sidebar-search-trigger";
import { useSidebarCollapsed } from "@/components/sidebar-collapsed-provider";

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[]; defaultOpen?: boolean };

// Atalhos fixos no topo (sem grupo) — acesso instantâneo.
const pinned: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Calendário", href: "/calendario", icon: Calendar },
];

// Grupos recolhíveis, em ordem de prioridade do dia a dia.
// defaultOpen=false → começa recolhido (menos scroll).
const groups: NavGroup[] = [
  {
    label: "Comercial",
    defaultOpen: true,
    items: [
      { label: "Leads", href: "/leads", icon: TrendingUp },
      { label: "Diagnósticos", href: "/diagnosticos", icon: Stethoscope },
      { label: "Propostas", href: "/propostas", icon: Send },
      { label: "Contratos", href: "/contratos", icon: FileSignature },
      { label: "Clientes", href: "/clientes", icon: Users },
      { label: "Financeiro", href: "/financeiro", icon: Wallet },
    ],
  },
  {
    label: "Produção",
    defaultOpen: true,
    items: [
      { label: "Editorial", href: "/editorial", icon: CalendarDays },
      // Palette: assets visuais (imagens/videos) pra ads
      { label: "Criativos Ads", href: "/criativos", icon: Palette },
      { label: "Projetos", href: "/projetos", icon: KanbanSquare },
      { label: "Tarefas", href: "/tarefas", icon: ListChecks },
    ],
  },
  {
    label: "Relatórios",
    defaultOpen: true,
    items: [
      { label: "Redes Sociais", href: "/relatorios/redes-sociais", icon: BarChart3 },
      { label: "SEO", href: "/relatorios/seo", icon: Search },
      // Target: trafego pago = segmentacao + conversao (alvo)
      { label: "Tráfego Pago", href: "/relatorios/trafego-pago", icon: Target },
    ],
  },
  {
    label: "Workspace",
    defaultOpen: true,
    items: [
      // NotebookPen: páginas livres estilo Notion (árvore + editor de blocos)
      { label: "Páginas", href: "/workspace", icon: NotebookPen },
      { label: "Reuniões", href: "/reunioes", icon: Mic },
      { label: "Notas", href: "/notas", icon: FileText },
      { label: "Mapas mentais", href: "/mapas", icon: GitBranch },
      { label: "Templates", href: "/templates", icon: LayoutTemplate },
    ],
  },
  {
    label: "Marketing SAL",
    defaultOpen: false,
    items: [
      // Megaphone — agencia "anunciando" conteudo proprio
      { label: "Conteúdo SAL", href: "/conteudo-sal", icon: Megaphone },
      { label: "Manual SAL", href: "/manual", icon: BookOpen },
    ],
  },
  {
    label: "Integrações",
    defaultOpen: false,
    items: [
      { label: "Drive", href: "/drive", icon: FolderOpen },
      { label: "Agenda", href: "/agenda", icon: CalendarRange },
    ],
  },
  {
    label: "Admin",
    defaultOpen: false,
    items: [
      { label: "Configurações", href: "/admin/configuracoes", icon: Settings },
      { label: "Claude / MCP", href: "/admin/mcp", icon: Cpu },
      { label: "Backups", href: "/admin/backups", icon: Database },
    ],
  },
];

const GRUPOS_STORAGE_KEY = "salhub.sidebar.grupos";

function rotaAtiva(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Item de navegação (ícone + label). Reusado no topo fixo e nos grupos. */
function NavLink({
  item,
  collapsed,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = rotaAtiva(pathname, item.href);
  const Icon = item.icon;
  const isPrivilegedRoute = item.href.startsWith("/admin");
  return (
    <Link
      href={item.href}
      prefetch={isPrivilegedRoute ? false : undefined}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
        collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-2.5 py-2 md:py-[7px]",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground font-medium hover:text-foreground hover:bg-secondary/60"
      )}
    >
      {active && !collapsed && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-primary"
        />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
        )}
        strokeWidth={1.75}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/**
 * Conteúdo interno da sidebar — usado tanto na versão desktop (aside
 * fixa à esquerda) quanto no drawer mobile. `onNavigate` é chamado
 * quando user clica num item — drawer mobile usa pra fechar.
 *
 * `collapsed=true` (só no desktop): mostra apenas ícones (sem labels;
 * grupos sempre "abertos" e separados por um divisor sutil), tooltip
 * nativo via `title` ao hover.
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

  // Recolher/expandir por grupo. Inicia vazio (= usa defaultOpen). O que
  // o user alterna fica salvo no localStorage. Server e 1º render do
  // client usam {} → sem mismatch de hidratação.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GRUPOS_STORAGE_KEY);
      if (raw) setOpenMap(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  function toggleGrupo(label: string, atual: boolean) {
    setOpenMap((prev) => {
      const next = { ...prev, [label]: !atual };
      try {
        localStorage.setItem(GRUPOS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

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
          className={cn("flex items-center gap-2.5", collapsed && "justify-center")}
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
          "flex-1 min-h-0 overflow-y-auto py-3",
          collapsed ? "px-1.5 space-y-1" : "px-2.5"
        )}
      >
        {/* Atalhos fixos (Dashboard / Calendário) */}
        <ul className={cn("space-y-px", !collapsed && "mb-1")}>
          {pinned.map((item) => (
            <li key={item.href}>
              <NavLink item={item} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>

        {/* Grupos recolhíveis */}
        {groups.map((g) => {
          const temAtiva = g.items.some((it) => rotaAtiva(pathname, it.href));
          const explicito = openMap[g.label];
          const aberto = collapsed
            ? true
            : explicito !== undefined
              ? explicito
              : (g.defaultOpen ?? true) || temAtiva;
          return (
            <div key={g.label} className={collapsed ? "" : "mt-2"}>
              {collapsed ? (
                <div className="mx-2 my-1 border-t border-border/60" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGrupo(g.label, aberto)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/60 outline-none transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <span>{g.label}</span>
                  {!aberto && temAtiva && (
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                  <ChevronDown
                    className={cn(
                      "ml-auto h-3.5 w-3.5 opacity-50 transition-transform duration-200",
                      !aberto && "-rotate-90"
                    )}
                  />
                </button>
              )}
              {aberto && (
                <ul className={cn("space-y-px", !collapsed && "mt-0.5")}>
                  {g.items.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
