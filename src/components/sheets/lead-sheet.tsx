"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeadStatus, LeadPorte, Prioridade, PropostaStatus } from "@prisma/client";
import type { PartialBlock } from "@blocknote/core";
import { TrendingUp, Trash2, Sparkles, FileSignature, Mail, Phone, Target, RotateCcw } from "lucide-react";
import { calcularLeadScore } from "@/lib/lead-score";
import { cn } from "@/lib/utils";
import { EntitySheet } from "@/components/entity-sheet";
import { InlineField } from "@/components/inline-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import { MoneyValue } from "@/components/money-value";
import type { LeadCard } from "@/components/leads-kanban";

type LeadFull = LeadCard & {
  notas: string | null;
  // Datas brutas (vindas como string ISO do server) que o breakdown precisa
  createdAt: string;
  propostas: Array<{
    id: string;
    numero: string;
    titulo: string;
    status: PropostaStatus;
    valorMensal: number | null;
    updatedAt: string;
  }>;
};

const STATUS_OPTIONS = [
  { value: "NOVO", label: "Novo" },
  { value: "QUALIFICACAO", label: "Qualificação" },
  { value: "DIAGNOSTICO", label: "Diagnóstico" },
  { value: "PROPOSTA_ENVIADA", label: "Proposta enviada" },
  { value: "NEGOCIACAO", label: "Negociação" },
  { value: "GANHO", label: "Ganho" },
  { value: "PERDIDO", label: "Perdido" },
];

const PRIORIDADE_OPTIONS = [
  { value: "URGENTE", label: "Urgente" },
  { value: "ALTA", label: "Alta" },
  { value: "NORMAL", label: "Normal" },
  { value: "BAIXA", label: "Baixa" },
];

const PORTE_OPTIONS = [
  { value: "", label: "—" },
  { value: "SMALL", label: "Pequena" },
  { value: "MID", label: "Média" },
  { value: "LARGE", label: "Grande" },
];

const STATUS_COR: Record<LeadStatus, string> = {
  NOVO: "#9696A8",
  QUALIFICACAO: "#3B82F6",
  DIAGNOSTICO: "#7E30E1",
  PROPOSTA_ENVIADA: "#F59E0B",
  NEGOCIACAO: "#EC4899",
  GANHO: "#10B981",
  PERDIDO: "#EF4444",
};

const PROPOSTA_STATUS_COR: Record<PropostaStatus, string> = {
  RASCUNHO: "#9696A8",
  ENVIADA: "#3B82F6",
  VISTA: "#F59E0B",
  ACEITA: "#10B981",
  RECUSADA: "#EF4444",
  EXPIRADA: "#9696A8",
};

