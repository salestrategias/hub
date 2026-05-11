"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoneyInput } from "@/components/money-input";
import { parseBRNumber } from "@/lib/number-br";

type InlineFieldStatus = "idle" | "saving" | "saved" | "error";

type CommonProps = {
  label?: string;
  /** Auto-save: chamada com debounce após mudança. Não recebe `value` — assume estado interno. */
  onSave: (value: string) => Promise<void> | void;
  /** Debounce em ms. Default 700. */
  debounceMs?: number;
  /** Placeholder do input/textarea. */
  placeholder?: string;
  /** Tamanho visual. */
  size?: "sm" | "md" | "lg";
  /** Read-only? Útil pra campos calculados. */
  readOnly?: boolean;
  className?: string;
};

type InlineTextProps = CommonProps & {
  type: "text" | "email" | "url" | "tel";
  value: string;
  /** Função monetária? Aplica máscara R$ na exibição. */
  money?: boolean;
};

type InlineNumberProps = CommonProps & {
  type: "number";
  value: number;
  /** Símbolo de prefixo (ex: "R$ "). */
  prefix?: string;
  step?: number;
  min?: number;
  max?: number;
};

type InlineTextareaProps = CommonProps & {
  type: "textarea";
  value: string;
  rows?: number;
};

type InlineSelectProps = CommonProps & {
  type: "select";
  value: string;
  options: Array<{ value: string; label: string }>;
};

type InlineDateProps = CommonProps & {
  type: "date" | "datetime-local";
  value: string | null;
};

type InlineMoneyProps = CommonProps & {
  type: "money";
  value: number;
  /** Casas decimais. Default 0 (R$ 2.500). Use 2 pra centavos. */
  decimals?: number;
  prefix?: string;
};

type InlineFieldProps =
  | InlineTextProps
  | InlineNumberProps
  | InlineTextareaProps
  | InlineSelectProps
  | InlineDateProps
  | InlineMoneyProps;

/**
 * Campo de formulário com auto-save debounced.
 *
 * Padrão de uso:
 *   <InlineField type="text" label="Nome" value={cliente.nome}
 *     onSave={(v) => fetch(`/api/clientes/${id}`, { method: "PATCH", body: JSON.stringify({ nome: v }) })} />
 *
 * Comportamento:
 *  - Mudança no value → marca status="saving" → debounce → chama onSave → status="saved" (1.5s) → "idle"
 *  - Erro no onSave → status="error" (3s) → "idle"
 *  - Quando value externo muda (ex: outro device atualizou), reflete o novo valor
 */
export function InlineField(props: InlineFieldProps) {
  const initial = String(props.value ?? "");
  const [internal, setInternal] = useState(initial);
  const [status, setStatus] = useState<InlineFieldStatus>("idle");
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const debounceMs = props.debounceMs ?? 700;
  const onSave = props.onSave;

  // Sync com value externo se mudou de fora (e não estamos editando).
  useEffect(() => {
    if (status === "idle" || status === "saved") {
      setInternal(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const trigger = useCallback(
    (newValue: string) => {
      setInternal(newValue);
      setStatus("saving");
      setErroMsg(null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          await onSave(newValue);
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 1500);
        } catch (e) {
          setStatus("error");
          setErroMsg(e instanceof Error ? e.message : "Erro ao salvar");
          setTimeout(() => setStatus("idle"), 3000);
        }
      }, debounceMs);
    },
    [onSave, debounceMs]
  );

  // Pra select/date, salvamos imediato (sem debounce de digitação)
  const triggerImmediate = useCallback(
    async (newValue: string) => {
      setInternal(newValue);
      setStatus("saving");
      setErroMsg(null);
      try {
        await onSave(newValue);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1500);
      } catch (e) {
        setStatus("error");
        setErroMsg(e instanceof Error ? e.message : "Erro ao salvar");
        setTimeout(() => setStatus("idle"), 3000);
      }
    },
    [onSave]
  );

  const sizeClass = props.size === "sm" ? "text-xs h-7" : props.size === "lg" ? "text-base h-10" : "text-sm h-8";

  return (
    <div className={cn("space-y-1.5", props.className)}>
      {props.label && (
        <div className="flex items-center gap-2">
          <label className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
            {props.label}
          </label>
          <StatusIndicator status={status} erroMsg={erroMsg} />
        </div>
      )}

      {props.type === "textarea" ? (
        <textarea
          value={internal}
          onChange={(e) => trigger(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows ?? 3}
          readOnly={props.readOnly}
          className={cn(
            "w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "transition-colors resize-y",
            status === "error" && "border-destructive focus:ring-destructive"
          )}
        />
      ) : props.type === "select" ? (
        <select
          value={internal}
          onChange={(e) => triggerImmediate(e.target.value)}
          disabled={props.readOnly}
          className={cn(
            "w-full rounded-md border border-border bg-background/40 px-2 py-1.5",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            sizeClass,
            status === "error" && "border-destructive"
          )}
        >
          {props.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : props.type === "date" || props.type === "datetime-local" ? (
        <input
          type={props.type}
          value={internal}
          onChange={(e) => triggerImmediate(e.target.value)}
          readOnly={props.readOnly}
          className={cn(
            "w-full rounded-md border border-border bg-background/40 px-2 py-1.5 font-mono",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            sizeClass,
            status === "error" && "border-destructive"
          )}
        />
      ) : props.type === "money" ? (
        <MoneyInput
          value={internal === "" ? null : parseBRNumber(internal)}
          onChange={(n) => trigger(n === null ? "" : String(n))}
          placeholder={props.placeholder}
          prefix={props.prefix ?? "R$"}
          decimals={props.decimals ?? 0}
          disabled={props.readOnly}
        />
      ) : props.type === "number" ? (
        <div className="relative">
          {props.prefix && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              {props.prefix}
            </span>
          )}
          <input
            type="number"
            value={internal}
            onChange={(e) => trigger(e.target.value)}
            placeholder={props.placeholder}
            step={props.step}
            min={props.min}
            max={props.max}
            readOnly={props.readOnly}
            className={cn(
              "w-full rounded-md border border-border bg-background/40 py-1.5 font-mono",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              sizeClass,
              props.prefix ? "pl-9 pr-2" : "px-2",
              status === "error" && "border-destructive"
            )}
          />
        </div>
      ) : (
        <input
          type={props.type}
          value={internal}
          onChange={(e) => trigger(e.target.value)}
          placeholder={props.placeholder}
          readOnly={props.readOnly}
          className={cn(
            "w-full rounded-md border border-border bg-background/40 px-2.5 py-1.5",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            sizeClass,
            status === "error" && "border-destructive"
          )}
        />
      )}
    </div>
  );
}

function StatusIndicator({ status, erroMsg }: { status: InlineFieldStatus; erroMsg: string | null }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground/70">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> salvando
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[9.5px] text-emerald-400">
        <Check className="h-2.5 w-2.5" /> salvo
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-[9.5px] text-destructive" title={erroMsg ?? "erro"}>
        ✗ erro
      </span>
    );
  }
  return null;
}
