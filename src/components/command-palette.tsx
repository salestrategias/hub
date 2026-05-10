"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ArrowRight, Users, Mic, FileText, ListChecks, FolderKanban,
  CalendarDays, FileSignature, Wallet, BarChart3, GitBranch, Plus,
  LayoutDashboard, FolderOpen, CalendarRange, Cpu, Database, User,
  CornerDownLeft, ArrowUp, ArrowDown, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────
   Comandos estáticos (navegação + ações comuns).
   Sempre aparecem como sugestão antes do usuário digitar.
   ──────────────────────────────────────────────────────────── */

type StaticCommand = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof LayoutDashboard;
  /** Destino quando é navegação. */
  href?: string;
  /** Nome de um custom event a disparar quando é ação (ex: abrir modal). Tem precedência sobre href. */
  event?: string;
  group: "Ir para" | "Criar" | "Ação";
  keywords: string[];
};

const STATIC_COMMANDS: StaticCommand[] = [
  // Ações rápidas
  {
    id: "act-quick-capture",
    label: "Captura rápida",
    hint: "tecla C · anota sem mudar de página",
    icon: Zap,
    event: "sal-hub:quick-capture-open",
    group: "Ação",
    keywords: ["quick", "capture", "anotar", "nota rapida", "inbox", "ideia"],
  },
  // Ir para
  { id: "go-dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/", group: "Ir para", keywords: ["home", "inicio", "kpi"] },
  { id: "go-clientes", label: "Clientes", icon: Users, href: "/clientes", group: "Ir para", keywords: ["crm"] },
  { id: "go-editorial", label: "Editorial", icon: CalendarDays, href: "/editorial", group: "Ir para", keywords: ["posts", "calendario", "social"] },
  { id: "go-projetos", label: "Projetos", icon: FolderKanban, href: "/projetos", group: "Ir para", keywords: ["kanban"] },
  { id: "go-tarefas", label: "Tarefas", icon: ListChecks, href: "/tarefas", group: "Ir para", keywords: ["todo"] },
  { id: "go-reunioes", label: "Reuniões", icon: Mic, href: "/reunioes", group: "Ir para", keywords: ["meeting", "transcricao"] },
  { id: "go-notas", label: "Notas", icon: FileText, href: "/notas", group: "Ir para", keywords: ["obsidian", "markdown"] },
  { id: "go-mapas", label: "Mapas Mentais", icon: GitBranch, href: "/mapas", group: "Ir para", keywords: ["mindmap", "excalidraw", "brainstorm"] },
  { id: "go-financeiro", label: "Financeiro", icon: Wallet, href: "/financeiro", group: "Ir para", keywords: ["mrr", "receita", "despesa"] },
  { id: "go-contratos", label: "Contratos", icon: FileSignature, href: "/contratos", group: "Ir para", keywords: ["renovacao"] },
  { id: "go-drive", label: "Google Drive", icon: FolderOpen, href: "/drive", group: "Ir para", keywords: ["arquivos"] },
  { id: "go-agenda", label: "Google Agenda", icon: CalendarRange, href: "/agenda", group: "Ir para", keywords: ["calendar", "eventos"] },
  { id: "go-redes", label: "Relatório Redes Sociais", icon: BarChart3, href: "/relatorios/redes-sociais", group: "Ir para", keywords: ["instagram", "facebook"] },
  { id: "go-seo", label: "Relatório SEO", icon: BarChart3, href: "/relatorios/seo", group: "Ir para", keywords: ["organico", "google"] },
  { id: "go-trafego", label: "Relatório Tráfego Pago", icon: BarChart3, href: "/relatorios/trafego-pago", group: "Ir para", keywords: ["ads", "meta", "performance"] },
  { id: "go-perfil", label: "Meu perfil", icon: User, href: "/perfil", group: "Ir para", keywords: ["conta", "senha"] },
  { id: "go-mcp", label: "Admin / Claude MCP", icon: Cpu, href: "/admin/mcp", group: "Ir para", keywords: ["token", "ai", "claude"] },
  { id: "go-backups", label: "Admin / Backups", icon: Database, href: "/admin/backups", group: "Ir para", keywords: ["restore", "snapshot"] },
];

