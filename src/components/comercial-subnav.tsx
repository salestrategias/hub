"use client";
/**
 * Hub 2.0 F3 — subnav persistente da esteira Comercial.
 *
 * A área "Comercial" da sidebar é UMA entrada; dentro dela a esteira
 * completa navega por estas pills, na ordem do funil real:
 * Pipeline → Diagnósticos → Briefings → Propostas → Contratos.
 *
 * Renderizada no topo das 5 telas — troca de contexto sem voltar pro menu.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Stethoscope, ClipboardList, Send, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";

const ETAPAS = [
  { label: "Pipeline", href: "/leads", icon: TrendingUp },
  { label: "Diagnósticos", href: "/diagnosticos", icon: Stethoscope },
  { label: "Briefings", href: "/briefings", icon: ClipboardList },
  { label: "Propostas", href: "/propostas", icon: Send },
  { label: "Contratos", href: "/contratos", icon: FileSignature },
];

export function ComercialSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Etapas do comercial"
      className="flex items-center gap-1 flex-wrap -mt-1 mb-4 border-b border-border pb-3"
    >
      {ETAPAS.map((e, i) => {
        const ativa = pathname.startsWith(e.href);
        const Icon = e.icon;
        return (
          <span key={e.href} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/40 text-[11px] select-none">›</span>}
            <Link
              href={e.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                ativa
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {e.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
