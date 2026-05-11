"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PartialBlock } from "@blocknote/core";
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
