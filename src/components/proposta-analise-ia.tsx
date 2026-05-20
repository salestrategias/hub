"use client";
/**
 * Botão "Analisar IA" + dialog que mostra o peer review da proposta atual.
 *
 * Estado:
 *  - Sem análise: clica → abre wizard → gera nova análise
 *  - Com análise: botão tem badge da nota, clica → abre modal de view
 *    Botão "Regerar" no modal abre wizard de novo
 *
 * Mostra: nota geral (chip colorido), veredito, pontos fortes/fracos,
 * gaps de informação, sugestões de melhoria, risco de objeções.
 */
import { useState } from "react";
import {
  Sparkles,
  Brain,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Wrench,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { IaWizard } from "@/components/ia-wizard";
import { cn } from "@/lib/utils";

export type AnaliseProposta = {
  notaGeral: number;
  vereditoCurto: string;
  pontosFortes: string[];
  pontosFracos: string[];
  gapsInformacao: string[];
  sugestoesMelhoria: string[];
  riscoObjecoes: string[];
};

export function PropostaAnaliseIa({
  propostaId,
  analise,
  analiseEm,
}: {
  propostaId: string;
  analise: AnaliseProposta | null;
  analiseEm: string | null;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  // Cor da nota (0-4 vermelho, 5-7 amarelo, 8-10 verde)
  const corNota =
    !analise
      ? "text-muted-foreground"
      : analise.notaGeral >= 8
        ? "text-emerald-500 border-emerald-500/40 bg-emerald-500/10"
        : analise.notaGeral >= 5
          ? "text-amber-500 border-amber-500/40 bg-amber-500/10"
          : "text-rose-500 border-rose-500/40 bg-rose-500/10";

  const idadeDias = analiseEm
    ? Math.floor((Date.now() - new Date(analiseEm).getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <>
      {analise ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewOpen(true)}
          className={cn("gap-1.5", corNota)}
        >
          <Brain className="h-3.5 w-3.5" />
          Análise IA · {analise.notaGeral}/10
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWizardOpen(true)}
          className="text-amber-500 border-amber-500/40 hover:bg-amber-500/10"
        >
          <Brain className="h-3.5 w-3.5" /> Analisar IA
        </Button>
      )}

      {/* Modal de view da análise existente */}
      {analise && (
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Análise IA da proposta
              </DialogTitle>
              <DialogDescription>
                Peer review feito via Claude Max
                {idadeDias !== null && (
                  <span> · gerada há {idadeDias === 0 ? "menos de 1 dia" : `${idadeDias} ${idadeDias === 1 ? "dia" : "dias"}`}</span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Nota + veredito */}
              <div className={cn("rounded-md border px-4 py-3 flex items-center gap-4", corNota)}>
                <div className="text-3xl font-bold tabular-nums">{analise.notaGeral}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider font-semibold opacity-70">Nota geral</div>
                  <div className="text-sm font-medium leading-tight">{analise.vereditoCurto}</div>
                </div>
              </div>

              {/* Grid: pontos fortes vs fracos */}
              <div className="grid md:grid-cols-2 gap-3">
                <BlocoLista
                  titulo="Pontos fortes"
                  icon={<ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />}
                  itens={analise.pontosFortes}
                  vazioMsg="Nenhum identificado."
                  cor="emerald"
                />
                <BlocoLista
                  titulo="Pontos fracos"
                  icon={<ThumbsDown className="h-3.5 w-3.5 text-rose-500" />}
                  itens={analise.pontosFracos}
                  vazioMsg="Nenhum identificado."
                  cor="rose"
                />
              </div>

              {/* Gaps de informação */}
              <BlocoLista
                titulo="Gaps de informação"
                icon={<HelpCircle className="h-3.5 w-3.5 text-amber-500" />}
                itens={analise.gapsInformacao}
                vazioMsg="Sem gaps identificados."
                cor="amber"
              />

              {/* Sugestões de melhoria */}
              <BlocoLista
                titulo="Sugestões de melhoria"
                icon={<Wrench className="h-3.5 w-3.5 text-primary" />}
                itens={analise.sugestoesMelhoria}
                vazioMsg="Sem sugestões."
                cor="primary"
                numerado
              />

              {/* Riscos / objeções */}
              <BlocoLista
                titulo="Objeções esperadas + como responder"
                icon={<AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
                itens={analise.riscoObjecoes}
                vazioMsg="Sem objeções esperadas."
                cor="orange"
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  setViewOpen(false);
                  setWizardOpen(true);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regerar análise
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Wizard pra gerar/regerar */}
      <IaWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        prepararEndpoint={`/api/propostas/${propostaId}/preparar-analise-ia`}
        aplicarEndpoint={`/api/propostas/${propostaId}/aplicar-analise-ia`}
        title="Peer review da proposta"
        description="Claude vai atuar como senior comercial e revisar a proposta. Aponta o que tá bom, o que tá fraco, gaps e objeções esperadas."
        preReqMessage={
          <>
            <p>
              <strong>Como funciona:</strong> sistema envia ao Claude todo conteúdo da proposta
              atual (seções, valores, blocos extras) + contexto do cliente.
            </p>
            <p className="text-muted-foreground mt-1">
              Use ANTES de enviar pra cliente — pega problemas que passam batido na hora.
            </p>
          </>
        }
        exemploResposta='{"notaGeral": 8, "vereditoCurto": "...", "pontosFortes": [...], "pontosFracos": [...], "gapsInformacao": [...], "sugestoesMelhoria": [...], "riscoObjecoes": [...]}'
        renderResultado={() => <span>Análise gravada. A página vai recarregar e o botão mostrará a nota.</span>}
      />
    </>
  );
}

function BlocoLista({
  titulo,
  icon,
  itens,
  vazioMsg,
  cor,
  numerado,
}: {
  titulo: string;
  icon: React.ReactNode;
  itens: string[];
  vazioMsg: string;
  cor: "emerald" | "rose" | "amber" | "primary" | "orange";
  numerado?: boolean;
}) {
  const corClass = {
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    rose: "border-rose-500/20 bg-rose-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
    primary: "border-primary/20 bg-primary/5",
    orange: "border-orange-500/20 bg-orange-500/5",
  }[cor];

  return (
    <div className={cn("rounded-md border px-3 py-2.5", corClass)}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-2">
        {icon}
        {titulo} ({itens.length})
      </div>
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{vazioMsg}</p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((it, i) => (
            <li key={i} className="text-xs flex items-start gap-1.5 leading-relaxed">
              <span className="text-muted-foreground mt-0.5 font-mono shrink-0">
                {numerado ? `${i + 1}.` : "•"}
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
