"use client";
/**
 * DiagnosticoEditor — o coração da UX do módulo de Diagnóstico.
 *
 * Layout de 3 zonas:
 *  - ESQUERDA: navegador de seções (reordenar drag + ↑↓, ligar/desligar,
 *    adicionar do catálogo, remover) + card de informações do diagnóstico.
 *  - CENTRO: edição da seção ativa — título editável, guia de perguntas
 *    (checklist da metodologia SAL), BlockEditor rico, "gerar seção com IA".
 *  - DIREITA (colapsável, só se houver reunião vinculada): player da
 *    gravação + transcrição (timestamps clicáveis → seek) + resumo IA.
 *
 * Persistência: PATCH parcial em /api/diagnosticos/[id]. O array `secoes`
 * inteiro é salvo a cada mudança, com debounce ~700ms na edição de
 * conteúdo (digitação) e save imediato em ações discretas (toggle,
 * reordenar, adicionar, remover).
 *
 * IA: dialog "Claude Max copy-paste" (3 etapas, custo zero) ancorado na
 * transcrição da reunião — não num prompt digitado. Botão global gera
 * todas as seções visíveis; botão por-seção foca uma só.
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EditorBlock as PartialBlock } from "@/components/editor/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { BlockEditor, BlockRenderer } from "@/components/editor";
import { InlineField } from "@/components/inline-field";
import { ReuniaoPlayer } from "@/components/reuniao-player";
import {
  FileText,
  Sparkles,
  Building2,
  ScanSearch,
  Gem,
  Users,
  Swords,
  AlertTriangle,
  Lightbulb,
  Target,
  Gauge,
  Flag,
  SquarePen,
  Download,
  Copy,
  ExternalLink,
  Trash2,
  Send,
  RefreshCw,
  Eye,
  PenLine,
  CheckCircle2,
  Archive,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  Search,
  Loader2,
  Lock,
  FilePlus2,
  PanelRightClose,
  PanelRightOpen,
  Mic,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type DiagnosticoSecao,
  type SecaoTipo,
  CATALOGO_SECOES,
  ORDEM_CATALOGO,
  catalogoDe,
  gerarSecaoId,
} from "@/lib/diagnostico-secoes";

type DiagnosticoStatus = "RASCUNHO" | "PRONTO" | "ENVIADO" | "VISTO" | "ARQUIVADO";

type ReuniaoBlock = {
  id: string;
  ordem: number;
  timestamp: number;
  speaker: string;
  speakerCor: string | null;
  texto: string;
};
type ReuniaoCapitulo = { id: string; timestamp: number; titulo: string };
type ReuniaoContexto = {
  id: string;
  titulo: string;
  audioUrl: string | null;
  resumoIA: string | null;
  blocks: ReuniaoBlock[];
  capitulos: ReuniaoCapitulo[];
} | null;

type DiagnosticoFull = {
  id: string;
  numero: string;
  titulo: string;
  clienteId: string | null;
  clienteNome: string;
  clienteEmail: string | null;
  leadId: string | null;
  reuniaoId: string | null;
  secoes: DiagnosticoSecao[];
  logoUrl: string | null;
  corPrimaria: string | null;
  capaImagemUrl: string | null;
  status: DiagnosticoStatus;
  shareToken: string | null;
  shareExpiraEm: string | null;
  shareViews: number;
  propostaId: string | null;
  enviadoEm: string | null;
  vistoEm: string | null;
};

type Cliente = { id: string; nome: string; email: string | null };
type ReuniaoOpcao = { id: string; titulo: string; data: string };

const ICONES: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Sparkles,
  Building2,
  ScanSearch,
  Gem,
  Users,
  Swords,
  AlertTriangle,
  Lightbulb,
  Target,
  Gauge,
  Flag,
  SquarePen,
};

function iconeDe(tipo: SecaoTipo): React.ComponentType<{ className?: string }> {
  const nome = catalogoDe(tipo).icone;
  return ICONES[nome] ?? SquarePen;
}

const STATUS_LABEL: Record<DiagnosticoStatus, string> = {
  RASCUNHO: "Rascunho",
  PRONTO: "Pronto",
  ENVIADO: "Enviado",
  VISTO: "Visto",
  ARQUIVADO: "Arquivado",
};

const STATUS_ICON: Record<DiagnosticoStatus, React.ComponentType<{ className?: string }>> = {
  RASCUNHO: PenLine,
  PRONTO: CheckCircle2,
  ENVIADO: Send,
  VISTO: Eye,
  ARQUIVADO: Archive,
};

const STATUS_COR: Record<DiagnosticoStatus, string> = {
  RASCUNHO: "#9696A8",
  PRONTO: "#10B981",
  ENVIADO: "#3B82F6",
  VISTO: "#F59E0B",
  ARQUIVADO: "#9696A8",
};

/** Tipos do catálogo que ainda não estão no diagnóstico (pra "adicionar seção"). */
function tiposDisponiveis(secoes: DiagnosticoSecao[]): Array<Exclude<SecaoTipo, "custom">> {
  const presentes = new Set(secoes.map((s) => s.tipo));
  return ORDEM_CATALOGO.filter((t) => !presentes.has(t));
}

