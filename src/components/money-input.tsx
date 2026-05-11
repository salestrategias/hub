"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseBRNumber, formatBR } from "@/lib/number-br";

/**
 * Input de valor monetário tolerante a formato brasileiro.
 *
 * Aceita: "2500", "2.500", "2,500", "2.500,50", "R$ 2.500,50".
 * Sempre devolve um `number | null` no `onChange`.
 *
 * UX:
 *  - Enquanto digita, mantém o texto exato que o usuário inseriu
 *  - Ao perder foco (blur), formata em pt-BR (ex: "2.500")
 *  - Re-foco volta a mostrar formato editável
 *  - Vazio → null
 *
 * Não usa `type=number` (que interpreta vírgula errada). Usa text +
 * `inputMode=decimal` pra mostrar teclado numérico no mobile.
 */
type Props = {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  placeholder?: string;
  className?: string;
  prefix?: string; // default "R$"
  /** Casas decimais ao exibir formatado (default 0 = só inteiros tipo R$ 2.500) */
  decimals?: number;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
  prefix = "R$",
  decimals = 0,
  disabled,
  autoFocus,
}: Props) {
  const [raw, setRaw] = useState<string>(() => (value !== null && value !== undefined ? formatBR(value, decimals) : ""));
  const [foco, setFoco] = useState(false);

  // Sincroniza quando value externo muda (e não estamos digitando)
  useEffect(() => {
    if (!foco) {
      setRaw(value !== null && value !== undefined ? formatBR(value, decimals) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value);
    const parsed = parseBRNumber(e.target.value);
    onChange(parsed);
  }

  function handleBlur() {
    setFoco(false);
    // Re-formata no display
    const parsed = parseBRNumber(raw);
    if (parsed !== null) {
      setRaw(formatBR(parsed, decimals));
    } else {
      setRaw("");
    }
  }

  return (
    <div className={cn("relative", className)}>
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={handleChange}
        onFocus={() => setFoco(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn("font-mono tracking-tight", prefix && "pl-9")}
      />
    </div>
  );
}
