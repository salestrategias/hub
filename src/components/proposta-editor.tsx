"use client";
/**
 * PropostaEditor — editor MODULAR de blocos da proposta (Fase 1, path B).
 *
 * Espelha o DiagnosticoEditor: layout 2-zonas com navegador de blocos à
 * esquerda (reordenar drag + ↑↓, ligar/desligar, adicionar do catálogo,
 * remover) + card "Informações" e "Valores" e "Identidade visual"; à
 * direita, a edição do bloco ativo.
 *
 * Edição por tipo:
 *  - `texto`/`capa` → BlockEditor rico em `bloco.conteudo` (a capa edita só
 *    o texto de apresentação; logo/cor/hero ficam no card de identidade).
 *  - estruturados (pacotes/cases/kpis/equipe/faq/timeline/garantias) →
 *    reusa os formulários de `proposta-blocos-editor`, agora editando
 *    `bloco.dados`.
 *
 * Persistência: a fonte da verdade passa a ser `proposta.secoes` (array de
 * blocos). PATCH `{ secoes }` com debounce 700ms na digitação e imediato em
 * ações discretas (toggle/reordenar/add/remove). As 8 colunas legadas +
 * `extras` NÃO são mais escritas (ficam congeladas pro dual-read/rollback).
 *
 * Preserva 100% das outras features: IA peer-review, gerar com IA,
 * enviar/share + aceite/recusa, PDF, versionamento, origem (lead/diagnóstico),
 * status, excluir.
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Stethoscope,
  TrendingUp,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  Type,
  Image as ImageIcon,
  Package,
  Trophy,
  BarChart3,
  Users,
  HelpCircle,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PacotesEditor,
  CasesEditor,
  KpisEditor,
  EquipeEditor,
  FaqEditor,
  TimelineEditor,
  GarantiasEditor,
} from "@/components/proposta-blocos-editor";
import {
  type BlocoPacotes,
  type BlocoCases,
  type BlocoKpis,
  type BlocoEquipe,
  type BlocoFaq,
  type BlocoTimeline,
  type BlocoGarantias,
  defaultPacotes,
  defaultCases,
  defaultKpis,
  defaultEquipe,
  defaultFaq,
  defaultTimeline,
  defaultGarantias,
} from "@/lib/proposta-blocos";
import {
  type Bloco,
  type BlocoTipo,
  BLOCO_LABEL,
  blocosDaProposta,
  blocoTemRichText,
  gerarBlocoId,
} from "@/lib/blocos";
import { PropostaVersoesHeader } from "@/components/proposta-versoes";
import { PropostaAnaliseIa, type AnaliseProposta } from "@/components/proposta-analise-ia";

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
  capaImagemUrl: string | null;
  extras: unknown;
  secoes: unknown;
  status: PropostaStatus;
  shareToken: string | null;
  shareExpiraEm: string | null;
  shareViews: number;
  enviadaEm: string | null;
  vistaEm: string | null;
  aceitaEm: string | null;
  recusadaEm: string | null;
  recusaMotivo: string | null;
  versao: number;
  versaoAtual: boolean;
  motivoRevisao: string | null;
  analiseIA: AnaliseProposta | null;
  analiseIAEm: string | null;
  lead: { id: string; empresa: string } | null;
  diagnosticoOrigem: { id: string; numero: string; titulo: string } | null;
};

type Cliente = { id: string; nome: string; email: string | null };

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

/** Ícone por tipo de bloco (pro navegador + catálogo). */
const BLOCO_ICON: Record<BlocoTipo, React.ComponentType<{ className?: string }>> = {
  texto: Type,
  capa: ImageIcon,
  pacotes: Package,
  cases: Trophy,
  kpis: BarChart3,
  equipe: Users,
  faq: HelpCircle,
  timeline: Calendar,
  garantias: ShieldCheck,
};

/** Ordem do catálogo "Adicionar bloco". */
const ORDEM_CATALOGO: BlocoTipo[] = [
  "texto",
  "capa",
  "pacotes",
  "cases",
  "kpis",
  "timeline",
  "garantias",
  "equipe",
  "faq",
];

/** Dados default por tipo, ao adicionar um bloco novo. */
function dadosDefault(tipo: BlocoTipo): Bloco["dados"] | undefined {
  switch (tipo) {
    case "pacotes":
      return { ...defaultPacotes(), visivel: true };
    case "cases":
      return { ...defaultCases(), visivel: true };
    case "kpis":
      return { ...defaultKpis(), visivel: true };
    case "equipe":
      return { ...defaultEquipe(), visivel: true };
    case "faq":
      return { ...defaultFaq(), visivel: true };
    case "timeline":
      return { ...defaultTimeline(), visivel: true };
    case "garantias":
      return { ...defaultGarantias(), visivel: true };
    case "capa":
      return { imagemUrl: undefined };
    default:
      return undefined;
  }
}