export function DiagnosticoEditor({
  diagnostico: initial,
  reuniaoContexto,
  clientes,
  reunioes,
}: {
  diagnostico: DiagnosticoFull;
  reuniaoContexto: ReuniaoContexto;
  clientes: Cliente[];
  reunioes: ReuniaoOpcao[];
}) {
  const router = useRouter();
  const [diag, setDiag] = useState(initial);
  const [secoes, setSecoes] = useState<DiagnosticoSecao[]>(initial.secoes);
  const [ativaId, setAtivaId] = useState<string>(initial.secoes[0]?.id ?? "");
  const [seekToSeg, setSeekToSeg] = useState<number | null>(null);
  const [contextoAberto, setContextoAberto] = useState(true);
  const [guiaAberta, setGuiaAberta] = useState(true);

  const [enviarOpen, setEnviarOpen] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);
  const [iaSecaoFoco, setIaSecaoFoco] = useState<string | null>(null);
  const [propostaCarregando, setPropostaCarregando] = useState(false);

  // Debounce do save do array de seções (escreve o array inteiro a cada edição).
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [salvandoSecoes, setSalvandoSecoes] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  const temReuniao = !!diag.reuniaoId && !!reuniaoContexto;
  const secaoAtiva = secoes.find((s) => s.id === ativaId) ?? secoes[0] ?? null;
  const visiveis = secoes.filter((s) => s.visivel).length;

  async function patchDiagnostico(patch: Record<string, unknown>) {
    const res = await fetch(`/api/diagnosticos/${diag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setDiag((d) => ({
      ...d,
      ...updated,
      shareExpiraEm: updated.shareExpiraEm
        ? typeof updated.shareExpiraEm === "string"
          ? updated.shareExpiraEm
          : new Date(updated.shareExpiraEm).toISOString()
        : null,
      enviadoEm: updated.enviadoEm
        ? typeof updated.enviadoEm === "string"
          ? updated.enviadoEm
          : new Date(updated.enviadoEm).toISOString()
        : null,
    }));
    return updated;
  }

  /** Persiste o array de seções. `imediato` pula o debounce (ações discretas). */
  function persistirSecoes(novas: DiagnosticoSecao[], imediato = false) {
    setSecoes(novas);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const fazer = async () => {
      setSalvandoSecoes(true);
      try {
        await fetch(`/api/diagnosticos/${diag.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secoes: novas }),
        });
        setSalvoEm(new Date().toISOString());
      } catch {
        toast.error("Falha ao salvar seções");
      } finally {
        setSalvandoSecoes(false);
      }
    };
    if (imediato) void fazer();
    else saveTimer.current = setTimeout(fazer, 700);
  }

  function atualizarSecao(id: string, patch: Partial<DiagnosticoSecao>, imediato = false) {
    persistirSecoes(
      secoes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      imediato
    );
  }

  function moverSecao(idx: number, dir: -1 | 1) {
    const ni = idx + dir;
    if (ni < 0 || ni >= secoes.length) return;
    const novas = [...secoes];
    [novas[idx], novas[ni]] = [novas[ni], novas[idx]];
    persistirSecoes(reindexar(novas), true);
  }

  function reordenarPorDrag(de: number, para: number) {
    if (de === para) return;
    const novas = [...secoes];
    const [movida] = novas.splice(de, 1);
    novas.splice(para, 0, movida);
    persistirSecoes(reindexar(novas), true);
  }

  function adicionarSecao(tipo: Exclude<SecaoTipo, "custom"> | "custom") {
    const cat = catalogoDe(tipo);
    const nova: DiagnosticoSecao = {
      id: gerarSecaoId(tipo),
      tipo,
      titulo: cat.titulo,
      conteudo: "",
      visivel: true,
      ordem: secoes.length,
    };
    persistirSecoes(reindexar([...secoes, nova]), true);
    setAtivaId(nova.id);
  }

  function removerSecao(id: string) {
    const alvo = secoes.find((s) => s.id === id);
    if (!alvo) return;
    if (!confirm(`Remover a seção "${alvo.titulo}"? O conteúdo dela será perdido.`)) return;
    const novas = reindexar(secoes.filter((s) => s.id !== id));
    persistirSecoes(novas, true);
    if (ativaId === id) setAtivaId(novas[0]?.id ?? "");
  }

  async function excluir() {
    if (!confirm(`Excluir o diagnóstico ${diag.numero}? Não dá pra desfazer.`)) return;
    const res = await fetch(`/api/diagnosticos/${diag.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Diagnóstico excluído");
    router.push("/diagnosticos");
  }

  function abrirPdf() {
    window.open(`/api/diagnosticos/${diag.id}/pdf`, "_blank");
  }

  async function copiarLink() {
    if (!diag.shareToken) {
      toast.error("Este diagnóstico ainda não foi compartilhado");
      return;
    }
    const url = `${window.location.origin}/p/diagnostico/${diag.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: url });
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  async function gerarProposta() {
    if (diag.propostaId) {
      router.push(`/propostas/${diag.propostaId}`);
      return;
    }
    if (!confirm("Gerar uma proposta a partir deste diagnóstico? As seções relevantes serão levadas pra proposta.")) {
      return;
    }
    setPropostaCarregando(true);
    try {
      const res = await fetch(`/api/diagnosticos/${diag.id}/gerar-proposta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao gerar proposta");
      }
      const data = await res.json();
      setDiag((d) => ({ ...d, propostaId: data.propostaId ?? data.id }));
      toast.success("Proposta gerada");
      router.push(`/propostas/${data.propostaId ?? data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPropostaCarregando(false);
    }
  }

  const StatusIcon = STATUS_ICON[diag.status];
  const statusCor = STATUS_COR[diag.status];
  const disponiveis = tiposDisponiveis(secoes);

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
          {STATUS_LABEL[diag.status]}
        </Badge>

        <Select
          value={diag.status}
          onValueChange={(v) => {
            const status = v as DiagnosticoStatus;
            setDiag((d) => ({ ...d, status }));
            void patchDiagnostico({ status }).catch(() => toast.error("Falha ao mudar status"));
          }}
        >
          <SelectTrigger className="h-7 w-[130px] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABEL) as DiagnosticoStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-[10.5px] text-muted-foreground">
          {visiveis} de {secoes.length} seções visíveis
        </span>
        {diag.shareViews > 0 && (
          <span className="text-[10.5px] text-muted-foreground font-mono">
            {diag.shareViews} {diag.shareViews === 1 ? "visualização" : "visualizações"}
          </span>
        )}
        {diag.shareExpiraEm && (
          <span className="text-[10.5px] text-muted-foreground">
            Expira em {new Date(diag.shareExpiraEm).toLocaleDateString("pt-BR")}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIaSecaoFoco(null);
              setIaOpen(true);
            }}
            className="text-sal-400 border-sal-600/40 hover:bg-sal-600/10"
          >
            <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={gerarProposta}
            disabled={propostaCarregando}
          >
            {propostaCarregando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FilePlus2 className="h-3.5 w-3.5" />
            )}
            {diag.propostaId ? "Ver proposta" : "Gerar proposta"}
          </Button>
          <Button variant="outline" size="sm" onClick={abrirPdf}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          {diag.shareToken && (
            <Button variant="outline" size="sm" onClick={copiarLink}>
              <Copy className="h-3.5 w-3.5" /> Copiar link
            </Button>
          )}
          {diag.shareToken && (
            <Button asChild variant="outline" size="sm">
              <a href={`/p/diagnostico/${diag.shareToken}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Pré-visualizar
              </a>
            </Button>
          )}
          <Button size="sm" onClick={() => setEnviarOpen(true)}>
            {diag.shareToken ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" /> Re-compartilhar
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Compartilhar
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={excluir}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Layout 3 zonas */}
      <div
        className={cn(
          "grid gap-5 items-start",
          temReuniao && contextoAberto
            ? "xl:grid-cols-[280px_1fr_minmax(0,380px)]"
            : "lg:grid-cols-[280px_1fr]"
        )}
      >
        {/* ── ESQUERDA: info + navegador de seções ── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Informações
              </div>
              <InlineField
                type="text"
                label="Título do diagnóstico"
                value={diag.titulo}
                onSave={(v) => patchDiagnostico({ titulo: v })}
                size="sm"
              />
              <InlineField
                type="select"
                label="Cliente"
                value={diag.clienteId ?? ""}
                options={[
                  { value: "", label: "— Prospect / Outro —" },
                  ...clientes.map((c) => ({ value: c.id, label: c.nome })),
                ]}
                onSave={(v) => patchDiagnostico({ clienteId: v || null })}
                size="sm"
              />
              {!diag.clienteId && (
                <InlineField
                  type="text"
                  label="Nome (snapshot)"
                  value={diag.clienteNome}
                  onSave={(v) => patchDiagnostico({ clienteNome: v })}
                  size="sm"
                />
              )}
              <InlineField
                type="email"
                label="Email do destinatário"
                value={diag.clienteEmail ?? ""}
                onSave={(v) => patchDiagnostico({ clienteEmail: v || null })}
                placeholder="cliente@empresa.com"
                size="sm"
              />
              <InlineField
                type="select"
                label="Reunião vinculada"
                value={diag.reuniaoId ?? ""}
                options={[
                  { value: "", label: "— Nenhuma —" },
                  ...reunioes.map((r) => ({
                    value: r.id,
                    label: `${r.titulo} · ${new Date(r.data).toLocaleDateString("pt-BR")}`,
                  })),
                ]}
                onSave={async (v) => {
                  await patchDiagnostico({ reuniaoId: v || null });
                  // Recarrega pra trazer transcrição/player do server component
                  router.refresh();
                }}
                size="sm"
              />
              {diag.reuniaoId && !temReuniao && (
                <p className="text-[10.5px] text-muted-foreground/70">
                  Recarregando contexto da reunião…
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Seções
                </div>
                {salvandoSecoes ? (
                  <span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground/70">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> salvando
                  </span>
                ) : salvoEm ? (
                  <span className="inline-flex items-center gap-1 text-[9.5px] text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" /> salvo
                  </span>
                ) : null}
              </div>

              <SecaoNavegador
                secoes={secoes}
                ativaId={ativaId}
                onSelecionar={setAtivaId}
                onToggle={(id, visivel) => atualizarSecao(id, { visivel }, true)}
                onMover={moverSecao}
                onReordenar={reordenarPorDrag}
                onRemover={removerSecao}
              />

              {disponiveis.length > 0 && (
                <AdicionarSecao disponiveis={disponiveis} onAdicionar={adicionarSecao} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── CENTRO: edição da seção ativa ── */}
        <div className="space-y-4 min-w-0">
          {!temReuniao || !contextoAberto ? null : null}
          {secaoAtiva ? (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    {(() => {
                      const Icon = iconeDe(secaoAtiva.tipo);
                      return <Icon className="h-4 w-4" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <Input
                      value={secaoAtiva.titulo}
                      onChange={(e) => atualizarSecao(secaoAtiva.id, { titulo: e.target.value })}
                      className="h-9 text-sm font-semibold border-transparent bg-transparent px-0 focus-visible:bg-background/40 focus-visible:px-2"
                      placeholder="Título da seção"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {catalogoDe(secaoAtiva.tipo).placeholder}
                    </p>
                  </div>
                  {temReuniao && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-sal-400 border-sal-600/40 hover:bg-sal-600/10"
                      onClick={() => {
                        setIaSecaoFoco(secaoAtiva.id);
                        setIaOpen(true);
                      }}
                      title="Gerar só esta seção a partir da reunião"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Gerar seção
                    </Button>
                  )}
                </div>

                {/* Guia de perguntas (metodologia SAL) */}
                {catalogoDe(secaoAtiva.tipo).perguntasGuia.length > 0 && (
                  <div className="rounded-md border border-border bg-secondary/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setGuiaAberta((a) => !a)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition"
                    >
                      <ListChecks className="h-3.5 w-3.5 text-sal-400 shrink-0" />
                      <span className="text-[11.5px] font-medium flex-1">
                        Guia desta seção — o que não pode faltar
                      </span>
                      {guiaAberta ? (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    {guiaAberta && (
                      <ul className="px-3 pb-3 pt-0.5 space-y-1.5">
                        {catalogoDe(secaoAtiva.tipo).perguntasGuia.map((p, i) => (
                          <li key={i} className="flex gap-2 text-[11.5px] text-muted-foreground leading-relaxed">
                            <span className="text-sal-400/60 shrink-0">›</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="rounded-md border border-border bg-background/40 p-3">
                  <BlockEditor
                    key={secaoAtiva.id}
                    value={secaoAtiva.conteudo || ""}
                    onChange={(blocks: PartialBlock[]) => {
                      const json = JSON.stringify(blocks);
                      atualizarSecao(secaoAtiva.id, { conteudo: json });
                    }}
                    placeholder={catalogoDe(secaoAtiva.tipo).placeholder}
                    minHeight="320px"
                  />
                </div>

                {!secaoAtiva.visivel && (
                  <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                    Esta seção está <strong>oculta</strong> — não aparece na apresentação nem no PDF.
                    Ative no navegador à esquerda pra incluí-la.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Nenhuma seção. Adicione uma seção do catálogo à esquerda pra começar.
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── DIREITA: contexto da reunião (colapsável) ── */}
        {temReuniao && contextoAberto && reuniaoContexto && (
          <aside className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground">
                <Mic className="h-3.5 w-3.5 text-sal-400" />
                {reuniaoContexto.titulo}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setContextoAberto(false)}
                title="Recolher painel da reunião"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ReuniaoContextoPanel
              reuniao={reuniaoContexto}
              seekToSeg={seekToSeg}
              onSeek={setSeekToSeg}
              onSeekConsumed={() => setSeekToSeg(null)}
            />
          </aside>
        )}
      </div>

      {/* Botão flutuante pra reabrir o painel da reunião quando recolhido */}
      {temReuniao && !contextoAberto && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setContextoAberto(true)}
          className="fixed bottom-6 right-6 z-40 shadow-lg"
        >
          <PanelRightOpen className="h-3.5 w-3.5" /> Reunião
        </Button>
      )}

      {iaOpen && (
        <GerarComIaDialog
          diagnosticoId={diag.id}
          clienteNome={diag.clienteNome}
          temReuniao={temReuniao}
          secaoFocoId={iaSecaoFoco}
          secaoFocoTitulo={iaSecaoFoco ? secoes.find((s) => s.id === iaSecaoFoco)?.titulo ?? null : null}
          onClose={() => setIaOpen(false)}
          onGenerated={() => {
            setIaOpen(false);
            router.refresh();
          }}
        />
      )}

      {enviarOpen && (
        <CompartilharDialog
          diagnosticoId={diag.id}
          numero={diag.numero}
          jaCompartilhado={!!diag.shareToken}
          onOpenChange={setEnviarOpen}
          onSent={(updated) => {
            setDiag((d) => ({
              ...d,
              shareToken: updated.shareToken,
              shareExpiraEm: updated.shareExpiraEm,
              status: updated.status,
              enviadoEm: updated.enviadoEm,
              shareViews: 0,
            }));
            setEnviarOpen(false);
          }}
        />
      )}
    </div>
  );
}

function reindexar(secoes: DiagnosticoSecao[]): DiagnosticoSecao[] {
  return secoes.map((s, i) => ({ ...s, ordem: i }));
}

// ─── Navegador de seções (reordenável + toggle + remover) ──────────────

function SecaoNavegador({
  secoes,
  ativaId,
  onSelecionar,
  onToggle,
  onMover,
  onReordenar,
  onRemover,
}: {
  secoes: DiagnosticoSecao[];
  ativaId: string;
  onSelecionar: (id: string) => void;
  onToggle: (id: string, visivel: boolean) => void;
  onMover: (idx: number, dir: -1 | 1) => void;
  onReordenar: (de: number, para: number) => void;
  onRemover: (id: string) => void;
}) {
  const dragIdx = useRef<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  return (
    <ul className="space-y-1">
      {secoes.map((s, idx) => {
        const Icon = iconeDe(s.tipo);
        const ativa = s.id === ativaId;
        return (
          <li
            key={s.id}
            draggable
            onDragStart={() => (dragIdx.current = idx)}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(idx);
            }}
            onDragLeave={() => setSobre((cur) => (cur === idx ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx.current !== null) onReordenar(dragIdx.current, idx);
              dragIdx.current = null;
              setSobre(null);
            }}
            onDragEnd={() => {
              dragIdx.current = null;
              setSobre(null);
            }}
            className={cn(
              "group flex items-center gap-1.5 rounded-md pl-1.5 pr-1 py-1 transition-colors border border-transparent",
              ativa ? "bg-primary/15" : "hover:bg-secondary/60",
              sobre === idx && "border-sal-500/60",
              !s.visivel && "opacity-60"
            )}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab shrink-0" />
            <button
              type="button"
              onClick={() => onSelecionar(s.id)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <Icon
                className={cn("h-3.5 w-3.5 shrink-0", ativa ? "text-sal-400" : "text-muted-foreground")}
              />
              <span
                className={cn(
                  "text-[12px] truncate",
                  ativa ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {s.titulo}
              </span>
            </button>

            <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onMover(idx, -1)}
                disabled={idx === 0}
                className="h-5 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Subir"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onMover(idx, 1)}
                disabled={idx === secoes.length - 1}
                className="h-5 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Descer"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onRemover(s.id)}
                className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive"
                title="Remover seção"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={s.visivel}
              onClick={() => onToggle(s.id, !s.visivel)}
              className={cn(
                "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 ml-0.5",
                s.visivel ? "bg-primary" : "bg-muted/60"
              )}
              title={s.visivel ? "Visível — clique pra ocultar" : "Oculta — clique pra mostrar"}
            >
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-full bg-white shadow transition-transform",
                  s.visivel ? "translate-x-[15px]" : "translate-x-[3px]"
                )}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AdicionarSecao({
  disponiveis,
  onAdicionar,
}: {
  disponiveis: Array<Exclude<SecaoTipo, "custom">>;
  onAdicionar: (tipo: Exclude<SecaoTipo, "custom"> | "custom") => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="pt-1">
      {!aberto ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-[11px]"
          onClick={() => setAberto(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar seção
        </Button>
      ) : (
        <div className="rounded-md border border-border bg-background/40 p-1.5 space-y-0.5">
          <div className="px-1.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Catálogo
          </div>
          {disponiveis.map((tipo) => {
            const cat = CATALOGO_SECOES[tipo];
            const Icon = ICONES[cat.icone] ?? SquarePen;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => {
                  onAdicionar(tipo);
                  setAberto(false);
                }}
                className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded text-left hover:bg-secondary/60 transition"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[12px] truncate">{cat.titulo}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              onAdicionar("custom");
              setAberto(false);
            }}
            className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded text-left hover:bg-secondary/60 transition border-t border-border/40 mt-0.5 pt-2"
          >
            <SquarePen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12px]">Seção personalizada</span>
          </button>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="w-full px-1.5 py-1 text-[10.5px] text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Painel de contexto da reunião ─────────────────────────────────────

const SPEAKER_CORES = ["#7E30E1", "#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#14B8A6"];

function ReuniaoContextoPanel({
  reuniao,
  seekToSeg,
  onSeek,
  onSeekConsumed,
}: {
  reuniao: NonNullable<ReuniaoContexto>;
  seekToSeg: number | null;
  onSeek: (seg: number) => void;
  onSeekConsumed: () => void;
}) {
  const [busca, setBusca] = useState("");

  const corPorSpeaker = useMemo(() => {
    const m = new Map<string, string>();
    reuniao.blocks.forEach((b) => {
      if (!m.has(b.speaker)) m.set(b.speaker, b.speakerCor ?? SPEAKER_CORES[m.size % SPEAKER_CORES.length]);
    });
    return m;
  }, [reuniao.blocks]);

  const blocksFiltrados = useMemo(
    () => reuniao.blocks.filter((b) => !busca || b.texto.toLowerCase().includes(busca.toLowerCase())),
    [reuniao.blocks, busca]
  );

  const temTranscricao = reuniao.blocks.length > 0;

  return (
    <div className="space-y-3 xl:sticky xl:top-4">
      <ReuniaoPlayer
        reuniaoId={reuniao.id}
        audioUrl={reuniao.audioUrl}
        seekToSeg={seekToSeg}
        onSeekConsumed={onSeekConsumed}
      />

      <Tabs defaultValue="transcricao">
        <TabsList className="w-full">
          <TabsTrigger value="transcricao" className="flex-1 text-[11px]">
            Transcrição
          </TabsTrigger>
          <TabsTrigger value="resumo" className="flex-1 text-[11px]">
            Resumo IA
          </TabsTrigger>
          {reuniao.capitulos.length > 0 && (
            <TabsTrigger value="capitulos" className="flex-1 text-[11px]">
              Capítulos
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="transcricao" className="mt-2">
          <Card>
            <CardContent className="p-3 space-y-2">
              {temTranscricao ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar na transcrição..."
                      className="pl-8 h-8 text-[12px]"
                    />
                  </div>
                  <div className="max-h-[480px] overflow-y-auto space-y-1 pr-1">
                    {blocksFiltrados.map((b) => (
                      <div key={b.id} className="flex gap-2 py-1">
                        <button
                          type="button"
                          onClick={() => reuniao.audioUrl && onSeek(b.timestamp)}
                          disabled={!reuniao.audioUrl}
                          className={cn(
                            "font-mono text-[10px] text-muted-foreground/60 transition w-11 shrink-0 mt-0.5 text-left",
                            reuniao.audioUrl
                              ? "hover:text-primary hover:underline cursor-pointer"
                              : "cursor-default"
                          )}
                          title={reuniao.audioUrl ? "Pular pra esse momento" : "Sem gravação vinculada"}
                        >
                          {fmtTimecode(b.timestamp)}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[11px] font-semibold mb-0.5"
                            style={{ color: corPorSpeaker.get(b.speaker) }}
                          >
                            {b.speaker}
                          </div>
                          <div className="text-[12px] leading-relaxed">{highlight(b.texto, busca)}</div>
                        </div>
                      </div>
                    ))}
                    {blocksFiltrados.length === 0 && (
                      <div className="text-center text-[12px] text-muted-foreground py-6">
                        Nenhum trecho com "{busca}".
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center text-[12px] text-muted-foreground py-8">
                  Esta reunião ainda não tem transcrição importada.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumo" className="mt-2">
          <Card>
            <CardContent className="p-4">
              {reuniao.resumoIA ? (
                <BlockRenderer value={reuniao.resumoIA} className="text-[12.5px] leading-relaxed" />
              ) : (
                <p className="text-[12px] text-muted-foreground italic py-4 text-center">
                  Sem resumo IA gerado nesta reunião.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {reuniao.capitulos.length > 0 && (
          <TabsContent value="capitulos" className="mt-2">
            <Card>
              <CardContent className="p-3">
                <div className="space-y-1">
                  {reuniao.capitulos.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => reuniao.audioUrl && onSeek(c.timestamp)}
                      disabled={!reuniao.audioUrl}
                      className={cn(
                        "w-full flex items-center gap-2.5 py-1.5 px-1 rounded text-left transition",
                        reuniao.audioUrl ? "hover:bg-secondary/60 cursor-pointer" : "cursor-default"
                      )}
                    >
                      <span className="font-mono text-[10.5px] text-muted-foreground w-12 shrink-0">
                        {fmtTimecode(c.timestamp)}
                      </span>
                      <span className="text-[12px] flex-1">{c.titulo}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── Dialog "Gerar com Claude" (ancorado na reunião) ───────────────────

function GerarComIaDialog({
  diagnosticoId,
  clienteNome,
  temReuniao,
  secaoFocoId,
  secaoFocoTitulo,
  onClose,
  onGenerated,
}: {
  diagnosticoId: string;
  clienteNome: string;
  temReuniao: boolean;
  secaoFocoId: string | null;
  secaoFocoTitulo: string | null;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);

  // Etapa 1
  const [contextoExtra, setContextoExtra] = useState("");
  const [tom, setTom] = useState<"consultivo" | "direto" | "estrategico" | "caloroso">("consultivo");
  const [preparando, setPreparando] = useState(false);

  // Etapa 2
  const [promptCompleto, setPromptCompleto] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Etapa 3
  const [resposta, setResposta] = useState("");
  const [sobrescrever, setSobrescrever] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  async function preparar() {
    setPreparando(true);
    try {
      const res = await fetch(`/api/diagnosticos/${diagnosticoId}/preparar-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tom,
          contextoExtra: contextoExtra.trim() || undefined,
          secaoFoco: secaoFocoId ?? undefined,
        }),
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
      const res = await fetch(`/api/diagnosticos/${diagnosticoId}/aplicar-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resposta: resposta.trim(), sobrescrever }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      const data = await res.json();
      const total = data.secoesAtualizadas?.length ?? 0;
      const ignoradas = data.secoesIgnoradas?.length ?? 0;
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
            {secaoFocoTitulo ? `Gerar seção: ${secaoFocoTitulo}` : "Gerar diagnóstico com Claude"}
            <span className="text-[10.5px] font-mono text-muted-foreground ml-2">etapa {etapa} de 3</span>
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Cliente: <span className="font-medium">{clienteNome}</span>. Usa seu plano Claude Max
            (custo zero) — copia/cola entre Hub e Claude. A IA ancora nas falas reais da reunião.
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
              {!temReuniao && (
                <p className="text-[11.5px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                  Nenhuma reunião vinculada. A IA vai gerar com base só no que você descrever abaixo.
                  Pra um diagnóstico ancorado em falas reais, vincule a reunião de diagnóstico no
                  card "Informações".
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>Contexto extra (opcional)</span>
                  <span className="text-[10px] text-muted-foreground/70 font-mono">
                    {contextoExtra.length}/2000
                  </span>
                </Label>
                <textarea
                  value={contextoExtra}
                  onChange={(e) => setContextoExtra(e.target.value)}
                  placeholder={
                    temReuniao
                      ? "Insights seus que não estão na reunião: o que você percebeu, hipóteses, decisões já tomadas, o que enfatizar. Deixe vazio pra usar só a transcrição."
                      : "Descreva o negócio: segmento, praça, momento atual, dores, histórico com marketing, o que você quer atacar."
                  }
                  rows={7}
                  maxLength={2000}
                  className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                {temReuniao && (
                  <p className="text-[10.5px] text-muted-foreground/70">
                    A transcrição da reunião já vai junto automaticamente — aqui é só o que você quer
                    acrescentar por cima.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Tom de voz</Label>
                <Select value={tom} onValueChange={(v) => setTom(v as typeof tom)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultivo">Consultivo (default) · diagnóstico estratégico</SelectItem>
                    <SelectItem value="direto">Direto · objetivo e prático</SelectItem>
                    <SelectItem value="estrategico">Estratégico · visão de longo prazo</SelectItem>
                    <SelectItem value="caloroso">Caloroso · próximo e humano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {secaoFocoTitulo && (
                <p className="text-[11px] text-muted-foreground bg-secondary/30 rounded-md px-3 py-2">
                  Vai gerar <strong>só a seção "{secaoFocoTitulo}"</strong>. Pra gerar tudo, feche e
                  use "Gerar com IA" na barra superior.
                </p>
              )}
            </div>
          )}

          {etapa === 2 && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block">Copia o prompt e cola no Claude</Label>
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
                O Claude vai retornar um bloco JSON com as seções. Copia <strong>tudo</strong> que ele
                responder e cola no próximo passo — a gente extrai o JSON automaticamente.
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block">Cola a resposta do Claude</Label>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed mb-2">
                  Pode ser o JSON puro ou o texto inteiro (com ```json...``` envolvendo) —
                  achamos o bloco automaticamente.
                </p>
              </div>

              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                placeholder={'```json\n{\n  "sec-...": "conteúdo da seção em markdown",\n  ...\n}\n```'}
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
              <Button onClick={preparar} disabled={preparando}>
                {preparando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando...
                  </>
                ) : (
                  <>Gerar prompt →</>
                )}
              </Button>
            )}
            {etapa === 2 && <Button onClick={() => setEtapa(3)}>Já tenho a resposta →</Button>}
            {etapa === 3 && (
              <Button onClick={aplicar} disabled={aplicando || resposta.trim().length < 20}>
                {aplicando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Aplicar no diagnóstico
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

// ─── Dialog compartilhar (gera shareToken) ─────────────────────────────

function CompartilharDialog({
  diagnosticoId,
  numero,
  jaCompartilhado,
  onOpenChange,
  onSent,
}: {
  diagnosticoId: string;
  numero: string;
  jaCompartilhado: boolean;
  onOpenChange: (o: boolean) => void;
  onSent: (updated: {
    shareToken: string;
    shareExpiraEm: string;
    status: DiagnosticoStatus;
    enviadoEm: string;
  }) => void;
}) {
  const [validadeDias, setValidadeDias] = useState(30);
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
      const res = await fetch(`/api/diagnosticos/${diagnosticoId}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validadeDias,
          senha: usarSenha ? senha : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao compartilhar");
      }
      const data = await res.json();
      const url = `${window.location.origin}/p/diagnostico/${data.shareToken}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
      toast.success(jaCompartilhado ? "Re-compartilhado · link novo copiado" : "Diagnóstico compartilhado · link copiado", {
        description: url,
      });
      onSent({
        shareToken: data.shareToken,
        shareExpiraEm:
          typeof data.shareExpiraEm === "string"
            ? data.shareExpiraEm
            : new Date(data.shareExpiraEm).toISOString(),
        status: data.status,
        enviadoEm:
          data.enviadoEm && typeof data.enviadoEm !== "string"
            ? new Date(data.enviadoEm).toISOString()
            : data.enviadoEm ?? new Date().toISOString(),
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
            {jaCompartilhado ? `Re-compartilhar ${numero}` : `Compartilhar ${numero}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {jaCompartilhado && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
              Atenção: re-compartilhar revoga o link anterior e gera um novo. Compartilhe o novo link com o cliente.
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
            {enviando ? "Gerando link..." : jaCompartilhado ? "Re-compartilhar e copiar" : "Compartilhar e copiar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function fmtTimecode(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function highlight(texto: string, q: string) {
  if (!q) return texto;
  const parts = texto.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="bg-sal-600/30 text-sal-400 rounded px-0.5">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
