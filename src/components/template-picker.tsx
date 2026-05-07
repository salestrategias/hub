"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Search, FileText, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateTipo } from "@prisma/client";

type Template = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: TemplateTipo;
  categoria: string | null;
  icone: string | null;
  cor: string | null;
  quantidadeUsos: number;
  ultimoUso: string | null;
};

type TemplatePickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Tipos aceitos no contexto. Default: aceita todos. */
  tipos?: TemplateTipo[];

  /** Cliente associado — passado pra expandir {{cliente.nome}} */
  clienteId?: string | null;

  /** Callback quando o usuário escolhe "Em branco" — fluxo legado. */
  onBlank?: () => void;

  /**
   * Callback quando uma template foi instanciada com sucesso.
   * Recebe `{ id, redirect }` retornado pela API.
   * Default: navega pra `redirect`.
   */
  onPicked?: (result: { id: string; redirect: string }) => void;

  /** Texto custom do botão "em branco" (default: "Começar do zero"). */
  blankLabel?: string;
};

const TIPO_LABELS: Record<TemplateTipo, string> = {
  NOTA: "Nota",
  REUNIAO: "Reunião",
  BRIEFING: "Briefing",
  TAREFA: "Tarefa",
  PROJETO: "Projeto",
};

export function TemplatePicker({
  open,
  onOpenChange,
  tipos,
  clienteId,
  onBlank,
  onPicked,
  blankLabel = "Começar do zero",
}: TemplatePickerProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [busca, setBusca] = useState("");
  const [instanciandoId, setInstanciandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTemplates(null);

    const params = new URLSearchParams();
    if (tipos && tipos.length > 0) params.set("tipo", tipos.join(","));

    fetch(`/api/templates?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]));
  }, [open, tipos]);

  const filtrados = useMemo(() => {
    if (!templates) return [];
    if (!busca.trim()) return templates;
    const q = busca.toLowerCase();
    return templates.filter(
      (t) =>
        t.nome.toLowerCase().includes(q) ||
        (t.descricao?.toLowerCase().includes(q) ?? false) ||
        (t.categoria?.toLowerCase().includes(q) ?? false)
    );
  }, [templates, busca]);

  async function instanciar(t: Template) {
    setInstanciandoId(t.id);
    try {
      const res = await fetch(`/api/templates/${t.id}/instanciar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: clienteId ?? null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao usar template");
      }
      const result = (await res.json()) as { id: string; redirect: string };
      onOpenChange(false);
      if (onPicked) {
        onPicked(result);
      } else {
        router.push(result.redirect);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao instanciar template");
    } finally {
      setInstanciandoId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base">Começar a partir de um template</DialogTitle>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar template..."
              className="pl-9 h-9"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {/* Sempre presente: opção em branco */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              if (onBlank) onBlank();
            }}
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary/60 transition group"
          >
            <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-sal-400">
              <Plus className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium">{blankLabel}</div>
              <div className="text-[11.5px] text-muted-foreground">Documento em branco</div>
            </div>
          </button>

          {templates === null && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Carregando templates...
            </div>
          )}

          {templates !== null && filtrados.length === 0 && (
            <div className="text-center py-10 text-xs text-muted-foreground">
              {busca ? `Nenhum template para "${busca}".` : "Sem templates disponíveis."}
            </div>
          )}

          {filtrados.map((t) => {
            const isLoading = instanciandoId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={isLoading}
                onClick={() => instanciar(t)}
                className={cn(
                  "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-secondary/60 transition group",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <div
                  className="h-9 w-9 rounded-md flex items-center justify-center text-base shrink-0"
                  style={{
                    background: `${t.cor ?? "#7E30E1"}20`,
                    color: t.cor ?? "#7E30E1",
                  }}
                >
                  {t.icone ?? <FileText className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-medium">{t.nome.replace(/\{\{[^}]+\}\}/g, "…")}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {TIPO_LABELS[t.tipo]}
                    </Badge>
                    {t.categoria && (
                      <span className="text-[10px] text-muted-foreground/70">· {t.categoria}</span>
                    )}
                  </div>
                  {t.descricao && (
                    <div className="text-[11.5px] text-muted-foreground line-clamp-2 mt-0.5">{t.descricao}</div>
                  )}
                  {t.quantidadeUsos > 0 && (
                    <div className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
                      Usado {t.quantidadeUsos}× · último uso{" "}
                      {t.ultimoUso ? new Date(t.ultimoUso).toLocaleDateString("pt-BR") : "—"}
                    </div>
                  )}
                </div>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0 self-center" />}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-2.5 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {filtrados.length} template{filtrados.length === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] h-7"
            onClick={() => router.push("/templates")}
          >
            Gerenciar templates →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
