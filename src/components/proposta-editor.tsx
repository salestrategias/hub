"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EditorBlock as PartialBlock } from "@/components/editor/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import { InlineField } from "@/components/inline-field";
import {
  Send,
  Download,
  Copy,
  ExternalLink,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  PenLine,
  RefreshCw,
  Lock,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PropostaStatus = "RASCUNHO" | "ENVIADA" | "VISTA" | "ACEITA" | "RECUSADA" | "EXPIRADA";

type PropostaFull = {
  id: string;
  numero: string;
  titulo: string;
  clienteId: string | null;
  clienteNome: string;
  clienteEmail: string | null;
  capa: string | null;
  diagnostico: string | null;
  objetivo: string | null;
  escopo: string | null;
  cronograma: string | null;
  investimento: string | null;
  proximosPassos: string | null;
  termos: string | null;
  valorMensal: number | null;
  valorTotal: number | null;
  duracaoMeses: number | null;
  validadeDias: number;
  logoUrl: string | null;
  corPrimaria: string | null;
  status: PropostaStatus;
  shareToken: string | null;
  shareExpiraEm: string | null;
  shareViews: number;
  enviadaEm: string | null;
  vistaEm: string | null;
  aceitaEm: string | null;
  recusadaEm: string | null;
  recusaMotivo: string | null;
};

type Cliente = { id: string; nome: string; email: string | null };

const SECOES: Array<{ key: keyof PropostaFull; label: string; placeholder: string; minHeight: string }> = [
  { key: "capa", label: "Apresentação / capa", placeholder: "Quem somos, posicionamento, autoridade. Saudação personalizada usando @cliente.nome.", minHeight: "120px" },
  { key: "diagnostico", label: "Diagnóstico", placeholder: "O que entendemos do cliente: contexto, dores, sintomas. Pode usar @cliente pra cruzar com notas.", minHeight: "160px" },
  { key: "objetivo", label: "Objetivo", placeholder: "O que vamos atacar e o que vai mudar. Objetivos SMART quando possível.", minHeight: "120px" },
  { key: "escopo", label: "Estratégia & escopo", placeholder: "Pilares, canais, frequência. Listas detalhadas do que entregamos.", minHeight: "200px" },
  { key: "cronograma", label: "Cronograma", placeholder: "Timeline visual. Marcos por mês ou trimestre.", minHeight: "140px" },
  { key: "investimento", label: "Investimento", placeholder: "Detalhamento de valores, escopo do que está incluído, condições de pagamento.", minHeight: "160px" },
  { key: "proximosPassos", label: "Próximos passos", placeholder: "Como aceitar, kickoff, prazo até o início. Mantenha simples.", minHeight: "100px" },
  { key: "termos", label: "Termos & condições", placeholder: "Vigência, cancelamento, reajuste, propriedade intelectual.", minHeight: "120px" },
];

const STATUS_LABEL: Record<PropostaStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  VISTA: "Vista",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
};

const STATUS_ICON: Record<PropostaStatus, React.ComponentType<{ className?: string }>> = {
  RASCUNHO: PenLine,
  ENVIADA: Send,
  VISTA: Eye,
  ACEITA: CheckCircle2,
  RECUSADA: XCircle,
  EXPIRADA: Clock,
};

const STATUS_COR: Record<PropostaStatus, string> = {
  RASCUNHO: "#9696A8",
  ENVIADA: "#3B82F6",
  VISTA: "#F59E0B",
  ACEITA: "#10B981",
  RECUSADA: "#EF4444",
  EXPIRADA: "#9696A8",
};

