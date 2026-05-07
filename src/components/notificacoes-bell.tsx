"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Bell,
  FileSignature,
  ListChecks,
  Mic,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TipoNotificacao } from "@prisma/client";

type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  descricao: string | null;
  href: string | null;
  lida: boolean;
  createdAt: string;
};

const ICONES: Record<TipoNotificacao, React.ComponentType<{ className?: string }>> = {
  CONTRATO_VENCENDO: FileSignature,
  ACTION_ITEM_ATRASADO: AlertCircle,
  TAREFA_ATRASADA: ListChecks,
  REUNIAO_HOJE: Mic,
  POST_HOJE: FileText,
  SISTEMA: Sparkles,
};

const POLL_MS = 60_000;

export function NotificacoesBell() {
  const [items, setItems] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const cancelado = useRef(false);

  const fetchNotificacoes = useCallback(async () => {
    try {
      const res = await fetch("/api/notificacoes?limite=30");
      if (!res.ok) return;
      const data = await res.json();
      if (cancelado.current) return;
      setItems(data.items ?? []);
      setNaoLidas(data.naoLidas ?? 0);
    } catch {
      // silencioso — é polling
    }
  }, []);

  // Poll inicial + a cada 60s
  useEffect(() => {
    cancelado.current = false;
    fetchNotificacoes();
    const interval = setInterval(fetchNotificacoes, POLL_MS);
    return () => {
      cancelado.current = true;
      clearInterval(interval);
    };
  }, [fetchNotificacoes]);

  // Refresh ao abrir o popover (caso poll esteja desync)
  useEffect(() => {
    if (open) fetchNotificacoes();
  }, [open, fetchNotificacoes]);

  async function clicar(n: Notificacao) {
    setOpen(false);
    if (!n.lida) {
      // optimistic update
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, lida: true } : p)));
      setNaoLidas((c) => Math.max(0, c - 1));
      void fetch(`/api/notificacoes/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lida: true }),
      });
    }
    if (n.href) router.push(n.href);
  }

  async function marcarTodas() {
    setItems((prev) => prev.map((p) => ({ ...p, lida: true })));
    setNaoLidas(0);
    await fetch("/api/notificacoes/marcar-todas", { method: "POST" });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center"
              aria-label={`${naoLidas} não lidas`}
            >
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-[360px] p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-sal-400" />
            <span className="font-semibold text-sm">Notificações</span>
            {naoLidas > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground">{naoLidas} não lidas</span>
            )}
          </div>
          {naoLidas > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={marcarTodas}>
              <Check className="h-3 w-3" /> Tudo lido
            </Button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Tudo em dia.</p>
              <p className="text-[10.5px] text-muted-foreground/60 mt-0.5">
                Sem alertas pendentes no momento.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = ICONES[n.tipo] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => clicar(n)}
                      className={cn(
                        "w-full text-left flex items-start gap-3 px-4 py-3 transition hover:bg-secondary/50 group",
                        !n.lida && "bg-sal-600/[0.04]"
                      )}
                    >
                      <div
                        className={cn(
                          "h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                          n.lida ? "bg-secondary text-muted-foreground" : "bg-sal-600/15 text-sal-400"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[12.5px] flex-1 truncate", !n.lida && "font-semibold")}>
                            {n.titulo}
                          </span>
                          {!n.lida && <span className="h-1.5 w-1.5 rounded-full bg-sal-500 shrink-0" />}
                        </div>
                        {n.descricao && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.descricao}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                          {relTime(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border text-center">
          <span className="text-[10px] text-muted-foreground/60">
            Atualiza a cada minuto
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