/* ────────────────────────────────────────────────────────────
   Resultados da busca (vindo da /api/buscar)
   ──────────────────────────────────────────────────────────── */

type SearchResults = {
  clientes: Array<{ id: string; nome: string; status: string; email: string | null }>;
  notas: Array<{ id: string; titulo: string; pasta: string }>;
  reunioes: Array<{ id: string; titulo: string; data: string; cliente: { nome: string } | null }>;
  tarefas: Array<{ id: string; titulo: string; concluida: boolean; prioridade: string; cliente: { nome: string } | null }>;
  posts: Array<{ id: string; titulo: string; status: string; cliente: { id: string; nome: string }; dataPublicacao: string }>;
  projetos: Array<{ id: string; nome: string; status: string; cliente: { nome: string } | null }>;
  contratos: Array<{ id: string; dataFim: string; status: string; cliente: { id: string; nome: string } }>;
};

const EMPTY: SearchResults = { clientes: [], notas: [], reunioes: [], tarefas: [], posts: [], projetos: [], contratos: [] };

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: typeof LayoutDashboard;
  href?: string;
  /** Custom event a disparar (alternativa a href). */
  event?: string;
};

/* ────────────────────────────────────────────────────────────
   Hook que escuta ⌘K / Ctrl+K globalmente
   ──────────────────────────────────────────────────────────── */

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K (mac) ou Ctrl+K (win/linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // ESC fecha
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}

