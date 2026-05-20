"use client";
/**
 * Wizard genérico de IA via "Claude Max copy-paste" — zero custo de API.
 *
 * Padrão estabelecido no Hub: o backend monta o prompt (system + user),
 * usuário cola no claude.ai, traz a resposta JSON de volta e o backend
 * parseia + grava no DB.
 *
 * Etapas:
 *   1. preparar  → POST prepararEndpoint, recebe { systemPrompt, userPrompt }
 *   2. copiar    → mostra prompt, copia clipboard, abre claude.ai
 *   3. colar     → user cola a resposta JSON
 *   4. feito     → POST aplicarEndpoint com { resposta }, mostra resultado
 *
 * Reutilizado por:
 *   - Briefing de cliente (`/api/clientes/[id]/preparar-briefing-ia`)
 *   - Análise de proposta (`/api/propostas/[id]/preparar-analise-ia`)
 *   - Copy de post (`/api/posts/[id]/preparar-copy-ia`)
 *   - Enrichment de lead (`/api/leads/[id]/preparar-enrichment-ia`)
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Copy,
  ExternalLink,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

type Etapa = "preparar" | "copiar" | "colar" | "feito";

export function IaWizard<TResultado = unknown>({
  open,
  onOpenChange,
  prepararEndpoint,
  aplicarEndpoint,
  title,
  description,
  preReqMessage,
  exemploResposta,
  renderResultado,
  refreshOnSuccess = true,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** POST endpoint que retorna `{ systemPrompt, userPrompt }`. */
  prepararEndpoint: string;
  /** POST endpoint que recebe `{ resposta }` e retorna o resultado tipado. */
  aplicarEndpoint: string;
  /** Título do dialog. */
  title: string;
  /** Descrição curta abaixo do título. */
  description?: string;
  /** Mensagem exibida na etapa 1 (pré-requisito ou contexto). */
  preReqMessage?: ReactNode;
  /** Placeholder da textarea da etapa 3 (exemplo do JSON esperado). */
  exemploResposta?: string;
  /** Renderiza a etapa 4 (feito) com o resultado retornado por `aplicarEndpoint`. */
  renderResultado?: (resultado: TResultado) => ReactNode;
  /** Após sucesso, chama `router.refresh()` pra revalidar a página atual. */
  refreshOnSuccess?: boolean;
  /** Callback após aplicar com sucesso. Recebe o resultado do aplicarEndpoint. */
  onSuccess?: (resultado: TResultado) => void;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("preparar");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [resposta, setResposta] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<TResultado | null>(null);

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
      const res = await fetch(prepararEndpoint, {
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede");
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
      const res = await fetch(aplicarEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resposta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data?.error ?? "Falha ao aplicar");
        return;
      }
      setResultado(data);
      setEtapa("feito");
      if (refreshOnSuccess) router.refresh();
      onSuccess?.(data as TResultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  const totalChars = (systemPrompt.length + userPrompt.length).toLocaleString("pt-BR");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <PassoLabel label="1. Preparar" ativa={etapa === "preparar"} feita={etapa !== "preparar"} />
          <ArrowRight className="h-3 w-3" />
          <PassoLabel
            label="2. Copiar e colar no Claude"
            ativa={etapa === "copiar"}
            feita={etapa === "colar" || etapa === "feito"}
          />
          <ArrowRight className="h-3 w-3" />
          <PassoLabel label="3. Aplicar resposta" ativa={etapa === "colar"} feita={etapa === "feito"} />
        </div>

        {/* === Etapa 1: Preparar === */}
        {etapa === "preparar" && (
          <div className="space-y-3">
            {preReqMessage && (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs space-y-1">
                {preReqMessage}
              </div>
            )}
            {erro && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {erro}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={preparar} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                Preparar prompt
              </Button>
            </div>
          </div>
        )}

        {/* === Etapa 2: Copiar === */}
        {etapa === "copiar" && (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs space-y-2">
              <p className="font-medium">Próximos passos:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Clica em &quot;Copiar prompt&quot; abaixo</li>
                <li>
                  Abre{" "}
                  <a
                    href="https://claude.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    claude.ai
                  </a>{" "}
                  em nova aba
                </li>
                <li>Cola na conversa nova e envia</li>
                <li>Copia a resposta JSON que ele retornar</li>
                <li>Volta aqui e clica &quot;Já tenho a resposta&quot;</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Prompt completo · <span className="font-mono">{totalChars}</span> chars
                </span>
                <Badge variant="muted" className="text-[10px]">
                  cabe em 1 mensagem do Claude
                </Badge>
              </div>
              <Textarea
                value={`${systemPrompt}\n\n---\n\n${userPrompt}`}
                readOnly
                rows={10}
                className="font-mono text-[11px]"
              />
            </div>

            <div className="flex justify-between flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEtapa("preparar")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <div className="flex gap-2 flex-wrap">
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

        {/* === Etapa 3: Colar resposta === */}
        {etapa === "colar" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Cola aqui a resposta JSON do Claude. Sistema é tolerante a wrapping de markdown e
                prefácio:
              </p>
              <Textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                placeholder={exemploResposta ?? '{"resumo": "...", "..."}'}
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
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Aplicar
              </Button>
            </div>
          </div>
        )}

        {/* === Etapa 4: Feito === */}
        {etapa === "feito" && resultado && (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="text-sm flex-1">
                {renderResultado ? (
                  renderResultado(resultado)
                ) : (
                  <span>Aplicado com sucesso.</span>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PassoLabel({ label, ativa, feita }: { label: string; ativa: boolean; feita: boolean }) {
  return (
    <span
      className={
        ativa
          ? "font-semibold text-foreground"
          : feita
            ? "text-emerald-500"
            : "text-muted-foreground"
      }
    >
      {feita && !ativa ? "✓ " : ""}
      {label}
    </span>
  );
}

/**
 * Helper: tenta extrair JSON da resposta do Claude, tolerando markdown
 * wrapping (```json ... ```), prefácio em texto e whitespace.
 *
 * Usado pelos endpoints `aplicar-*-ia` pra não falhar quando o usuário cola
 * uma resposta com explicação extra antes do JSON.
 */
export function extrairJsonDaResposta(raw: string): unknown {
  const limpo = raw.trim();
  // Tenta extrair de bloco ```json...```
  const matchBloco = limpo.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = matchBloco ? matchBloco[1] : limpo;
  // Procura primeiro { ou [ e último } ou ]
  const inicio = candidato.search(/[{[]/);
  const ultimoObj = candidato.lastIndexOf("}");
  const ultimoArr = candidato.lastIndexOf("]");
  const fim = Math.max(ultimoObj, ultimoArr);
  if (inicio < 0 || fim < 0 || fim < inicio) {
    throw new Error("Não encontrei JSON válido na resposta. Cola o JSON completo entre chaves.");
  }
  const json = candidato.slice(inicio, fim + 1);
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(
      `JSON inválido: ${e instanceof Error ? e.message : "erro de parsing"}. Verifique se a resposta termina com }.`
    );
  }
}
