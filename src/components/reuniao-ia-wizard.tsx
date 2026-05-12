"use client";
/**
 * Wizard 3 passos pra gerar resumo + action items + capítulos da reunião
 * usando Claude Max (copy-paste, sem API).
 *
 * Mesmo pattern do wizard de propostas — Marcelo já está habituado:
 *  1. Preparar (sistema monta prompt completo com transcrição embedada)
 *  2. Copiar (botão copia tudo pro clipboard; abre claude.ai em nova aba)
 *  3. Colar resposta (textarea recebe JSON, sistema parseia e grava)
 *
 * Pré-requisito: reunião precisa ter blocos de transcrição. Sem isso, o
 * preparar-ia retorna erro e o wizard mostra o motivo.
 */
import { useState } from "react";
import { Sparkles, Copy, ExternalLink, Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

type Etapa = "preparar" | "copiar" | "colar" | "feito";

export function ReuniaoIaWizard({
  open,
  onOpenChange,
  reuniaoId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reuniaoId: string;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("preparar");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [resposta, setResposta] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    resumoAtualizado: boolean;
    actions: number;
    capitulos: number;
  } | null>(null);

  function reset() {
    setEtapa("preparar");
    setSystemPrompt("");
    setUserPrompt("");
    setResposta("");
    setErro(null);
    setResultado(null);
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function preparar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/reunioes/${reuniaoId}/preparar-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data?.error ?? "Falha ao preparar");
        return;
      }
      setSystemPrompt(data.systemPrompt);
      setUserPrompt(data.userPrompt);
      setEtapa("copiar");
    } finally {
      setLoading(false);
    }
  }

  function copiarTudo() {
    const full = `${systemPrompt}\n\n---\n\n${userPrompt}`;
    navigator.clipboard.writeText(full);
    toast.success("Prompt copiado");
  }

  async function aplicar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/reunioes/${reuniaoId}/aplicar-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resposta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data?.error ?? "Falha ao aplicar");
        return;
      }
      setResultado({
        resumoAtualizado: data.resumoAtualizado,
        actions: data.actions,
        capitulos: data.capitulos,
      });
      setEtapa("feito");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Gerar resumo + action items via Claude Max
          </DialogTitle>
          <DialogDescription>
            Workflow copy-paste (zero custo de API). Sistema monta o prompt
            completo, você cola no Claude e traz a resposta de volta.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Etapa label="1. Preparar" ativa={etapa === "preparar"} feita={etapa !== "preparar"} />
          <ArrowRight className="h-3 w-3" />
          <Etapa label="2. Copiar e colar no Claude" ativa={etapa === "copiar"} feita={etapa === "colar" || etapa === "feito"} />
          <ArrowRight className="h-3 w-3" />
          <Etapa label="3. Aplicar resposta" ativa={etapa === "colar"} feita={etapa === "feito"} />
        </div>

        {/* === Etapa 1 === */}
        {etapa === "preparar" && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs space-y-1">
              <p>
                <strong>Pré-requisito:</strong> reunião precisa ter transcrição. Se ainda não tem,
                fecha o wizard e clique em "Importar do Meet" antes.
              </p>
              <p className="text-muted-foreground">
                O prompt vai conter a transcrição completa + contexto da reunião. Claude vai
                devolver JSON com resumo, action items (com responsável e prazo) e capítulos.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={preparar} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Preparar prompt
              </Button>
            </div>
          </div>
        )}

        {/* === Etapa 2 === */}
        {etapa === "copiar" && (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs space-y-2">
              <p className="font-medium">Próximos passos:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Clica em "Copiar prompt" abaixo</li>
                <li>Abre <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-primary underline">claude.ai</a> em nova aba</li>
                <li>Cola na conversa nova e envia</li>
                <li>Copia a resposta JSON que ele retornar</li>
                <li>Volta aqui e clica "Já tenho a resposta"</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Prompt completo · <span className="font-mono">{(systemPrompt.length + userPrompt.length).toLocaleString("pt-BR")}</span> chars
                </span>
                <Badge variant="muted" className="text-[10px]">cabe em 1 mensagem do Claude</Badge>
              </div>
              <Textarea
                value={`${systemPrompt}\n\n---\n\n${userPrompt}`}
                readOnly
                rows={10}
                className="font-mono text-[11px]"
              />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setEtapa("preparar")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copiarTudo}>
                  <Copy className="h-3.5 w-3.5" /> Copiar prompt
                </Button>
                <Button variant="outline" asChild>
                  <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir Claude
                  </a>
                </Button>
                <Button onClick={() => setEtapa("colar")}>
                  Já tenho a resposta <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* === Etapa 3 === */}
        {etapa === "colar" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Cola aqui a resposta JSON do Claude. Sistema é tolerante a wrapping de markdown e prefácio:
              </p>
              <Textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                placeholder={'{"resumo": "...", "action_items": [...], "capitulos": [...]}'}
                rows={12}
                className="font-mono text-[11px]"
              />
            </div>

            {erro && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {erro}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setEtapa("copiar")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button onClick={aplicar} disabled={!resposta.trim() || loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Aplicar
              </Button>
            </div>
          </div>
        )}

        {/* === Etapa 4 === */}
        {etapa === "feito" && resultado && (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Pronto!</div>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {resultado.resumoAtualizado && <li>✓ Resumo atualizado</li>}
                  {resultado.actions > 0 && <li>✓ {resultado.actions} action item(s) criado(s)</li>}
                  {resultado.capitulos > 0 && <li>✓ {resultado.capitulos} capítulo(s) criado(s)</li>}
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Etapa({ label, ativa, feita }: { label: string; ativa: boolean; feita: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded ${
        ativa
          ? "bg-primary/15 text-foreground font-medium"
          : feita
          ? "text-emerald-500"
          : "text-muted-foreground"
      }`}
    >
      {feita && !ativa && "✓ "}
      {label}
    </span>
  );
}