/* ────────────────────────────────────────────────────────────
   Componente principal
   ──────────────────────────────────────────────────────────── */

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(EMPTY);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Busca server-side com debounce 200ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/buscar?q=${encodeURIComponent(query.trim())}`);
        const data = await r.json();
        setResults(data && !data.error ? data : EMPTY);
      } catch {
        setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Lista plana ordenada de items (ou estáticos quando query vazia, ou search results)
  const items: Item[] = useMemo(() => {
    if (query.trim().length < 2) {
      const grouped = STATIC_COMMANDS.reduce<Record<string, StaticCommand[]>>((acc, c) => {
        acc[c.group] = acc[c.group] ?? [];
        acc[c.group].push(c);
        return acc;
      }, {});
      const all: Item[] = [];
      for (const group of Object.keys(grouped)) {
        for (const c of grouped[group]) {
          all.push({
            id: c.id,
            group: c.group,
            label: c.label,
            hint: c.hint,
            icon: c.icon,
            href: c.href,
            event: c.event,
          });
        }
      }
      // Filtra por query simples se houver 1 char
      const q = query.trim().toLowerCase();
      if (!q) return all;
      return all.filter((i) =>
        i.label.toLowerCase().includes(q) ||
        STATIC_COMMANDS.find((c) => c.id === i.id)?.keywords.some((k) => k.includes(q))
      );
    }

    // Resultados da busca
    const out: Item[] = [];
    results.clientes.forEach((c) => out.push({
      id: `c-${c.id}`, group: "Clientes", label: c.nome,
      hint: c.email ?? c.status, icon: Users, href: `/clientes/${c.id}`,
    }));
    results.notas.forEach((n) => out.push({
      id: `n-${n.id}`, group: "Notas", label: n.titulo,
      hint: n.pasta, icon: FileText, href: `/notas`,
    }));
    results.reunioes.forEach((r) => out.push({
      id: `r-${r.id}`, group: "Reuniões", label: r.titulo,
      hint: r.cliente?.nome ?? new Date(r.data).toLocaleDateString("pt-BR"),
      icon: Mic, href: `/reunioes/${r.id}`,
    }));
    results.tarefas.forEach((t) => out.push({
      id: `t-${t.id}`, group: "Tarefas", label: t.titulo,
      hint: `${t.cliente?.nome ?? "—"} · ${t.prioridade.toLowerCase()}`,
      icon: ListChecks, href: `/tarefas`,
    }));
    results.posts.forEach((p) => out.push({
      id: `p-${p.id}`, group: "Posts", label: p.titulo,
      hint: `${p.cliente.nome} · ${p.status.toLowerCase()}`,
      icon: CalendarDays, href: `/editorial`,
    }));
    results.projetos.forEach((p) => out.push({
      id: `pj-${p.id}`, group: "Projetos", label: p.nome,
      hint: `${p.cliente?.nome ?? "—"} · ${p.status.toLowerCase()}`,
      icon: FolderKanban, href: `/projetos`,
    }));
    results.contratos.forEach((c) => out.push({
      id: `ct-${c.id}`, group: "Contratos", label: c.cliente.nome,
      hint: `vence ${new Date(c.dataFim).toLocaleDateString("pt-BR")} · ${c.status.toLowerCase()}`,
      icon: FileSignature, href: `/contratos`,
    }));

    // Inclui também comandos estáticos que batem
    const q = query.trim().toLowerCase();
    STATIC_COMMANDS
      .filter((c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)))
      .forEach((c) => out.push({ id: c.id, group: c.group, label: c.label, icon: c.icon, href: c.href }));

    return out;
  }, [query, results]);

  // Reset activeIndex quando lista muda
  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, query]);

  // Garante que item ativo está visível ao scrollar
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const select = useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.event) {
        // Custom event — outro provider/listener trata (ex: quick-capture)
        // Defer ao próximo tick pra que o close anime sem competir com o novo modal
        setTimeout(() => window.dispatchEvent(new CustomEvent(item.event!)), 0);
        return;
      }
      if (item.href) {
        router.push(item.href);
      }
    },
    [router, setOpen]
  );

  // Agrupa items na ordem em que aparecem
  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Item[]>();
    items.forEach((it) => {
      if (!map.has(it.group)) {
        map.set(it.group, []);
        order.push(it.group);
      }
      map.get(it.group)!.push(it);
    });
    return order.map((g) => ({ name: g, items: map.get(g)! }));
  }, [items]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-start justify-items-center pt-[12vh] px-4"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px] animate-in"
        style={{ animation: "fadeIn 0.15s ease-out" }}
      />
      <div
        className="relative w-full max-w-xl rounded-xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
          maxHeight: "70vh",
          animation: "slideUp 0.2s ease-out",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (items[activeIndex]) select(items[activeIndex]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Buscar clientes, notas, reuniões — ou digite um comando..."
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-muted-foreground/70"
          />
          {loading && (
            <div className="h-3 w-3 rounded-full border-2 border-sal-400/30 border-t-sal-400 animate-spin" />
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary border border-border text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {query.trim().length < 2
                  ? "Digite ao menos 2 caracteres para buscar"
                  : `Nada encontrado para "${query}"`}
              </p>
            </div>
          ) : (
            (() => {
              let absoluteIdx = 0;
              return grouped.map((g) => (
                <div key={g.name} className="mb-1.5">
                  <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                    {g.name}
                  </div>
                  {g.items.map((it) => {
                    const idx = absoluteIdx++;
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.id}
                        data-index={idx}
                        onClick={() => select(it)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                          idx === activeIndex
                            ? "bg-sal-600/15 text-foreground"
                            : "hover:bg-secondary/40 text-foreground/80"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            idx === activeIndex ? "text-sal-400" : "text-muted-foreground"
                          )}
                        />
                        <span className="text-[13.5px] truncate flex-1">{it.label}</span>
                        {it.hint && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {it.hint}
                          </span>
                        )}
                        {idx === activeIndex && (
                          <ArrowRight className="h-3 w-3 text-sal-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded font-mono bg-secondary border border-border">
              <ArrowUp className="h-2.5 w-2.5" />
            </kbd>
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded font-mono bg-secondary border border-border">
              <ArrowDown className="h-2.5 w-2.5" />
            </kbd>
            <span>navegar</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded font-mono bg-secondary border border-border">
              <CornerDownLeft className="h-2.5 w-2.5" />
            </kbd>
            <span>abrir</span>
          </span>
          <span className="ml-auto">⌘K para alternar</span>
        </div>
      </div>
    </div>
  );
}
