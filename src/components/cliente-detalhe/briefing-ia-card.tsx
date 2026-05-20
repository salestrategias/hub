"use client";
/**
 * Card de Briefing IA no topo da página do cliente.
 *
 * Estados:
 *  - Sem briefing: mostra placeholder com CTA "Gerar briefing"
 *  - Com briefing: mostra resumo + pontos atenção + próximas ações + risco churn
 *                  + timestamp "atualizado há X dias" + botão "Regerar"
 *
 * Usa <IaWizard> genérico — mesmo padrão de proposta-editor e reuniao-detalhe.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, AlertTriangle, ArrowRight, Activity } from "lucide-react";
import { IaWizard } from "@/components/ia-wizard";
import { cn } from "@/lib/utils";

export type Briefing = {
  resumo: string;
  pontosAtencao: string[];
  proximasAcoes: string[];
  riscoChurn: string;
};

export function BriefingIaCard({
  clienteId,
  clienteNome,
  briefing,
  briefingEm,
}: {
  clienteId: string;
  clienteNome: string;
  briefing: Briefing | null;
  briefingEm: string | null;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);

  // "Idade" do briefing pra avisar quando tá velho (>7 dias)
  const idadeDias = briefingEm
    ? Math.floor((Date.now() - new Date(briefingEm).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const velho = idadeDias !== null && idadeDias > 7;

  // Cor do risco de churn (extrai categoria do começo da string)
  const riscoUpper = briefing?.riscoChurn.toUpperCase() ?? "";
  const riscoCor = riscoUpper.startsWith("ALTO")
    ? { bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/30", label: "ALTO" }
    : riscoUpper.startsWith("MÉDIO") || riscoUpper.startsWith("MEDIO")
      ? { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30", label: "MÉDIO" }
      : riscoUpper.startsWith("BAIXO")
        ? { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30", label: "BAIXO" }
        : { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: "—" };

  const wizardProps = {
    open: wizardOpen,
    onOpenChange: setWizardOpen,
    prepararEndpoint: `/api/clientes/${clienteId}/preparar-briefing-ia`,
    aplicarEndpoint: `/api/clientes/${clienteId}/aplicar-briefing-ia`,
    title: `Briefing executivo de ${clienteNome}`,
    description:
      "Sistema coleta dados (reuniões, tarefas, propostas, financeiro, posts) e monta o prompt. Você cola no Claude, traz a resposta JSON e o briefing fica visível aqui.",
    preReqMessage: (
      <>
        <p>
          <strong>Como funciona:</strong> Hub puxa todo o contexto do cliente, monta um prompt
          completo e te dá pra colar no Claude Desktop/Web. Claude devolve um JSON estruturado.
        </p>
        <p className="text-muted-foreground mt-1">
          O briefing fica salvo aqui e pode ser regerado quando quiser (1 clique).
        </p>
      </>
    ),
    exemploResposta:
      '{"resumo": "...", "pontosAtencao": [...], "proximasAcoes": [...], "riscoChurn": "..."}',
    renderResultado: () => (
      <span>
        Briefing aplicado. Carrega a página pra ver atualizado.
      </span>
    ),
  };

  // ─── Estado vazio: ainda não foi gerado ──────────────────────
  if (!briefing) {
    return (
      <>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Gerar briefing executivo deste cliente</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                IA resume status, alertas e próximas ações em 30 segundos de leitura.
                Zero custo (usa teu Claude Max).
              </div>
            </div>
            <Button onClick={() => setWizardOpen(true)} className="shrink-0">
              <Sparkles className="h-3.5 w-3.5" /> Gerar briefing
            </Button>
          </CardContent>
        </Card>
        <IaWizard {...wizardProps} />
      </>
    );
  }

  // ─── Estado com briefing ──────────────────────────────────────
  return (
    <>
      <Card>
        <CardContent className="p-5 space-y-4">
          {/* Header: badge IA + risco churn + ações */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1.5 text-[10.5px]">
                <Sparkles className="h-3 w-3 text-primary" />
                BRIEFING IA
              </Badge>
              <Badge
                variant="outline"
                className={cn("gap-1.5 text-[10.5px]", riscoCor.bg, riscoCor.text, riscoCor.border)}
              >
                <Activity className="h-3 w-3" />
                Risco churn: {riscoCor.label}
              </Badge>
              {idadeDias !== null && (
                <span
                  className={cn(
                    "text-[10.5px]",
                    velho ? "text-amber-500" : "text-muted-foreground"
                  )}
                >
                  Atualizado há{" "}
                  {idadeDias === 0 ? "hoje" : `${idadeDias} ${idadeDias === 1 ? "dia" : "dias"}`}
                  {velho && " — pode estar desatualizado"}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWizardOpen(true)}
              className="shrink-0"
            >
              <RefreshCw className="h-3 w-3" /> Regerar
            </Button>
          </div>

          {/* Resumo */}
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
            {briefing.resumo}
          </div>

          {/* Risco churn detalhado */}
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-xs",
              riscoCor.bg,
              riscoCor.border,
              riscoCor.text
            )}
          >
            <span className="font-semibold">Risco de churn:</span> {briefing.riscoChurn}
          </div>

          {/* Grid: pontos de atenção + próximas ações */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Pontos de atenção */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Pontos de atenção ({briefing.pontosAtencao.length})
              </div>
              {briefing.pontosAtencao.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nada urgente identificado.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {briefing.pontosAtencao.map((p, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">⚠</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Próximas ações */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <ArrowRight className="h-3 w-3 text-primary" />
                Próximas ações ({briefing.proximasAcoes.length})
              </div>
              {briefing.proximasAcoes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Sem ações sugeridas pela IA.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {briefing.proximasAcoes.map((a, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <span className="text-primary mt-0.5 font-mono">{i + 1}.</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <IaWizard {...wizardProps} />
    </>
  );
}