function tituloDefault(tipo: BlocoTipo): string {
  return BLOCO_LABEL[tipo];
}

export function PropostaEditor({ proposta: initial, clientes }: { proposta: PropostaFull; clientes: Cliente[] }) {
  const router = useRouter();
  const [proposta, setProposta] = useState(initial);
  // Deriva os blocos UMA vez (pra proposta legada, `deriveBlocosFromProposta`
  // gera ids aleatórios — chamar duas vezes daria ids divergentes).
  const blocosIniciais = useMemo(() => blocosDaProposta(initial), [initial]);
  const [blocos, setBlocos] = useState<Bloco[]>(blocosIniciais);
  const [ativoId, setAtivoId] = useState<string>(blocosIniciais[0]?.id ?? "");
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);

  // Debounce do save do array de blocos (escreve o array inteiro a cada edição).
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [salvandoSecoes, setSalvandoSecoes] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  const blocoAtivo = blocos.find((b) => b.id === ativoId) ?? blocos[0] ?? null;
  const visiveis = blocos.filter((b) => b.visivel).length;

  /** PATCH parcial de campos NÃO-bloco (info comercial, identidade, status). */
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

  /** Persiste o array de blocos em `secoes`. `imediato` pula o debounce. */
  function persistirSecoes(novos: Bloco[], imediato = false) {
    setBlocos(novos);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const fazer = async () => {
      setSalvandoSecoes(true);
      try {
        await fetch(`/api/propostas/${proposta.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secoes: novos }),
        });
        setSalvoEm(new Date().toISOString());
      } catch {
        toast.error("Falha ao salvar blocos");
      } finally {
        setSalvandoSecoes(false);
      }
    };
    if (imediato) void fazer();
    else saveTimer.current = setTimeout(fazer, 700);
  }

  function atualizarBloco(id: string, patch: Partial<Bloco>, imediato = false) {
    persistirSecoes(
      blocos.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      imediato
    );
  }

  function moverBloco(idx: number, dir: -1 | 1) {
    const ni = idx + dir;
    if (ni < 0 || ni >= blocos.length) return;
    const novos = [...blocos];
    [novos[idx], novos[ni]] = [novos[ni], novos[idx]];
    persistirSecoes(reindexar(novos), true);
  }

  function reordenarPorDrag(de: number, para: number) {
    if (de === para) return;
    const novos = [...blocos];
    const [movido] = novos.splice(de, 1);
    novos.splice(para, 0, movido);
    persistirSecoes(reindexar(novos), true);
  }

  function adicionarBloco(tipo: BlocoTipo) {
    const novo: Bloco = {
      id: gerarBlocoId(tipo),
      tipo,
      titulo: tituloDefault(tipo),
      visivel: true,
      ordem: blocos.length,
      conteudo: blocoTemRichText(tipo) ? "" : null,
      dados: dadosDefault(tipo),
    };
    persistirSecoes(reindexar([...blocos, novo]), true);
    setAtivoId(novo.id);
  }

  function removerBloco(id: string) {
    const alvo = blocos.find((b) => b.id === id);
    if (!alvo) return;
    if (!confirm(`Remover o bloco "${alvo.titulo ?? BLOCO_LABEL[alvo.tipo]}"? O conteúdo dele será perdido.`)) return;
    const novos = reindexar(blocos.filter((b) => b.id !== id));
    persistirSecoes(novos, true);
    if (ativoId === id) setAtivoId(novos[0]?.id ?? "");
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
      {/* Header de versionamento — avisos + dropdown + nova revisão */}
      <PropostaVersoesHeader
        propostaId={proposta.id}
        versao={proposta.versao}
        versaoAtual={proposta.versaoAtual}
        motivoRevisao={proposta.motivoRevisao}
      />

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

        <span className="text-[10.5px] text-muted-foreground">
          {visiveis} de {blocos.length} blocos visíveis
        </span>
        {salvandoSecoes ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> salvando
          </span>
        ) : salvoEm ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" /> salvo
          </span>
        ) : null}

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

        {proposta.diagnosticoOrigem && (
          <Link
            href={`/diagnosticos/${proposta.diagnosticoOrigem.id}`}
            className="inline-flex items-center gap-1.5 text-[10.5px] text-sal-400 hover:underline"
            title={`Gerada a partir do diagnóstico: ${proposta.diagnosticoOrigem.titulo}`}
          >
            <Stethoscope className="h-3 w-3" /> do diagnóstico {proposta.diagnosticoOrigem.numero}
          </Link>
        )}
        {proposta.lead && (
          <Link
            href={`/leads?lead=${proposta.lead.id}`}
            className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground hover:text-foreground hover:underline"
            title={`Lead de origem: ${proposta.lead.empresa}`}
          >
            <TrendingUp className="h-3 w-3" /> do lead {proposta.lead.empresa}
          </Link>
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
          <PropostaAnaliseIa
            propostaId={proposta.id}
            analise={proposta.analiseIA}
            analiseEm={proposta.analiseIAEm}
          />
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

      {/* Layout 2-zonas: esquerda = info + navegador de blocos; centro = edição do bloco */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* ── ESQUERDA ── */}
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

          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Blocos
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

              <BlocoNavegador
                blocos={blocos}
                ativoId={ativoId}
                onSelecionar={setAtivoId}
                onToggle={(id, visivel) => atualizarBloco(id, { visivel }, true)}
                onMover={moverBloco}
                onReordenar={reordenarPorDrag}
                onRemover={removerBloco}
              />

              <AdicionarBloco onAdicionar={adicionarBloco} />
            </CardContent>
          </Card>

          <IdentidadeVisualCard
            logoUrl={proposta.logoUrl}
            corPrimaria={proposta.corPrimaria ?? "#7E30E1"}
            capaImagemUrl={proposta.capaImagemUrl}
            onLogoChange={(url) => {
              setProposta((p) => ({ ...p, logoUrl: url }));
              void patchProposta({ logoUrl: url });
            }}
            onCorChange={(cor) => {
              setProposta((p) => ({ ...p, corPrimaria: cor }));
              void patchProposta({ corPrimaria: cor });
            }}
            onCapaImagemChange={(url) => {
              setProposta((p) => ({ ...p, capaImagemUrl: url }));
              void patchProposta({ capaImagemUrl: url });
            }}
          />

          <Card className="bg-secondary/30">
            <CardContent className="p-4 space-y-2 text-[11px] text-muted-foreground">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Variáveis disponíveis
              </div>
              <p className="leading-relaxed">Use nos blocos de texto pra preenchimento automático:</p>
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

        {/* ── CENTRO: edição do bloco ativo ── */}
        <div className="space-y-4 min-w-0">
          {blocoAtivo ? (
            <BlocoEditorCentro
              key={blocoAtivo.id}
              bloco={blocoAtivo}
              onTituloChange={(titulo) => atualizarBloco(blocoAtivo.id, { titulo })}
              onConteudoChange={(conteudo) => atualizarBloco(blocoAtivo.id, { conteudo })}
              onDadosChange={(dados) => atualizarBloco(blocoAtivo.id, { dados })}
            />
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Nenhum bloco. Adicione um bloco do catálogo à esquerda pra começar.
              </CardContent>
            </Card>
          )}
        </div>
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

function reindexar(blocos: Bloco[]): Bloco[] {
  return blocos.map((b, i) => ({ ...b, ordem: i }));
}

// ─── Navegador de blocos (reordenável + toggle + remover) ──────────────

function BlocoNavegador({
  blocos,
  ativoId,
  onSelecionar,
  onToggle,
  onMover,
  onReordenar,
  onRemover,
}: {
  blocos: Bloco[];
  ativoId: string;
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
      {blocos.map((b, idx) => {
        const Icon = BLOCO_ICON[b.tipo];
        const ativo = b.id === ativoId;
        return (
          <li
            key={b.id}
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
              ativo ? "bg-primary/15" : "hover:bg-secondary/60",
              sobre === idx && "border-sal-500/60",
              !b.visivel && "opacity-60"
            )}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab shrink-0" />
            <button
              type="button"
              onClick={() => onSelecionar(b.id)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", ativo ? "text-sal-400" : "text-muted-foreground")} />
              <span
                className={cn(
                  "text-[12px] truncate",
                  ativo ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {b.titulo ?? BLOCO_LABEL[b.tipo]}
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
                disabled={idx === blocos.length - 1}
                className="h-5 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Descer"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onRemover(b.id)}
                className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive"
                title="Remover bloco"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={b.visivel}
              onClick={() => onToggle(b.id, !b.visivel)}
              className={cn(
                "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 ml-0.5",
                b.visivel ? "bg-primary" : "bg-muted/60"
              )}
              title={b.visivel ? "Visível — clique pra ocultar" : "Oculto — clique pra mostrar"}
            >
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-full bg-white shadow transition-transform",
                  b.visivel ? "translate-x-[15px]" : "translate-x-[3px]"
                )}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AdicionarBloco({ onAdicionar }: { onAdicionar: (tipo: BlocoTipo) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="pt-1">
      {!aberto ? (
        <Button variant="outline" size="sm" className="w-full h-8 text-[11px]" onClick={() => setAberto(true)}>
          <Plus className="h-3.5 w-3.5" /> Adicionar bloco
        </Button>
      ) : (
        <div className="rounded-md border border-border bg-background/40 p-1.5 space-y-0.5">
          <div className="px-1.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Catálogo de blocos
          </div>
          {ORDEM_CATALOGO.map((tipo) => {
            const Icon = BLOCO_ICON[tipo];
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
                <span className="text-[12px] truncate">{BLOCO_LABEL[tipo]}</span>
              </button>
            );
          })}
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

// ─── Centro: edição do bloco ativo (despacha por tipo) ─────────────────

function BlocoEditorCentro({
  bloco,
  onTituloChange,
  onConteudoChange,
  onDadosChange,
}: {
  bloco: Bloco;
  onTituloChange: (titulo: string) => void;
  onConteudoChange: (conteudo: string) => void;
  onDadosChange: (dados: Bloco["dados"]) => void;
}) {
  const Icon = BLOCO_ICON[bloco.tipo];
  const richText = blocoTemRichText(bloco.tipo);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <Input
              value={bloco.titulo ?? ""}
              onChange={(e) => onTituloChange(e.target.value)}
              className="h-9 text-sm font-semibold border-transparent bg-transparent px-0 focus-visible:bg-background/40 focus-visible:px-2"
              placeholder={`Título do bloco (${BLOCO_LABEL[bloco.tipo]})`}
            />
            <p className="text-[11px] text-muted-foreground">{descricaoTipo(bloco.tipo)}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
            {BLOCO_LABEL[bloco.tipo]}
          </Badge>
        </div>

        {bloco.tipo === "capa" && (
          <p className="text-[11px] text-muted-foreground bg-secondary/30 rounded-md px-3 py-2 leading-relaxed">
            A imagem de fundo (hero), o logo e a cor da capa ficam no card{" "}
            <strong>Identidade visual</strong> à esquerda. Aqui você edita o texto de apresentação
            que aparece logo abaixo da capa.
          </p>
        )}

        {richText ? (
          <div className="rounded-md border border-border bg-background/40 p-3">
            <BlockEditor
              key={bloco.id}
              value={bloco.conteudo || ""}
              onChange={(blocks: PartialBlock[]) => onConteudoChange(JSON.stringify(blocks))}
              placeholder={descricaoTipo(bloco.tipo)}
              minHeight="320px"
            />
          </div>
        ) : (
          <BlocoEstruturadoEditor bloco={bloco} onDadosChange={onDadosChange} />
        )}

        {!bloco.visivel && (
          <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
            Este bloco está <strong>oculto</strong> — não aparece na proposta pública nem no PDF.
            Ative no navegador à esquerda pra incluí-lo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Despacha o formulário estruturado certo, editando `bloco.dados`. */
function BlocoEstruturadoEditor({
  bloco,
  onDadosChange,
}: {
  bloco: Bloco;
  onDadosChange: (dados: Bloco["dados"]) => void;
}) {
  switch (bloco.tipo) {
    case "pacotes":
      return (
        <PacotesEditor
          bloco={{ ...defaultPacotes(), ...(bloco.dados as BlocoPacotes) }}
          onChange={(b) => onDadosChange(b)}
        />
      );
    case "cases":
      return (
        <CasesEditor
          bloco={{ ...defaultCases(), ...(bloco.dados as BlocoCases) }}
          onChange={(b) => onDadosChange(b)}
        />
      );
    case "kpis":
      return (
        <KpisEditor
          bloco={{ ...defaultKpis(), ...(bloco.dados as BlocoKpis) }}
          onChange={(b) => onDadosChange(b)}
        />
      );
    case "equipe":
      return (
        <EquipeEditor
          bloco={{ ...defaultEquipe(), ...(bloco.dados as BlocoEquipe) }}
          onChange={(b) => onDadosChange(b)}
        />
      );
    case "faq":
      return (
        <FaqEditor
          bloco={{ ...defaultFaq(), ...(bloco.dados as BlocoFaq) }}
          onChange={(b) => onDadosChange(b)}
        />
      );
    case "timeline":
      return (
        <TimelineEditor
          bloco={{ ...defaultTimeline(), ...(bloco.dados as BlocoTimeline) }}
          onChange={(b) => onDadosChange(b)}
        />
      );
    case "garantias":
      return (
        <GarantiasEditor
          bloco={{ ...defaultGarantias(), ...(bloco.dados as BlocoGarantias) }}
          onChange={(b) => onDadosChange(b)}
        />
      );
    default:
      return null;
  }
}

function descricaoTipo(tipo: BlocoTipo): string {
  switch (tipo) {
    case "texto":
      return "Bloco de texto rico. Use @cliente e variáveis {{...}} pra personalizar.";
    case "capa":
      return "Texto de apresentação: quem somos, posicionamento, autoridade. Saudação com {{cliente.nome}}.";
    case "pacotes":
      return "Tabela comparativa de pacotes (Starter / Profissional / Premium) com features.";
    case "cases":
      return "Grid de resultados de clientes anteriores — prova social.";
    case "kpis":
      return "Cards com metas SMART em destaque — compromisso público.";
    case "equipe":
      return "Headshots + bios de quem vai cuidar do cliente.";
    case "faq":
      return "Perguntas frequentes — mata objeções antes do CTA.";
    case "timeline":
      return "Marcos visuais com período + status (concluído / em andamento / pendente).";
    case "garantias":
      return "Selos de confiança (sem fidelidade, suporte 24h, etc).";
  }
}

/**
 * Modal "Gerar com Claude (modo Max)" — 3 etapas, custo zero, copy-paste
 * entre Hub e Claude Desktop/Web:
 *
 *   1. Contexto: descreve oportunidade + tom de voz
 *   2. Copiar prompt: Hub monta prompt completo, mostra com "Copiar"
 *      e link "Abrir Claude". Marcelo cola, recebe JSON
 *   3. Aplicar: cola resposta JSON, Hub parseia + grava nas seções
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
                  <span className="text-[10px] text-muted-foreground/70 font-mono">{prompt.length}/4000</span>
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
                💡 Dica: o Claude vai retornar um bloco JSON com as seções. Copia
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
            {etapa === 2 && <Button onClick={() => setEtapa(3)}>Já tenho a resposta →</Button>}
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
 * Card de identidade visual: logo (upload ou URL) + cor primária + hero da capa.
 * Logo é comprimido pra ~256x96 antes de virar dataURL pra caber no banco
 * sem inflar (mesma técnica do avatar).
 */
function IdentidadeVisualCard({
  logoUrl,
  corPrimaria,
  capaImagemUrl,
  onLogoChange,
  onCorChange,
  onCapaImagemChange,
}: {
  logoUrl: string | null;
  corPrimaria: string;
  capaImagemUrl: string | null;
  onLogoChange: (url: string | null) => void;
  onCorChange: (cor: string) => void;
  onCapaImagemChange: (url: string | null) => void;
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

  async function handleCapaImagem(file: File) {
    if (file.size > 4_000_000) {
      toast.error("Imagem grande demais — máximo 4MB");
      return;
    }
    try {
      // Hero da capa: 1920x1080 max — vira background da capa
      const dataUrl = await comprimirImagem(file, 1920, 1080);
      onCapaImagemChange(dataUrl);
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

        {/* Imagem hero da capa */}
        <div className="space-y-1.5 pt-2 border-t border-border/40">
          <Label className="text-[11px]">Imagem hero da capa (opcional)</Label>
          <div className="flex items-center gap-2">
            <div className="h-12 w-24 rounded-md border border-border bg-background/40 flex items-center justify-center overflow-hidden shrink-0">
              {capaImagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={capaImagemUrl} alt="Capa" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-muted-foreground/60">Sem imagem</span>
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
                    if (f) void handleCapaImagem(f);
                  }}
                />
                <Button asChild size="sm" variant="outline" className="w-full text-[11px] h-7">
                  <span>{capaImagemUrl ? "Trocar imagem" : "Enviar imagem"}</span>
                </Button>
              </label>
              {capaImagemUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-[10px] h-6 text-destructive hover:text-destructive"
                  onClick={() => onCapaImagemChange(null)}
                >
                  Remover hero
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            Background da capa em vez do gradiente roxo. Recomendado: 1920×1080px,
            imagem com pouco detalhe (vai ter overlay escuro pro texto ficar legível).
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
          <DialogTitle>{jaEnviada ? `Re-enviar ${numero}` : `Enviar ${numero}`}</DialogTitle>
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
