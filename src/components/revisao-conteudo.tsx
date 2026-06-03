"use client";
/**
 * Portal v2 — bloco de revisão do Marcelo p/ conteúdo submetido pelo cliente.
 *
 * Usado nos sheets de Post (/editorial) e Criativo (/criativos). Só aparece
 * quando origem=CLIENTE. Mostra o estado atual da revisão e deixa o Marcelo
 * Aprovar (revisao=APROVADO) ou Pedir ajuste (revisao=AJUSTE + nota).
 *
 * Endpoints: POST /api/posts|criativos/[id]/revisar { decisao, nota? }.
 * Após decidir, chama onRevisado() pra o sheet recarregar (e a lista
 * refletir ao fechar).
 */
import { useState } from "react";
import { Inbox, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

export type RevisaoEstado = "PENDENTE" | "APROVADO" | "AJUSTE" | null;

/** Selo "Enviado pelo cliente" — usar quando origem=CLIENTE. */
export function SeloEnviadoCliente() {
  return (
    <Badge
      variant="outline"
      className="text-[10px] border-sky-500/40 text-sky-500 gap-1"
      title="Conteúdo submetido pelo cliente pelo portal"
    >
      <Inbox className="h-3 w-3" /> Enviado pelo cliente
    </Badge>
  );
}

const REVISAO_META: Record<
  "PENDENTE" | "APROVADO" | "AJUSTE",
  { label: string; className: string }
> = {
  PENDENTE: { label: "Revisão pendente", className: "border-amber-500/40 text-amber-500" },
  APROVADO: { label: "Aprovado", className: "border-emerald-500/40 text-emerald-500" },
  AJUSTE: { label: "Ajuste pedido", className: "border-rose-500/40 text-rose-500" },
};

/** Badge do estado de revisão. Não renderiza nada se revisao for null. */
export function BadgeRevisao({ revisao }: { revisao: RevisaoEstado }) {
  if (!revisao) return null;
  const meta = REVISAO_META[revisao];
  return (
    <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

export function RevisaoConteudo({
  tipo,
  id,
  revisao,
  revisaoNota,
  onRevisado,
}: {
  tipo: "posts" | "criativos";
  id: string;
  revisao: RevisaoEstado;
  revisaoNota: string | null;
  onRevisado: () => void;
}) {
  const [nota, setNota] = useState("");
  const [modoAjuste, setModoAjuste] = useState(false);
  const [enviando, setEnviando] = useState<"APROVADO" | "AJUSTE" | null>(null);

  async function decidir(decisao: "APROVADO" | "AJUSTE") {
    if (decisao === "AJUSTE" && !nota.trim()) {
      toast.error("Escreva uma nota explicando o ajuste");
      return;
    }
    setEnviando(decisao);
    try {
      const res = await fetch(`/api/${tipo}/${id}/revisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao, nota: decisao === "AJUSTE" ? nota.trim() : undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? "Falha ao salvar revisão");
      }
      toast.success(decisao === "APROVADO" ? "Aprovado — cliente verá no portal" : "Ajuste solicitado");
      setModoAjuste(false);
      setNota("");
      onRevisado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-semibold flex items-center gap-1.5">
          <Inbox className="h-3.5 w-3.5 text-sky-500" /> Revisão do conteúdo do cliente
        </span>
        <BadgeRevisao revisao={revisao} />
      </div>

      {revisao === "AJUSTE" && revisaoNota && (
        <p className="text-[12px] leading-snug rounded bg-background/50 border border-border px-2.5 py-1.5 whitespace-pre-wrap">
          <span className="text-muted-foreground">Sua nota ao cliente: </span>
          {revisaoNota}
        </p>
      )}

      {modoAjuste ? (
        <div className="space-y-2">
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder="O que o cliente precisa ajustar? (o cliente vê esta nota no portal)"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => decidir("AJUSTE")}
              disabled={enviando !== null}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <MessageSquareWarning className="h-3.5 w-3.5" /> Enviar ajuste
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setModoAjuste(false);
                setNota("");
              }}
              disabled={enviando !== null}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => decidir("APROVADO")}
            disabled={enviando !== null}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setModoAjuste(true)} disabled={enviando !== null}>
            <MessageSquareWarning className="h-3.5 w-3.5" /> Pedir ajuste
          </Button>
        </div>
      )}
    </div>
  );
}
