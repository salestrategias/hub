"use client";
/**
 * BriefingEditor — lado do Hub do módulo de Briefings.
 *
 * Layout 2 zonas:
 *  - ESQUERDA: card de informações (título, cliente, status) + ações
 *    (enviar/compartilhar, excluir).
 *  - CENTRO: construtor de perguntas — lista reordenável (drag + ↑↓), cada
 *    pergunta com texto, tipo (TIPOS_PERGUNTA), opções (quando o tipo tem),
 *    toggle "obrigatória", ajuda opcional e remover. Agrupadas por `secao`.
 *    Quando RESPONDIDO, troca o construtor por um bloco read-only com as
 *    respostas do cliente formatadas por tipo.
 *
 * Persistência: PATCH parcial em /api/briefings/[id]. Edição de texto usa
 * debounce ~700ms; ações discretas (add/remover/reordenar/tipo/toggle/status)
 * salvam na hora. Mesmo padrão do DiagnosticoEditor.
 *
 * Compartilhar: dialog com link público /p/briefing/[token] num input
 * somente-leitura + Copiar (mesma proteção anti-vazamento do mapa mental).
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineField } from "@/components/inline-field";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Send,
  Share2,
  Link2,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Asterisk,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type BriefingPergunta,
  type BriefingTipoPergunta,
  type BriefingStatusUi,
  TIPOS_PERGUNTA,
  BRIEFING_STATUS_META,
  tipoTemOpcoes,
  novaPerguntaId,
} from "@/lib/briefing";

type Cliente = { id: string; nome: string };

type BriefingFull = {
  id: string;
  titulo: string;
  status: BriefingStatusUi;
  clienteId: string | null;
  clienteNome: string | null;
  perguntas: BriefingPergunta[];
  respostas: Record<string, string | string[]> | null;
  shareToken: string | null;
  shareExpiraEm: string | null;
  enviadoEm: string | null;
  respondidoEm: string | null;
};

const STATUS_ORDEM: BriefingStatusUi[] = ["RASCUNHO", "ENVIADO", "RESPONDIDO", "ARQUIVADO"];

export function BriefingEditor({
  briefing: initial,
  clientes,
}: {
  briefing: BriefingFull;
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [brief, setBrief] = useState(initial);
  const [perguntas, setPerguntas] = useState<BriefingPergunta[]>(initial.perguntas);
  const [shareOpen, setShareOpen] = useState(false);

  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  const respondido = brief.status === "RESPONDIDO";
  const shareUrl =
    brief.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/p/briefing/${brief.shareToken}`
      : "";

  // ─── Persistência ────────────────────────────────────────────────────
  async function patchBriefing(patch: Record<string, unknown>) {
    const res = await fetch(`/api/briefings/${brief.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setBrief((b) => ({
      ...b,
      titulo: updated.titulo ?? b.titulo,
      status: (updated.status ?? b.status) as BriefingStatusUi,
      clienteId: updated.clienteId ?? null,
      clienteNome: updated.cliente?.nome ?? updated.clienteNome ?? b.clienteNome,
      respondidoEm: updated.respondidoEm
        ? new Date(updated.respondidoEm).toISOString()
        : b.respondidoEm,
    }));
    return updated;
  }

  /** Persiste o array de perguntas. `imediato` pula o debounce (ações discretas). */
  function persistirPerguntas(novas: BriefingPergunta[], imediato = false) {
    setPerguntas(novas);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const fazer = async () => {
      setSalvando(true);
      try {
        await fetch(`/api/briefings/${brief.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perguntas: novas }),
        });
        setSalvoEm(new Date().toISOString());
      } catch {
        toast.error("Falha ao salvar perguntas");
      } finally {
        setSalvando(false);
      }
    };
    if (imediato) void fazer();
    else saveTimer.current = setTimeout(fazer, 700);
  }

  // ─── Operações de pergunta ───────────────────────────────────────────
  function atualizarPergunta(id: string, patch: Partial<BriefingPergunta>, imediato = false) {
    persistirPerguntas(
      perguntas.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      imediato
    );
  }

  function moverPergunta(idx: number, dir: -1 | 1) {
    const ni = idx + dir;
    if (ni < 0 || ni >= perguntas.length) return;
    const novas = [...perguntas];
    [novas[idx], novas[ni]] = [novas[ni], novas[idx]];
    persistirPerguntas(novas, true);
  }

  function reordenarPorDrag(de: number, para: number) {
    if (de === para) return;
    const novas = [...perguntas];
    const [movida] = novas.splice(de, 1);
    novas.splice(para, 0, movida);
    persistirPerguntas(novas, true);
  }

  function adicionarPergunta() {
    const ultima = perguntas[perguntas.length - 1];
    const nova: BriefingPergunta = {
      id: novaPerguntaId(),
      pergunta: "",
      tipo: "TEXTO",
      // Herda a seção da última pergunta (continuidade ao montar por blocos).
      secao: ultima?.secao,
    };
    persistirPerguntas([...perguntas, nova], true);
  }

  function removerPergunta(id: string) {
    const alvo = perguntas.find((p) => p.id === id);
    if (!alvo) return;
    const rotulo = alvo.pergunta.trim() || "esta pergunta";
    if (!confirm(`Remover "${rotulo}"? Esta ação não pode ser desfeita.`)) return;
    persistirPerguntas(
      perguntas.filter((p) => p.id !== id),
      true
    );
  }

  function mudarTipo(id: string, tipo: BriefingTipoPergunta) {
    const p = perguntas.find((x) => x.id === id);
    if (!p) return;
    const patch: Partial<BriefingPergunta> = { tipo };
    // Garante opções default ao virar um tipo que precisa delas; limpa ao sair.
    if (tipoTemOpcoes(tipo)) {
      if (!p.opcoes || p.opcoes.length === 0) patch.opcoes = ["Opção 1", "Opção 2"];
    } else {
      patch.opcoes = undefined;
    }
    atualizarPergunta(id, patch, true);
  }

  async function excluir() {
    if (!confirm("Excluir este briefing? Não dá pra desfazer.")) return;
    const res = await fetch(`/api/briefings/${brief.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Briefing excluído");
    router.push("/briefings");
  }

  const cor = BRIEFING_STATUS_META[brief.status];

  return (
    <div className="space-y-5">
      {/* Barra superior: status + ações */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border border-border bg-card">
        <Badge
          variant="outline"
          className={cn("text-[11px] font-medium gap-1.5", cor.text, cor.border)}
        >
          {cor.label}
        </Badge>

        <Select
          value={brief.status}
          onValueChange={(v) => {
            const status = v as BriefingStatusUi;
            setBrief((b) => ({ ...b, status }));
            void patchBriefing({ status }).catch(() => toast.error("Falha ao mudar status"));
          }}
        >
          <SelectTrigger className="h-7 w-[140px] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ORDEM.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {BRIEFING_STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-[10.5px] text-muted-foreground">
          {perguntas.length} {perguntas.length === 1 ? "pergunta" : "perguntas"}
        </span>
        {brief.respondidoEm && (
          <span className="text-[10.5px] text-emerald-400">
            Respondido em {new Date(brief.respondidoEm).toLocaleDateString("pt-BR")}
          </span>
        )}
        {salvando ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> salvando
          </span>
        ) : salvoEm ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" /> salvo
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {brief.shareToken && (
            <Button asChild variant="outline" size="sm">
              <a href={`/p/briefing/${brief.shareToken}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Pré-visualizar
              </a>
            </Button>
          )}
          <Button size="sm" onClick={() => setShareOpen(true)}>
            {brief.shareToken ? (
              <>
                <Share2 className="h-3.5 w-3.5" /> Link de envio
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Enviar
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

      <div className="grid gap-5 items-start lg:grid-cols-[280px_1fr]">
        {/* ── ESQUERDA: informações ── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Informações
              </div>
              <InlineField
                type="text"
                label="Título do briefing"
                value={brief.titulo}
                onSave={(v) => patchBriefing({ titulo: v })}
                size="sm"
              />
              <InlineField
                type="select"
                label="Cliente"
                value={brief.clienteId ?? ""}
                options={[
                  { value: "", label: "— Nenhum / prospect —" },
                  ...clientes.map((c) => ({ value: c.id, label: c.nome })),
                ]}
                onSave={(v) => patchBriefing({ clienteId: v || null })}
                size="sm"
              />
              {!brief.clienteId && (
                <InlineField
                  type="text"
                  label="Nome (snapshot)"
                  value={brief.clienteNome ?? ""}
                  onSave={(v) => patchBriefing({ clienteNome: v || null })}
                  placeholder="Nome do prospect"
                  size="sm"
                />
              )}
              <p className="text-[10.5px] text-muted-foreground/70 leading-relaxed pt-1">
                Monte as perguntas ao lado e clique em <strong>Enviar</strong> pra gerar um link
                que o cliente preenche — sem login.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── CENTRO: construtor OU respostas ── */}
        <div className="space-y-4 min-w-0">
          {respondido ? (
            <RespostasView perguntas={perguntas} respostas={brief.respostas} />
          ) : (
            <ConstrutorPerguntas
              perguntas={perguntas}
              onAtualizar={atualizarPergunta}
              onMudarTipo={mudarTipo}
              onMover={moverPergunta}
              onReordenar={reordenarPorDrag}
              onRemover={removerPergunta}
              onAdicionar={adicionarPergunta}
            />
          )}
        </div>
      </div>

      <CompartilharDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        briefingId={brief.id}
        shareToken={brief.shareToken}
        shareUrl={shareUrl}
        onChange={(patch) => setBrief((b) => ({ ...b, ...patch }))}
      />
    </div>
  );
}

// ─── Construtor de perguntas ─────────────────────────────────────────────

function ConstrutorPerguntas({
  perguntas,
  onAtualizar,
  onMudarTipo,
  onMover,
  onReordenar,
  onRemover,
  onAdicionar,
}: {
  perguntas: BriefingPergunta[];
  onAtualizar: (id: string, patch: Partial<BriefingPergunta>, imediato?: boolean) => void;
  onMudarTipo: (id: string, tipo: BriefingTipoPergunta) => void;
  onMover: (idx: number, dir: -1 | 1) => void;
  onReordenar: (de: number, para: number) => void;
  onRemover: (id: string) => void;
  onAdicionar: () => void;
}) {
  const dragIdx = useRef<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {perguntas.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma pergunta ainda. Clique em <strong>Adicionar pergunta</strong> pra começar a
            montar o formulário.
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {perguntas.map((p, idx) => {
          // Cabeçalho de seção quando muda em relação à anterior.
          const secaoAnterior = idx > 0 ? perguntas[idx - 1].secao : undefined;
          const mostrarSecao = !!p.secao && p.secao !== secaoAnterior;
          return (
            <li key={p.id}>
              {mostrarSecao && (
                <div className="px-1 pt-1 pb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {p.secao}
                </div>
              )}
              <div
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
                  "rounded-lg border bg-card transition-colors",
                  sobre === idx ? "border-sal-500/60" : "border-border"
                )}
              >
                <PerguntaCard
                  pergunta={p}
                  indice={idx}
                  total={perguntas.length}
                  onAtualizar={onAtualizar}
                  onMudarTipo={onMudarTipo}
                  onMover={onMover}
                  onRemover={onRemover}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <Button variant="outline" size="sm" className="w-full" onClick={onAdicionar}>
        <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
      </Button>
    </div>
  );
}

function PerguntaCard({
  pergunta: p,
  indice,
  total,
  onAtualizar,
  onMudarTipo,
  onMover,
  onRemover,
}: {
  pergunta: BriefingPergunta;
  indice: number;
  total: number;
  onAtualizar: (id: string, patch: Partial<BriefingPergunta>, imediato?: boolean) => void;
  onMudarTipo: (id: string, tipo: BriefingTipoPergunta) => void;
  onMover: (idx: number, dir: -1 | 1) => void;
  onRemover: (id: string) => void;
}) {
  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0 mt-2" />
        <span className="text-[11px] font-mono text-muted-foreground/60 shrink-0 mt-2.5 w-5 text-right">
          {indice + 1}
        </span>
        <div className="flex-1 min-w-0 space-y-2">
          {/* Texto da pergunta */}
          <Input
            value={p.pergunta}
            onChange={(e) => onAtualizar(p.id, { pergunta: e.target.value })}
            placeholder="Escreva a pergunta..."
            className="h-9 text-sm font-medium"
          />

          {/* Linha: tipo + obrigatória */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={p.tipo} onValueChange={(v) => onMudarTipo(p.id, v as BriefingTipoPergunta)}>
              <SelectTrigger className="h-8 w-[210px] text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PERGUNTA.map((t) => (
                  <SelectItem key={t.tipo} value={t.tipo} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              role="switch"
              aria-checked={!!p.obrigatoria}
              onClick={() => onAtualizar(p.id, { obrigatoria: !p.obrigatoria }, true)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[11.5px] transition-colors",
                p.obrigatoria
                  ? "border-sal-500/40 bg-sal-600/10 text-sal-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              title={p.obrigatoria ? "Obrigatória — clique pra tornar opcional" : "Opcional — clique pra tornar obrigatória"}
            >
              <Asterisk className="h-3 w-3" />
              {p.obrigatoria ? "Obrigatória" : "Opcional"}
            </button>
          </div>

          {/* Opções (ESCOLHA / CAIXAS / LISTA) */}
          {tipoTemOpcoes(p.tipo) && (
            <OpcoesEditor
              opcoes={p.opcoes ?? []}
              onChange={(opcoes) => onAtualizar(p.id, { opcoes })}
            />
          )}

          {/* Texto de ajuda */}
          <Input
            value={p.ajuda ?? ""}
            onChange={(e) => onAtualizar(p.id, { ajuda: e.target.value || undefined })}
            placeholder="Texto de ajuda (opcional) — aparece abaixo da pergunta pro cliente"
            className="h-8 text-[12px] text-muted-foreground"
          />
        </div>

        {/* Ações: subir/descer/remover */}
        <div className="flex flex-col items-center shrink-0">
          <button
            type="button"
            onClick={() => onMover(indice, -1)}
            disabled={indice === 0}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Subir"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMover(indice, 1)}
            disabled={indice === total - 1}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Descer"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemover(p.id)}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive"
            title="Remover pergunta"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OpcoesEditor({
  opcoes,
  onChange,
}: {
  opcoes: string[];
  onChange: (opcoes: string[]) => void;
}) {
  function setOpcao(i: number, v: string) {
    onChange(opcoes.map((o, idx) => (idx === i ? v : o)));
  }
  function removerOpcao(i: number) {
    onChange(opcoes.filter((_, idx) => idx !== i));
  }
  function adicionarOpcao() {
    onChange([...opcoes, `Opção ${opcoes.length + 1}`]);
  }
  return (
    <div className="rounded-md border border-border bg-background/40 p-2 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold px-0.5">
        Opções
      </div>
      {opcoes.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
          <Input
            value={o}
            onChange={(e) => setOpcao(i, e.target.value)}
            placeholder={`Opção ${i + 1}`}
            className="h-7 text-[12px]"
          />
          <button
            type="button"
            onClick={() => removerOpcao(i)}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
            title="Remover opção"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={adicionarOpcao}
        className="text-[11.5px] text-sal-400 hover:text-sal-300 inline-flex items-center gap-1 px-0.5 pt-0.5"
      >
        <Plus className="h-3 w-3" /> Adicionar opção
      </button>
    </div>
  );
}

// ─── Respostas do cliente (read-only) ────────────────────────────────────

function RespostasView({
  perguntas,
  respostas,
}: {
  perguntas: BriefingPergunta[];
  respostas: Record<string, string | string[]> | null;
}) {
  if (!respostas || Object.keys(respostas).length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          O briefing está marcado como respondido, mas nenhuma resposta foi registrada.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-5 space-y-1">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Respostas do cliente
        </div>
        <ul className="space-y-4">
          {perguntas.map((p, idx) => {
            const secaoAnterior = idx > 0 ? perguntas[idx - 1].secao : undefined;
            const mostrarSecao = !!p.secao && p.secao !== secaoAnterior;
            return (
              <li key={p.id} className="space-y-1">
                {mostrarSecao && (
                  <div className="text-[10.5px] uppercase tracking-wider text-sal-400/70 font-semibold pt-2 pb-1 border-t border-border/40">
                    {p.secao}
                  </div>
                )}
                <div className="text-[12.5px] font-medium">
                  {p.pergunta || <span className="text-muted-foreground/60">(sem texto)</span>}
                </div>
                <RespostaValor tipo={p.tipo} valor={respostas[p.id]} />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function RespostaValor({
  tipo,
  valor,
}: {
  tipo: BriefingTipoPergunta;
  valor: string | string[] | undefined;
}) {
  const vazio = valor == null || (Array.isArray(valor) ? valor.length === 0 : valor.trim() === "");
  if (vazio) {
    return <div className="text-[12.5px] text-muted-foreground/50 italic">— sem resposta —</div>;
  }

  // CAIXAS: lista de marcados.
  if (Array.isArray(valor)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {valor.map((v, i) => (
          <Badge key={i} variant="outline" className="text-[11px] font-normal">
            {v}
          </Badge>
        ))}
      </div>
    );
  }

  if (tipo === "LINK") {
    return (
      <a
        href={valor}
        target="_blank"
        rel="noreferrer"
        className="text-[12.5px] text-sal-400 hover:underline break-all inline-flex items-center gap-1"
      >
        <Link2 className="h-3 w-3 shrink-0" /> {valor}
      </a>
    );
  }

  if (tipo === "UPLOAD") {
    const ehUrl = /^https?:\/\//i.test(valor) || valor.startsWith("data:");
    return ehUrl ? (
      <a
        href={valor}
        target="_blank"
        rel="noreferrer"
        className="text-[12.5px] text-sal-400 hover:underline break-all inline-flex items-center gap-1"
      >
        <ExternalLink className="h-3 w-3 shrink-0" /> Abrir arquivo
      </a>
    ) : (
      <div className="text-[12.5px] whitespace-pre-wrap break-words">{valor}</div>
    );
  }

  if (tipo === "DATA") {
    const d = new Date(valor);
    const txt = isNaN(d.getTime()) ? valor : d.toLocaleDateString("pt-BR");
    return <div className="text-[12.5px]">{txt}</div>;
  }

  // TEXTO / PARAGRAFO / ESCOLHA / LISTA / NUMERO / SIM_NAO
  return <div className="text-[12.5px] whitespace-pre-wrap break-words">{valor}</div>;
}

// ─── Dialog de envio / link público ──────────────────────────────────────

function CompartilharDialog({
  open,
  onOpenChange,
  briefingId,
  shareToken,
  shareUrl,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefingId: string;
  shareToken: string | null;
  shareUrl: string;
  onChange: (patch: Partial<BriefingFull>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function gerar() {
    setBusy(true);
    try {
      const res = await fetch(`/api/briefings/${briefingId}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao gerar link");
      }
      const data = await res.json();
      onChange({
        shareToken: data.shareToken,
        status: data.status as BriefingStatusUi,
        enviadoEm: data.enviadoEm,
        shareExpiraEm: data.shareExpiraEm,
      });
      toast.success("Link de envio gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function revogar() {
    if (!confirm("Revogar o link? Quem já tiver o link não conseguirá mais preencher.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/briefings/${briefingId}/enviar`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao revogar");
      onChange({ shareToken: null, shareExpiraEm: null });
      toast.success("Link revogado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-sal-500" />
            Enviar briefing
          </DialogTitle>
          <DialogDescription>
            Gere um link público pra o cliente preencher o briefing. Quem tiver o link responde sem
            precisar de login. As respostas voltam pra cá.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 min-w-0">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Link de preenchimento</div>
              <div className="text-[11px] text-muted-foreground">
                {shareToken ? "Ativo" : "Ainda não gerado"}
              </div>
            </div>
            {shareToken ? (
              <Button size="sm" variant="outline" onClick={revogar} disabled={busy} className="shrink-0">
                Revogar
              </Button>
            ) : (
              <Button size="sm" onClick={gerar} disabled={busy} className="shrink-0">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Gerar link
              </Button>
            )}
          </div>

          {shareToken && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-muted-foreground">Link público</div>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 rounded-md border border-border bg-background pl-3 pr-2 h-9">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    readOnly
                    value={shareUrl}
                    onClick={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 w-full bg-transparent text-xs font-mono outline-none"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={copiar} className="shrink-0">
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[10.5px] text-muted-foreground/70">
                A página de preenchimento fica em <span className="font-mono">/p/briefing/…</span>
              </p>
            </div>
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
