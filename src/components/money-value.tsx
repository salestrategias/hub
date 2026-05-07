"use client";
import { useHideValues } from "@/components/hide-values-provider";
import { cn } from "@/lib/utils";

type MoneyValueProps = {
  /** Valor numérico bruto. Ex: 4500.50 → "R$ 4.500,50". */
  value: number;
  /** Classes opcionais aplicadas ao wrapper. */
  className?: string;
  /** Comprimento dos `••` quando ocultado (default: 8). */
  hiddenLength?: number;
  /** Esconder o prefixo "R$" também? Default false (mantém pra contexto). */
  hidePrefix?: boolean;
  /** Quando true, ignora o estado global e SEMPRE mostra. Útil em modais. */
  alwaysShow?: boolean;
};

/**
 * Renderiza um valor monetário respeitando o toggle global de "ocultar valores".
 *
 * Visual quando ocultado: `R$ ••••••` (com bullets unicode pra parecer preenchido).
 * Hover mostra tooltip com hint "alt+v pra mostrar" (TODO futuro).
 */
export function MoneyValue({
  value,
  className,
  hiddenLength = 6,
  hidePrefix = false,
  alwaysShow = false,
}: MoneyValueProps) {
  const { hidden } = useHideValues();
  const shouldHide = !alwaysShow && hidden;

  const formatado = formatBRL(value);

  if (shouldHide) {
    const bullets = "•".repeat(hiddenLength);
    return (
      <span
        className={cn("inline-flex items-baseline gap-0.5 select-none tracking-tight", className)}
        aria-label="Valor oculto"
      >
        {!hidePrefix && <span className="text-muted-foreground/70">R$ </span>}
        <span className="text-muted-foreground">{bullets}</span>
      </span>
    );
  }

  return <span className={className}>{formatado}</span>;
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