export function PropostaEditor({ proposta: initial, clientes }: { proposta: PropostaFull; clientes: Cliente[] }) {
  const router = useRouter();
  const [proposta, setProposta] = useState(initial);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);

  async function patchProposta(patch: Record<string, unknown>) {
    const res = await fetch(`/api/propostas/${proposta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setProposta((p) => ({
      ...p,
      ...updated,
      valorMensal: updated.valorMensal ? Number(updated.valorMensal) : null,
      valorTotal: updated.valorTotal ? Number(updated.valorTotal) : null,
      shareExpiraEm: updated.shareExpiraEm
        ? typeof updated.shareExpiraEm === "string"
          ? updated.shareExpiraEm
          : new Date(updated.shareExpiraEm).toISOString()
        : null,
      enviadaEm: updated.enviadaEm
        ? typeof updated.enviadaEm === "string"
          ? updated.enviadaEm
          : new Date(updated.enviadaEm).toISOString()
        : null,
    }));
  }

  async function excluir() {
    if (!confirm(`Excluir a proposta ${proposta.numero}? Não dá pra desfazer.`)) return;
    const res = await fetch(`/api/propostas/${proposta.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Proposta excluída");
    router.push("/propostas");
  }

  function abrirPdf() {
    window.open(`/api/propostas/${proposta.id}/pdf`, "_blank");
  }

  async function copiarLink() {
    if (!proposta.shareToken) {
      toast.error("Esta proposta ainda não foi enviada");
      return;
    }
    const url = `${window.location.origin}/p/proposta/${proposta.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: url });
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  const StatusIcon = STATUS_ICON[proposta.status];
  const statusCor = STATUS_COR[proposta.status];

  return (
    <div className="space-y-5">
      {/* Barra superior: status + ações */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border border-border bg-card">
        <Badge
          variant="outline"
          className="text-[11px] font-medium gap-1.5"
          style={{ color: statusCor, borderColor: `${statusCor}55` }}
        >
          <StatusIcon className="h-3 w-3" />
          {STATUS_LABEL[proposta.status]}
        </Badge>

        {proposta.shareViews > 0 && (
          <span className="text-[10.5px] text-muted-foreground font-mono">
            {proposta.shareViews} {proposta.shareViews === 1 ? "visualização" : "visualizações"}
          </span>
        )}
        {proposta.aceitaEm && (
          <span className="text-[10.5px] text-emerald-400">
            Aceita em {new Date(proposta.aceitaEm).toLocaleDateString("pt-BR")}
          </span>
        )}
        {proposta.recusadaEm && (
          <span className="text-[10.5px] text-rose-400">
            Recusada em {new Date(proposta.recusadaEm).toLocaleDateString("pt-BR")}
            {proposta.recusaMotivo && <span className="text-muted-foreground"> · "{proposta.recusaMotivo.slice(0, 80)}"</span>}
          </span>
        )}
        {proposta.shareExpiraEm && proposta.status !== "ACEITA" && proposta.status !== "RECUSADA" && (
          <span className="text-[10.5px] text-muted-foreground">
            Expira em {new Date(proposta.shareExpiraEm).toLocaleDateString("pt-BR")}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIaOpen(true)}
            className="text-sal-400 border-sal-600/40 hover:bg-sal-600/10"
          >
            <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
          </Button>
          <Button variant="outline" size="sm" onClick={abrirPdf}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          {proposta.shareToken && (
            <Button variant="outline" size="sm" onClick={copiarLink}>
              <Copy className="h-3.5 w-3.5" /> Copiar link
            </Button>
          )}
          {proposta.shareToken && (
            <Button asChild variant="outline" size="sm">
              <a href={`/p/proposta/${proposta.shareToken}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Pré-visualizar
              </a>
            </Button>
          )}
          <Button size="sm" onClick={() => setEnviarOpen(true)}>
            {proposta.shareToken ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" /> Re-enviar
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Enviar
              </>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={excluir} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Layout 2-col: metadata esquerda, seções direita */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        {/* Metadata */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Informações da proposta
              </div>
              <InlineField
                type="text"
                label="Título"
                value={proposta.titulo}
                onSave={(v) => patchProposta({ titulo: v })}
                size="sm"
              />
              <InlineField
                type="select"
                label="Cliente"
                value={proposta.clienteId ?? ""}
                options={[{ value: "", label: "— Prospect / Outro —" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
                onSave={(v) => patchProposta({ clienteId: v || null })}
                size="sm"
              />
              {!proposta.clienteId && (
                <InlineField
                  type="text"
                  label="Nome do cliente (snapshot)"
                  value={proposta.clienteNome}
                  onSave={(v) => patchProposta({ clienteNome: v })}
                  size="sm"
                />
              )}
              <InlineField
                type="email"
                label="Email do destinatário"
                value={proposta.clienteEmail ?? ""}
                onSave={(v) => patchProposta({ clienteEmail: v || null })}
                placeholder="cliente@empresa.com"
                size="sm"
              />
              <InlineField
                type="number"
                label="Validade (dias)"
                value={proposta.validadeDias}
                onSave={(v) => patchProposta({ validadeDias: Number(v) })}
                step={1}
                min={1}
                max={365}
                size="sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Valores
              </div>
              <InlineField
                type="number"
                label="Investimento mensal"
                value={proposta.valorMensal ?? 0}
                onSave={(v) => patchProposta({ valorMensal: Number(v) || null })}
                prefix="R$"
                step={100}
                min={0}
                size="sm"
              />
              <InlineField
                type="number"
                label="Valor total (opcional)"
                value={proposta.valorTotal ?? 0}
                onSave={(v) => patchProposta({ valorTotal: Number(v) || null })}
                prefix="R$"
                step={500}
                min={0}
                size="sm"
              />
              <InlineField
                type="number"
                label="Duração (meses)"
                value={proposta.duracaoMeses ?? 0}
                onSave={(v) => patchProposta({ duracaoMeses: Number(v) || null })}
                step={1}
                min={0}
                max={120}
                size="sm"
              />
            </CardContent>
          </Card>

          <IdentidadeVisualCard
            logoUrl={proposta.logoUrl}
            corPrimaria={proposta.corPrimaria ?? "#7E30E1"}
            onLogoChange={(url) => {
              setProposta((p) => ({ ...p, logoUrl: url }));
              void patchProposta({ logoUrl: url });
            }}
            onCorChange={(cor) => {
              setProposta((p) => ({ ...p, corPrimaria: cor }));
              void patchProposta({ corPrimaria: cor });
            }}
          />

          <Card className="bg-secondary/30">
            <CardContent className="p-4 space-y-2 text-[11px] text-muted-foreground">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Variáveis disponíveis
              </div>
              <p className="leading-relaxed">
                Use nas seções pra preenchimento automático:
              </p>
              <ul className="space-y-0.5 font-mono text-[10px]">
                <li>{"{{cliente.nome}}"}</li>
                <li>{"{{valor.mensal}}"} · {"{{valor.total}}"}</li>
                <li>{"{{duracao.meses}}"}</li>
                <li>{"{{validade.data}}"} · {"{{validade.dias}}"}</li>
                <li>{"{{proposta.numero}}"}</li>
                <li>{"{{user.nome}}"} · {"{{data}}"}</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Seções */}
        <Tabs defaultValue={SECOES[0].key as string}>
          <TabsList className="w-full flex-wrap h-auto">
            {SECOES.map((s) => (
              <TabsTrigger key={s.key as string} value={s.key as string}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {SECOES.map((s) => (
            <TabsContent key={s.key as string} value={s.key as string} className="mt-4">
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">{s.label}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.placeholder}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/40 p-3">
                    <BlockEditor
                      key={s.key as string}
                      value={(proposta[s.key] as string | null) ?? ""}
                      onChange={(blocks: PartialBlock[]) => {
                        const json = JSON.stringify(blocks);
                        // optimistic local update + persiste
                        setProposta((p) => ({ ...p, [s.key]: json }));
                        void patchProposta({ [s.key]: json });
                      }}
                      placeholder={s.placeholder}
                      minHeight={s.minHeight}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {iaOpen && (
        <GerarComIaDialog
          propostaId={proposta.id}
          clienteNome={proposta.clienteNome}
          onClose={() => setIaOpen(false)}
          onGenerated={() => {
            setIaOpen(false);
            router.refresh();
          }}
        />
      )}

      {enviarOpen && (
        <EnviarDialog
          propostaId={proposta.id}
          numero={proposta.numero}
          jaEnviada={!!proposta.shareToken}
          validadeDiasDefault={proposta.validadeDias}
          onOpenChange={setEnviarOpen}
          onSent={(updated) => {
            setProposta((p) => ({
              ...p,
              shareToken: updated.shareToken,
              shareExpiraEm: updated.shareExpiraEm,
              status: updated.status,
              enviadaEm: updated.enviadaEm,
              shareViews: 0,
            }));
            setEnviarOpen(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal "Gerar com Claude (modo Max)" — 3 etapas, custo zero, copy-paste
 * entre Hub e Claude Desktop/Web:
 *
 *   1. Contexto: descreve oportunidade + tom de voz
 *   2. Copiar prompt: Hub monta prompt completo, mostra com "Copiar"
 *      e link "Abrir Claude". Marcelo cola, recebe JSON
 *   3. Aplicar: cola resposta JSON, Hub parseia + grava nas 8 seções
 *
 * Sem chamada de API programática — usa o Claude Max que ele já paga.
 */
function GerarComIaDialog({
  propostaId,
  clienteNome,
  onClose,
  onGenerated,
}: {
  propostaId: string;
  clienteNome: string;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);

  // Etapa 1
  const [prompt, setPrompt] = useState("");
  const [tom, setTom] = useState<"formal" | "consultivo" | "direto" | "premium">("consultivo");
  const [preparando, setPreparando] = useState(false);

  // Etapa 2
  const [promptCompleto, setPromptCompleto] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Etapa 3
  const [resposta, setResposta] = useState("");
  const [sobrescrever, setSobrescrever] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  async function preparar() {
    if (prompt.trim().length < 20) {
      toast.error("Descreva melhor a oportunidade (mínimo 20 caracteres)");
      return;
    }
    setPreparando(true);
    try {
      const res = await fetch(`/api/propostas/${propostaId}/preparar-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), tom }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      const data = await res.json();
      setPromptCompleto(data.promptCompleto);
      setEtapa(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPreparando(false);
    }
  }

  async function copiarPrompt() {
    try {
      await navigator.clipboard.writeText(promptCompleto);
      setCopiado(true);
      toast.success("Prompt copiado");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Falha ao copiar — selecione e copie manualmente");
    }
  }

  async function aplicar() {
    if (resposta.trim().length < 20) {
      toast.error("Cole o JSON que o Claude retornou");
      return;
    }
    setAplicando(true);
    try {
      const res = await fetch(`/api/propostas/${propostaId}/aplicar-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resposta: resposta.trim(), sobrescrever }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      const data = await res.json();
      const total = data.secoesAtualizadas.length;
      const ignoradas = data.secoesIgnoradas.length;
      toast.success(
        `${total} ${total === 1 ? "seção preenchida" : "seções preenchidas"}`,
        ignoradas > 0
          ? { description: `${ignoradas} ignoradas (já preenchidas — marque "sobrescrever" pra forçar)` }
          : undefined
      );
      onGenerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-sal-400" />
            Gerar com Claude
            <span className="text-[10.5px] font-mono text-muted-foreground ml-2">etapa {etapa} de 3</span>
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Cliente: <span className="font-medium">{clienteNome}</span>. Usa seu plano Claude Max
            (custo zero) — copia/cola entre Hub e Claude.
          </p>

          <div className="flex items-center gap-1.5 mt-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  etapa >= (n as 1 | 2 | 3) ? "bg-sal-500" : "bg-secondary"
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {etapa === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>1. Descreva a oportunidade</span>
                  <span className="text-[10px] text-muted-foreground/70 font-mono">
                    {prompt.length}/4000
                  </span>
                </Label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    "Ex: Cliente é uma rede de 12 farmácias em Porto Alegre, faturamento R$ 80M/ano. Hoje só fazem Instagram orgânico sem estratégia. Querem aumentar venda direta no app deles e melhorar reconhecimento de marca local. Briefing inicial: 3 reuniões já feitas, R$ 8k/mês de investimento, contrato 12 meses, foco em tráfego pago Meta + Google + gestão completa de redes."
                  }
                  rows={9}
                  maxLength={4000}
                  className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <p className="text-[10.5px] text-muted-foreground/70">
                  Inclua: tipo do negócio, escopo desejado, valores, prazo, dores específicas, canais.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Tom de voz</Label>
                <Select value={tom} onValueChange={(v) => setTom(v as typeof tom)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultivo">Consultivo (default) · mid-market</SelectItem>
                    <SelectItem value="formal">Formal · corporativo / B2B tradicional</SelectItem>
                    <SelectItem value="direto">Direto · startup / digital nativo</SelectItem>
                    <SelectItem value="premium">Premium · alto padrão / luxo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block">2. Copia o prompt e cola no Claude</Label>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed mb-2">
                  Abre o Claude (Desktop ou Web — usa seu Max, sem custo extra). Cola esse texto inteiro.
                  Espera ele responder com o JSON. Volta aqui e clica em "Já tenho a resposta".
                </p>
              </div>

              <div className="relative">
                <textarea
                  value={promptCompleto}
                  readOnly
                  rows={12}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-[11px] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copiarPrompt}
                  className="absolute top-2 right-2 h-7 text-[11px]"
                >
                  {copiado ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copiar
                    </>
                  )}
                </Button>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button asChild size="sm" variant="outline">
                  <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" /> Abrir Claude.ai
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href="claude://new" target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" /> Abrir Claude Desktop
                  </a>
                </Button>
              </div>

              <div className="text-[10.5px] text-muted-foreground/70 bg-secondary/30 rounded-md p-2.5 border-l-2 border-sal-600/30">
                💡 Dica: o Claude vai retornar um bloco JSON com 8 seções. Copia
                <strong> tudo</strong> que ele responder e cola no próximo passo —
                a gente extrai o JSON automaticamente.
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block">3. Cola a resposta do Claude</Label>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed mb-2">
                  Pode ser o JSON puro ou o texto inteiro (com ```json...``` envolvendo) —
                  achamos o bloco automaticamente.
                </p>
              </div>

              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                placeholder={'```json\n{\n  "capa": "...",\n  "diagnostico": "...",\n  ...\n}\n```'}
                rows={10}
                className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-[12px] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />

              <div className="rounded-md border border-border bg-secondary/30 p-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sobrescrever}
                    onChange={(e) => setSobrescrever(e.target.checked)}
                    className="accent-sal-600 mt-0.5"
                  />
                  <div>
                    <div className="text-[12.5px] font-medium">Sobrescrever seções já preenchidas</div>
                    <div className="text-[10.5px] text-muted-foreground">
                      Por default só preenche o que está vazio. Marque pra regenerar tudo.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {etapa > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEtapa((e) => (e === 3 ? 2 : 1))}
                disabled={preparando || aplicando}
              >
                ← Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={preparando || aplicando}>
                Cancelar
              </Button>
            </DialogClose>
            {etapa === 1 && (
              <Button onClick={preparar} disabled={preparando || prompt.trim().length < 20}>
                {preparando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando...
                  </>
                ) : (
                  <>Gerar prompt →</>
                )}
              </Button>
            )}
            {etapa === 2 && (
              <Button onClick={() => setEtapa(3)}>
                Já tenho a resposta →
              </Button>
            )}
            {etapa === 3 && (
              <Button onClick={aplicar} disabled={aplicando || resposta.trim().length < 20}>
                {aplicando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Aplicar na proposta
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Card de identidade visual: logo (upload ou URL) + cor primária.
 * Logo é comprimido pra ~256x96 antes de virar dataURL pra caber no banco
 * sem inflar (mesma técnica do avatar).
 */
function IdentidadeVisualCard({
  logoUrl,
  corPrimaria,
  onLogoChange,
  onCorChange,
}: {
  logoUrl: string | null;
  corPrimaria: string;
  onLogoChange: (url: string | null) => void;
  onCorChange: (cor: string) => void;
}) {
  const PRESETS = [
    "#7E30E1", // SAL purple (default)
    "#10B981", // emerald
    "#3B82F6", // blue
    "#F59E0B", // amber
    "#EC4899", // pink
    "#14B8A6", // teal
    "#EF4444", // red
    "#0F172A", // slate
  ];

  async function handleFile(file: File) {
    if (file.size > 2_000_000) {
      toast.error("Imagem grande demais — máximo 2MB");
      return;
    }
    try {
      const dataUrl = await comprimirImagem(file, 256, 96);
      onLogoChange(dataUrl);
    } catch {
      toast.error("Falha ao processar imagem");
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
          Identidade visual
        </div>

        {/* Logo */}
        <div className="space-y-1.5">
          <Label className="text-[11px]">Logo</Label>
          <div className="flex items-center gap-2">
            <div
              className="h-12 w-24 rounded-md border border-border bg-background/40 flex items-center justify-center overflow-hidden shrink-0"
              style={logoUrl ? { background: "#FFFFFF" } : undefined}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[10px] text-muted-foreground/60">Sem logo</span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                <Button asChild size="sm" variant="outline" className="w-full text-[11px] h-7">
                  <span>{logoUrl ? "Trocar imagem" : "Enviar imagem"}</span>
                </Button>
              </label>
              {logoUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-[10px] h-6 text-destructive hover:text-destructive"
                  onClick={() => onLogoChange(null)}
                >
                  Remover logo
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            Recomendado: PNG transparente, ~256×96px. Aparece na capa e PDF.
          </p>
        </div>

        {/* Cor primária */}
        <div className="space-y-1.5">
          <Label className="text-[11px]">Cor primária</Label>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCorChange(c)}
                className={cn(
                  "h-7 w-7 rounded-md border-2 transition",
                  corPrimaria === c ? "border-foreground scale-110" : "border-border"
                )}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={corPrimaria}
              onChange={(e) => onCorChange(e.target.value)}
              className="h-7 w-12 rounded border border-border cursor-pointer bg-transparent"
              title="Custom"
            />
            <input
              type="text"
              value={corPrimaria}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(v)) onCorChange(v);
              }}
              className="font-mono text-[11px] w-20 rounded border border-border bg-background/40 px-2 py-1"
              maxLength={7}
            />
            <span className="text-[10px] text-muted-foreground">aplicada na capa, separadores e CTAs</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Comprime imagem em canvas até maxW × maxH preservando aspect ratio,
 * exporta como dataURL JPEG 85% (ou PNG se tiver transparência aparente).
 */
async function comprimirImagem(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível"));
        ctx.drawImage(img, 0, 0, w, h);
        // PNG preserva transparência; JPEG é menor mas perde alpha
        const isPng = file.type === "image/png";
        const url = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85);
        resolve(url);
      };
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function EnviarDialog({
  propostaId,
  numero,
  jaEnviada,
  validadeDiasDefault,
  onOpenChange,
  onSent,
}: {
  propostaId: string;
  numero: string;
  jaEnviada: boolean;
  validadeDiasDefault: number;
  onOpenChange: (o: boolean) => void;
  onSent: (updated: { shareToken: string; shareExpiraEm: string; status: PropostaStatus; enviadaEm: string }) => void;
}) {
  const [validadeDias, setValidadeDias] = useState(validadeDiasDefault);
  const [usarSenha, setUsarSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (usarSenha && senha.trim().length < 4) {
      toast.error("Senha precisa de pelo menos 4 caracteres");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/propostas/${propostaId}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validadeDias,
          senha: usarSenha ? senha : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao enviar");
      }
      const data = await res.json();
      const url = `${window.location.origin}/p/proposta/${data.shareToken}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
      toast.success(jaEnviada ? "Re-enviada · link novo copiado" : "Proposta enviada · link copiado", {
        description: url,
      });
      onSent({
        shareToken: data.shareToken,
        shareExpiraEm:
          typeof data.shareExpiraEm === "string"
            ? data.shareExpiraEm
            : new Date(data.shareExpiraEm).toISOString(),
        status: data.status,
        enviadaEm:
          typeof data.enviadaEm === "string"
            ? data.enviadaEm
            : new Date(data.enviadaEm).toISOString(),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {jaEnviada ? `Re-enviar ${numero}` : `Enviar ${numero}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {jaEnviada && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
              Atenção: re-enviar revoga o link anterior e gera um novo. Compartilhe o novo link com o cliente.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Validade do link (dias)</Label>
            <Input
              type="number"
              value={validadeDias}
              onChange={(e) => setValidadeDias(Number(e.target.value))}
              min={1}
              max={365}
            />
            <p className="text-[10.5px] text-muted-foreground/70">
              Após esse prazo, o link expira automaticamente e o cliente não consegue mais abrir.
            </p>
          </div>

          <div className={cn("rounded-md border border-border p-3 space-y-2", usarSenha && "bg-secondary/30")}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usarSenha}
                onChange={(e) => setUsarSenha(e.target.checked)}
                className="accent-sal-600"
              />
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[12px]">Proteger com senha</span>
            </label>
            {usarSenha && (
              <Input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                type="password"
                placeholder="Mínimo 4 caracteres"
                autoFocus
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? "Gerando link..." : jaEnviada ? "Re-enviar e copiar link" : "Enviar e copiar link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
