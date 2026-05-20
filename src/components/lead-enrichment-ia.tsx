"use client";
/**
 * Card de Enrichment IA pro lead-sheet.
 *
 * Estado vazio: CTA "Qualificar com IA"
 * Estado preenchido: chip de categoria + score + ICP fit + abordagem +
 *                    perguntas pra qualificar + justificativa
 *
 * Mesmo padrão de BriefingIaCard / PropostaAnaliseIa.
 */
import { useState } from "react";
import {
  Brain,
  RefreshCw,
  Target,
  MessageCircle,
  CheckSquare,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IaWizard } from "@/components/ia-wizard";
import { cn } from "@/lib/utils";

export type LeadEnrichment = {
  qualidade: number;
  categoria: "QUENTE" | "MORNO" | "FRIO" | "DESQUALIFICADO";
  icpFit: string;
  segmentoSugerido: string;
  abordagemSugerida: string;
  perguntasQualificacao: string[];
  justificativa: string;
};

const CATEGORIA_COR: Record<LeadEnrichment["categoria"], { bg: string; text: string; border: string }> = {
  QUENTE: { bg: "bg-rose-500/15", text: "text-rose-500", border: "border-rose-500/40" },
  MORNO: { bg: "bg-amber-500/15", text: "text-amber-500", border: "border-amber-500/40" },
  FRIO: { bg: "bg-sky-500/15", text: "text-sky-500", border: "border-sky-500/40" },
  DESQUALIFICADO: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
};

export function LeadEnrichmentIa({
  leadId,
  enrichment,
  enrichmentEm,
  onApplied,
}: {
  leadId: string;
  enrichment: LeadEnrichment | null;
  enrichmentEm: string | null;
  onApplied: () => void;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);

  const idadeDias = enrichmentEm
    ? Math.floor((Date.now() - new Date(enrichmentEm).getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const wizardProps = {
    open: wizardOpen,
    onOpenChange: setWizardOpen,
    prepararEndpoint: `/api/leads/${leadId}/preparar-enrichment-ia`,
    aplicarEndpoint: `/api/leads/${leadId}/aplicar-enrichment-ia`,
    title: "Qualificar lead com IA",
    description:
      "Claude vai avaliar fit com ICP da SAL, sugerir categoria (quente/morno/frio), score 0-100 e abordagem inicial.",
    preReqMessage: (
      <>
        <p>
          <strong>O que entra no prompt:</strong> empresa, contato, segmento, origem, valor estimado,
          notas internas, histórico de propostas, ICP da SAL.
        </p>
        <p className="text-muted-foreground mt-1">
          Use pra priorizar follow-up — leads quentes primeiro, frios podem ir pra automação.
        </p>
      </>
    ),
    exemploResposta:
      '{"qualidade": 75, "categoria": "MORNO", "icpFit": "...", "segmentoSugerido": "...", "abordagemSugerida": "...", "perguntasQualificacao": [...], "justificativa": "..."}',
    onSuccess: onApplied,
    refreshOnSuccess: false,
    renderResultado: () => (
      <span>Lead qualificado — score e enrichment aplicados. Recarregue pra ver tudo.</span>
    ),
  };

  // ─── Estado vazio ──────────────────────────────────────────────
  if (!enrichment) {
    return (
      <>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">Qualificar lead com IA</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Score 0-100, categoria quente/morno/frio, ICP fit + abordagem sugerida.
              </div>
            </div>
            <Button onClick={() => setWizardOpen(true)} size="sm" className="shrink-0">
              <Brain className="h-3.5 w-3.5" /> Qualificar IA
            </Button>
          </CardContent>
        </Card>
        <IaWizard {...wizardProps} />
      </>
    );
  }

  // ─── Estado preenchido ─────────────────────────────────────────
  const cor = CATEGORIA_COR[enrichment.categoria];

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1.5 text-[10.5px]">
                <Brain className="h-3 w-3 text-primary" />
                IA QUALIFICOU
              </Badge>
              <Badge
                variant="outline"
                className={cn("gap-1.5 text-[10.5px] font-bold", cor.bg, cor.text, cor.border)}
              >
                <Activity className="h-3 w-3" />
                {enrichment.categoria}
              </Badge>
              <span className={cn("text-sm font-mono font-bold tabular-nums", cor.text)}>
                {enrichment.qualidade}/100
              </span>
              {idadeDias !== null && (
                <span className="text-[10.5px] text-muted-foreground">
                  · há{" "}
                  {idadeDias === 0 ? "menos de 1 dia" : `${idadeDias} ${idadeDias === 1 ? "dia" : "dias"}`}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)} className="shrink-0">
              <RefreshCw className="h-3 w-3" /> Regerar
            </Button>
          </div>

          {/* ICP fit + segmento sugerido */}
          <div className="grid sm:grid-cols-[1fr_auto] gap-2 text-xs">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5 flex items-center gap-1">
                <Target className="h-3 w-3" /> ICP Fit
              </div>
              <div className="text-foreground leading-snug">{enrichment.icpFit}</div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 sm:min-w-[160px]">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                Segmento sugerido
              </div>
              <div className="text-foreground font-semibold">{enrichment.segmentoSugerido}</div>
            </div>
          </div>

          {/* Abordagem sugerida */}
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1 flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> Abordagem sugerida
            </div>
            <div className="leading-relaxed">{enrichment.abordagemSugerida}</div>
          </div>

          {/* Perguntas de qualificação */}
          {enrichment.perguntasQualificacao.length > 0 && (
            <div className="rounded-md border border-border px-3 py-2 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                <CheckSquare className="h-3 w-3" /> Perguntas pra qualificar antes da proposta
              </div>
              <ul className="space-y-1">
                {enrichment.perguntasQualificacao.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-muted-foreground mt-0.5 font-mono shrink-0">{i + 1}.</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Justificativa do score */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition">
              Justificativa do score
            </summary>
            <div className="mt-1.5 text-foreground leading-relaxed pl-3 border-l-2 border-border">
              {enrichment.justificativa}
            </div>
          </details>
        </CardContent>
      </Card>

      <IaWizard {...wizardProps} />
    </>
  );
}