export function LeadSheet({
  leadId,
  open,
  onOpenChange,
  clientes,
  onConverter,
}: {
  leadId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientes: Array<{ id: string; nome: string; status: string }>;
  onConverter: (lead: LeadCard) => void;
}) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/leads/${leadId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao carregar");
        return r.json();
      })
      .then((data) => {
        setLead({
          ...data,
          valorEstimadoMensal: data.valorEstimadoMensal ? Number(data.valorEstimadoMensal) : null,
          proximaAcaoEm: data.proximaAcaoEm,
          convertidoEm: data.convertidoEm,
          totalPropostas: data.propostas?.length ?? 0,
          clienteNome: data.cliente?.nome ?? null,
          propostas: (data.propostas ?? []).map((p: { id: string; numero: string; titulo: string; status: PropostaStatus; valorMensal: string | number | null; updatedAt: string }) => ({
            ...p,
            valorMensal: p.valorMensal ? Number(p.valorMensal) : null,
            updatedAt: p.updatedAt,
          })),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [leadId, open]);

  async function patchLead(patch: Record<string, unknown>) {
    if (!leadId) return;
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setLead((l) =>
      l
        ? {
            ...l,
            ...updated,
            valorEstimadoMensal: updated.valorEstimadoMensal
              ? Number(updated.valorEstimadoMensal)
              : null,
          }
        : l
    );
  }

  async function excluir() {
    if (!leadId || !lead) return;
    if (!confirm(`Excluir o lead "${lead.empresa}"?`)) return;
    const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Lead excluído");
    onOpenChange(false);
    router.refresh();
  }

  const cor = lead ? STATUS_COR[lead.status] : "#7E30E1";
  const proxAcaoInput = lead?.proximaAcaoEm ? toLocalInput(lead.proximaAcaoEm) : "";
  const podeConverter = lead && !lead.clienteId && lead.status !== "PERDIDO";

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !lead}
      error={error}
      icone={TrendingUp}
      iconeCor={cor}
      titulo={lead?.empresa ?? "Carregando..."}
      subtitulo={
        lead && (
          <span className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
              {STATUS_OPTIONS.find((s) => s.value === lead.status)?.label ?? lead.status}
            </Badge>
            {lead.valorEstimadoMensal && (
              <span className="text-muted-foreground">
                ·{" "}
                <MoneyValue value={lead.valorEstimadoMensal} className="text-[11px] font-mono" />
                /mês est.
              </span>
            )}
            {lead.clienteNome && (
              <Link
                href={`/clientes/${lead.clienteId}`}
                className="inline-flex items-center gap-1 text-emerald-400 text-[11px] hover:underline"
              >
                · ✓ {lead.clienteNome}
              </Link>
            )}
          </span>
        )
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={excluir} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          {podeConverter && lead && (
            <Button
              size="sm"
              onClick={() => onConverter(lead)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Sparkles className="h-3.5 w-3.5" /> Converter em cliente
            </Button>
          )}
          {!podeConverter && (
            <span className="text-[10.5px] text-muted-foreground/70">Edição salva automaticamente</span>
          )}
        </>
      }
    >
      {lead && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InlineField
              type="text"
              label="Empresa"
              value={lead.empresa}
              onSave={(v) => patchLead({ empresa: v })}
              size="sm"
              className="col-span-2"
            />
            <InlineField
              type="select"
              label="Status"
              value={lead.status}
              options={STATUS_OPTIONS}
              onSave={(v) => patchLead({ status: v })}
              size="sm"
            />
            <InlineField
              type="select"
              label="Prioridade"
              value={lead.prioridade}
              options={PRIORIDADE_OPTIONS}
              onSave={(v) => patchLead({ prioridade: v })}
              size="sm"
            />
            <InlineField
              type="money"
              label="Valor estimado /mês"
              value={lead.valorEstimadoMensal ?? 0}
              onSave={(v) => patchLead({ valorEstimadoMensal: v === "" ? null : Number(v) })}
              size="sm"
            />
            <InlineField
              type="number"
              label="Duração (meses)"
              value={lead.duracaoEstimadaMeses ?? 0}
              onSave={(v) => patchLead({ duracaoEstimadaMeses: Number(v) || null })}
              step={1}
              size="sm"
            />
            <InlineField
              type="select"
              label="Porte"
              value={lead.porte ?? ""}
              options={PORTE_OPTIONS}
              onSave={(v) => patchLead({ porte: v || null })}
              size="sm"
            />
            <InlineField
              type="text"
              label="Segmento"
              value={lead.segmento ?? ""}
              onSave={(v) => patchLead({ segmento: v || null })}
              placeholder="Restaurante, SaaS B2B..."
              size="sm"
            />
            <InlineField
              type="text"
              label="Origem"
              value={lead.origem ?? ""}
              onSave={(v) => patchLead({ origem: v || null })}
              placeholder="Indicação, Google, Evento..."
              size="sm"
              className="col-span-2"
            />
          </div>

          {/* Lead score */}
          <LeadScoreCard lead={lead} onSetManual={(v) => patchLead({ scoreManual: v })} />

          {/* Contato */}
          <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              Contato
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InlineField
                type="text"
                label="Nome"
                value={lead.contatoNome ?? ""}
                onSave={(v) => patchLead({ contatoNome: v || null })}
                size="sm"
              />
              <InlineField
                type="tel"
                label="Telefone"
                value={lead.contatoTelefone ?? ""}
                onSave={(v) => patchLead({ contatoTelefone: v || null })}
                size="sm"
              />
              <InlineField
                type="email"
                label="Email"
                value={lead.contatoEmail ?? ""}
                onSave={(v) => patchLead({ contatoEmail: v || null })}
                size="sm"
                className="col-span-2"
              />
            </div>
            {/* Quick actions: ligar, mandar email */}
            <div className="flex gap-1.5">
              {lead.contatoTelefone && (
                <Button asChild variant="outline" size="sm" className="text-[11px] h-7">
                  <a href={`tel:${lead.contatoTelefone.replace(/\D/g, "")}`}>
                    <Phone className="h-3 w-3" /> Ligar
                  </a>
                </Button>
              )}
              {lead.contatoEmail && (
                <Button asChild variant="outline" size="sm" className="text-[11px] h-7">
                  <a href={`mailto:${lead.contatoEmail}?subject=Sobre ${encodeURIComponent(lead.empresa)}`}>
                    <Mail className="h-3 w-3" /> Email
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Próxima ação */}
          <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
              Próxima ação
            </div>
            <InlineField
              type="text"
              label="O que fazer"
              value={lead.proximaAcao ?? ""}
              onSave={(v) => patchLead({ proximaAcao: v || null })}
              placeholder="Ligar quinta-feira, mandar case..."
              size="sm"
            />
            <InlineField
              type="datetime-local"
              label="Quando"
              value={proxAcaoInput}
              onSave={(v) => patchLead({ proximaAcaoEm: v ? new Date(v).toISOString() : null })}
              size="sm"
            />
          </div>

          {/* Motivo perdido — só aparece se PERDIDO */}
          {lead.status === "PERDIDO" && (
            <InlineField
              type="textarea"
              label="Motivo da perda"
              value={lead.motivoPerdido ?? ""}
              onSave={(v) => patchLead({ motivoPerdido: v || null })}
              placeholder="Por que não rolou? (preço, timing, escolheu concorrente, etc)"
              rows={2}
            />
          )}

          {/* Notas rich text */}
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Notas e histórico
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <BlockEditor
                value={lead.notas ?? ""}
                onChange={(blocks: PartialBlock[]) => patchLead({ notas: JSON.stringify(blocks) })}
                placeholder="Reuniões, contexto, pendências, conversas, @ menciona entidades..."
                minHeight="120px"
              />
            </div>
          </div>

          {/* Propostas vinculadas */}
          {lead.propostas.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <FileSignature className="h-3 w-3" /> Propostas vinculadas ({lead.propostas.length})
              </div>
              <ul className="space-y-1">
                {lead.propostas.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/propostas/${p.id}`}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground/70 w-16 shrink-0">{p.numero}</span>
                      <span className="flex-1 text-[12px] truncate">{p.titulo}</span>
                      {p.valorMensal && (
                        <MoneyValue value={p.valorMensal} className="font-mono text-[10.5px] text-muted-foreground" />
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9.5px] shrink-0"
                        style={{ color: PROPOSTA_STATUS_COR[p.status], borderColor: `${PROPOSTA_STATUS_COR[p.status]}55` }}
                      >
                        {p.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </EntitySheet>
  );
}

/**
 * Card visual do lead score: número grande colorido por classe (alto/médio/baixo)
 * + breakdown calculado client-side (mesma lógica do server pra coerência) +
 * opção de override manual.
 *
 * Override manual: se Marcelo achar que o lead é mais quente do que o score
 * automático diz, define um número fixo. Pra voltar pro automático, clica
 * em "voltar ao auto".
 */
function LeadScoreCard({
  lead,
  onSetManual,
}: {
  lead: LeadFull;
  onSetManual: (v: number | null) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(lead.scoreManual ?? lead.score);

  // Recalcula client-side pra mostrar breakdown ao vivo (sem hit no server)
  const breakdown = useMemo(
    () =>
      calcularLeadScore({
        contatoEmail: lead.contatoEmail,
        contatoTelefone: lead.contatoTelefone,
        notas: lead.notas,
        valorEstimadoMensal: lead.valorEstimadoMensal,
        proximaAcaoEm: lead.proximaAcaoEm,
        status: lead.status,
        origem: lead.origem,
        updatedAt: lead.updatedAt,
      }),
    [lead]
  );

  const scoreFinal = lead.scoreManual ?? breakdown.total;
  const isManual = lead.scoreManual !== null && lead.scoreManual !== undefined;
  const classe = scoreFinal >= 70 ? "alto" : scoreFinal >= 40 ? "medio" : "baixo";
  const cor = classe === "alto" ? "#10B981" : classe === "medio" ? "#F59E0B" : "#9696A8";
  const classeLabel = classe === "alto" ? "Quente" : classe === "medio" ? "Morno" : "Frio";

  async function salvarManual() {
    await onSetManual(Math.max(0, Math.min(100, valor)));
    setEditando(false);
  }

  async function resetarAuto() {
    await onSetManual(null);
  }

  return (
    <div
      className="rounded-md border p-3 space-y-3"
      style={{ borderColor: `${cor}44`, background: `${cor}08` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5" style={{ color: cor }} />
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            Lead score
          </span>
          {isManual && (
            <span className="text-[9px] uppercase font-mono text-muted-foreground/70 bg-secondary px-1.5 py-0.5 rounded">
              manual
            </span>
          )}
        </div>
        {isManual && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1"
            onClick={resetarAuto}
            title="Voltar ao cálculo automático"
          >
            <RotateCcw className="h-2.5 w-2.5" /> auto
          </Button>
        )}
      </div>

      <div className="flex items-baseline gap-3">
        <span className="font-display text-[40px] font-bold tabular-nums leading-none" style={{ color: cor }}>
          {scoreFinal}
        </span>
        <div>
          <div className="text-[14px] font-semibold" style={{ color: cor }}>
            {classeLabel}
          </div>
          <div className="text-[10px] text-muted-foreground/70">de 100</div>
        </div>
        {!editando && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditando(true)}
            className="ml-auto h-6 text-[10px]"
          >
            ajustar
          </Button>
        )}
      </div>

      {editando && (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
            className="flex-1 accent-sal-600"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
            className="w-14 rounded border border-border bg-background px-1.5 py-1 text-[11px] font-mono text-center"
          />
          <Button size="sm" className="h-7 text-[10px]" onClick={salvarManual}>
            salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setEditando(false); setValor(lead.scoreManual ?? breakdown.total); }}>
            cancelar
          </Button>
        </div>
      )}

      {/* Breakdown — só mostra se NÃO está em modo manual (manual sobrescreve a lógica) */}
      {!isManual && breakdown.items.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-border/40">
          {breakdown.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-[10.5px]">
              <span className="text-muted-foreground truncate flex-1">
                {it.label}
                {it.detalhe && <span className="text-muted-foreground/60 ml-1">· {it.detalhe}</span>}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums shrink-0",
                  it.delta > 0 ? "text-emerald-400" : it.delta < 0 ? "text-rose-400" : "text-muted-foreground/60"
                )}
              >
                {it.delta > 0 ? "+" : ""}
                {it.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
