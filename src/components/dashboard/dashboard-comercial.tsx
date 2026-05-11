"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoneyValue } from "@/components/money-value";
import { TrendingUp, FileSignature, Target, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@prisma/client";

type DashboardComercialProps = {
  // Pipeline
  pipelineValor: number;
  pipelineCount: number;
  leadsPorStatus: Array<{ status: LeadStatus; count: number; valor: number }>;
  // Conversão
  taxaConversao: number; // 0..1
  ganhosTrimestre: number;
  ticketMedioGanho: number;
  tempoMedioFechamentoDias: number;
  // Propostas
  propostasAtivas: number;
  propostasAceitas30d: number;
  propostasRecusadas30d: number;
};

const COLUNAS: Array<{ key: LeadStatus; label: string; cor: string }> = [
  { key: "NOVO", label: "Novo", cor: "#9696A8" },
  { key: "QUALIFICACAO", label: "Qualif.", cor: "#3B82F6" },
  { key: "DIAGNOSTICO", label: "Diag.", cor: "#7E30E1" },
  { key: "PROPOSTA_ENVIADA", label: "Proposta", cor: "#F59E0B" },
  { key: "NEGOCIACAO", label: "Negoc.", cor: "#EC4899" },
];

export function DashboardComercial(props: DashboardComercialProps) {
  const maxValor = Math.max(...props.leadsPorStatus.map((s) => s.valor), 1);

  return (
    <div className="space-y-3 animate-slide-up" style={{ animationDelay: "180ms" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-semibold">Pipeline comercial</h2>
        </div>
        <Link href="/leads" className="text-[11px] text-sal-400 hover:underline inline-flex items-center gap-1">
          Abrir pipeline completo →
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-3">
        {/* KPIs principais */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Pipeline em aberto"
            valor={<MoneyValue value={props.pipelineValor} className="font-mono tracking-tight" />}
            hint={`${props.pipelineCount} ${props.pipelineCount === 1 ? "oportunidade" : "oportunidades"}`}
            cor="#7E30E1"
            icon={Target}
          />
          <KpiCard
            label="Taxa de conversão"
            valor={
              <span className="font-mono">
                {(props.taxaConversao * 100).toFixed(0)}<span className="text-base text-muted-foreground">%</span>
              </span>
            }
            hint={`${props.ganhosTrimestre} fechados no trimestre`}
            cor="#10B981"
            icon={TrendingUp}
          />
          <KpiCard
            label="Ticket médio (ganhos)"
            valor={<MoneyValue value={props.ticketMedioGanho} className="font-mono tracking-tight" />}
            hint="MRR contratado nos últimos ganhos"
            cor="#3B82F6"
            icon={MoneyIconReplacement}
          />
          <KpiCard
            label="Tempo médio fechar"
            valor={
              <span className="font-mono">
                {props.tempoMedioFechamentoDias}<span className="text-base text-muted-foreground"> dias</span>
              </span>
            }
            hint="Do primeiro contato ao aceite"
            cor="#F59E0B"
            icon={Clock}
          />
        </div>

        {/* Mini funil — barras horizontais por estágio */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Funil por estágio
              </span>
            </div>
            <div className="space-y-1.5">
              {COLUNAS.map((col) => {
                const dado = props.leadsPorStatus.find((s) => s.status === col.key);
                const count = dado?.count ?? 0;
                const valor = dado?.valor ?? 0;
                const pct = (valor / maxValor) * 100;
                return (
                  <div key={col.key}>
                    <div className="flex items-center justify-between text-[10.5px] mb-0.5">
                      <span className="text-muted-foreground">{col.label}</span>
                      <span className="font-mono tabular-nums">
                        <span className="text-muted-foreground/70">{count}</span>
                        {valor > 0 && (
                          <>
                            <span className="text-muted-foreground/40 mx-1">·</span>
                            <MoneyValue value={valor} className="font-mono text-[10.5px]" />
                          </>
                        )}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: col.cor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <Link
              href="/leads"
              className="text-[10.5px] text-sal-400 hover:underline inline-flex items-center gap-1 pt-1 border-t border-border/40"
            >
              Ver kanban completo →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Status de propostas */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileSignature className="h-3.5 w-3.5 text-sal-400" />
              <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Propostas
              </span>
            </div>
            <Link
              href="/propostas"
              className="text-[10.5px] text-sal-400 hover:underline inline-flex items-center gap-1"
            >
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatChip
              label="Ativas (aguardando)"
              valor={props.propostasAtivas}
              cor="#3B82F6"
            />
            <StatChip
              label="Aceitas (30d)"
              valor={props.propostasAceitas30d}
              cor="#10B981"
            />
            <StatChip
              label="Recusadas (30d)"
              valor={props.propostasRecusadas30d}
              cor="#EF4444"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  valor,
  hint,
  cor,
  icon: Icon,
}: {
  label: string;
  valor: React.ReactNode;
  hint: string;
  cor: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card
      className="relative overflow-hidden"
      style={{ boxShadow: `0 0 0 1px ${cor}33, 0 8px 24px ${cor}0F` }}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: `${cor}1F`, color: cor }}
          >
            <Icon className="h-3 w-3" />
          </div>
        </div>
        <div className="text-[22px] font-semibold tracking-tight font-display leading-none">{valor}</div>
        <div className="text-[10.5px] text-muted-foreground/80 mt-1.5">{hint}</div>
      </CardContent>
    </Card>
  );
}

function StatChip({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div
      className="rounded-md p-3 border"
      style={{ borderColor: `${cor}33`, background: `${cor}0A` }}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-[20px] font-display font-semibold tabular-nums mt-1" style={{ color: cor }}>
        {valor}
      </div>
    </div>
  );
}

// Substitui o Banknote que não importei pra economizar
function MoneyIconReplacement({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn(className)}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}
