import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

type EmptyStateProps = {
  icon?: LucideIcon;
  titulo: string;
  descricao?: string;
  acaoLabel?: string;
  acaoHref?: string;
  acaoOnClick?: () => void;
  acaoIcon?: LucideIcon;
  variante?: "default" | "compact";
  className?: string;
};

/**
 * Empty state padronizado para listas vazias.
 *
 * Convenção visual: ícone grande sutil + título objetivo + descrição opcional + CTA principal.
 * Use em vez de <p>Sem registros</p> — converte uma "lista vazia frustrante" em "próxima ação clara".
 *
 * @example
 * <EmptyState icon={Users} titulo="Nenhum cliente cadastrado"
 *   descricao="Adicione seu primeiro cliente para começar."
 *   acaoLabel="Novo cliente" acaoOnClick={() => setOpen(true)} acaoIcon={Plus} />
 */
export function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  acaoLabel,
  acaoHref,
  acaoOnClick,
  acaoIcon: ActionIcon,
  variante = "default",
  className,
}: EmptyStateProps) {
  const compact = variante === "compact";

  const action = acaoLabel ? (
    acaoHref ? (
      <Button asChild>
        <Link href={acaoHref}>
          {ActionIcon && <ActionIcon className="h-4 w-4" />} {acaoLabel}
        </Link>
      </Button>
    ) : (
      <Button onClick={acaoOnClick}>
        {ActionIcon && <ActionIcon className="h-4 w-4" />} {acaoLabel}
      </Button>
    )
  ) : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 gap-2" : "py-16 gap-3",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "rounded-2xl flex items-center justify-center",
            compact ? "h-10 w-10" : "h-14 w-14"
          )}
          style={{
            background: "linear-gradient(135deg, rgba(126,48,225,0.10) 0%, rgba(126,48,225,0.04) 100%)",
            border: "1px solid rgba(126,48,225,0.18)",
          }}
        >
          <Icon className={cn("text-sal-400", compact ? "h-5 w-5" : "h-7 w-7")} />
        </div>
      )}
      <div className="space-y-1 max-w-md">
        <p className={cn("font-display font-semibold tracking-tight", compact ? "text-[14px]" : "text-[16px]")}>
          {titulo}
        </p>
        {descricao && (
          <p className={cn("text-muted-foreground leading-relaxed", compact ? "text-xs" : "text-sm")}>
            {descricao}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
