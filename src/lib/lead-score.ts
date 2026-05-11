/**
 * Lead score automático 0-100. Replica lógica clássica de CRM (HubSpot
 * style): combina 8 dimensões em pesos somados, clampado em [0,100].
 *
 * Dimensões e pesos:
 *  - Email preenchido         → +12
 *  - Telefone preenchido      → +12
 *  - Notas substanciais (>100 chars) → +10
 *  - Valor estimado (escalonado): >= 5k → +20, >= 3k → +15, >= 1.5k → +8, < 1.5k → 0
 *  - Próxima ação agendada    → +10 (futura) ou -10 (atrasada >7d)
 *  - Estágio (escalado): NOVO=0, QUALIFICACAO=+5, DIAGNOSTICO=+12, PROPOSTA=+20, NEGOCIACAO=+25
 *  - Recência (último update): <3d=+10, <7d=+5, <14d=0, <30d=-5, >30d=-15
 *  - Origem com afinidade (indicação=+5, evento=+3, busca/google=0)
 *
 * Total típico: leads bem qualificados ficam 70-95. Leads frios <40.
 *
 * Retorna score + breakdown explicado pra mostrar em tooltip/UI.
 */

import type { LeadStatus } from "@prisma/client";

export type LeadScoreInput = {
  contatoEmail: string | null;
  contatoTelefone: string | null;
  notas: string | null;
  valorEstimadoMensal: number | null;
  proximaAcaoEm: Date | string | null;
  status: LeadStatus;
  origem: string | null;
  updatedAt: Date | string;
};

export type ScoreItem = {
  label: string;
  delta: number;
  detalhe?: string;
};

export type ScoreBreakdown = {
  total: number;
  items: ScoreItem[];
  classe: "alto" | "medio" | "baixo";
};

export function calcularLeadScore(input: LeadScoreInput): ScoreBreakdown {
  const items: ScoreItem[] = [];

  // Email
  if (input.contatoEmail && input.contatoEmail.trim()) {
    items.push({ label: "Email preenchido", delta: 12 });
  }

  // Telefone
  if (input.contatoTelefone && input.contatoTelefone.trim()) {
    items.push({ label: "Telefone preenchido", delta: 12 });
  }

  // Notas substanciais (mais que placeholder genérico)
  const notasLen = textoSemMarkup(input.notas);
  if (notasLen > 100) {
    items.push({ label: "Notas detalhadas", delta: 10, detalhe: `${notasLen} chars` });
  } else if (notasLen > 30) {
    items.push({ label: "Algumas notas", delta: 4 });
  }

  // Valor estimado
  const valor = input.valorEstimadoMensal ?? 0;
  if (valor >= 5000) {
    items.push({ label: "Alto ticket (≥ R$ 5k/mês)", delta: 20 });
  } else if (valor >= 3000) {
    items.push({ label: "Ticket bom (≥ R$ 3k/mês)", delta: 15 });
  } else if (valor >= 1500) {
    items.push({ label: "Ticket médio (≥ R$ 1.5k/mês)", delta: 8 });
  } else if (valor > 0) {
    items.push({ label: "Ticket baixo", delta: 0 });
  }

  // Próxima ação
  if (input.proximaAcaoEm) {
    const data = typeof input.proximaAcaoEm === "string" ? new Date(input.proximaAcaoEm) : input.proximaAcaoEm;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diasDe = Math.floor((data.getTime() - hoje.getTime()) / 86_400_000);
    if (diasDe >= 0) {
      items.push({ label: "Próxima ação agendada", delta: 10, detalhe: diasDe === 0 ? "hoje" : `em ${diasDe}d` });
    } else if (diasDe >= -7) {
      items.push({ label: "Ação atrasada", delta: -5, detalhe: `${-diasDe}d atraso` });
    } else {
      items.push({ label: "Ação muito atrasada", delta: -10, detalhe: `${-diasDe}d atraso` });
    }
  }

  // Estágio
  const ESTAGIO_DELTA: Record<LeadStatus, number> = {
    NOVO: 0,
    QUALIFICACAO: 5,
    DIAGNOSTICO: 12,
    PROPOSTA_ENVIADA: 20,
    NEGOCIACAO: 25,
    GANHO: 30,
    PERDIDO: -100, // perdidos sempre vão pra baixo
  };
  const deltaEstagio = ESTAGIO_DELTA[input.status];
  if (deltaEstagio !== 0) {
    items.push({
      label: `Estágio: ${estagioLabel(input.status)}`,
      delta: deltaEstagio,
    });
  }

  // Recência do update
  const updated = typeof input.updatedAt === "string" ? new Date(input.updatedAt) : input.updatedAt;
  const diasDesdeUpdate = Math.floor((Date.now() - updated.getTime()) / 86_400_000);
  if (diasDesdeUpdate < 3) {
    items.push({ label: "Atividade muito recente", delta: 10, detalhe: `<3d` });
  } else if (diasDesdeUpdate < 7) {
    items.push({ label: "Atividade recente", delta: 5, detalhe: `${diasDesdeUpdate}d` });
  } else if (diasDesdeUpdate >= 30) {
    items.push({ label: "Sem movimentação", delta: -15, detalhe: `>30d` });
  } else if (diasDesdeUpdate >= 14) {
    items.push({ label: "Atividade fria", delta: -5, detalhe: `${diasDesdeUpdate}d` });
  }

  // Origem com afinidade
  const origem = input.origem?.toLowerCase() ?? "";
  if (origem.includes("indica")) {
    items.push({ label: "Origem: indicação", delta: 5 });
  } else if (origem.includes("evento") || origem.includes("network")) {
    items.push({ label: "Origem: evento", delta: 3 });
  }

  // Soma e clampa
  const totalRaw = items.reduce((s, it) => s + it.delta, 0);
  const total = Math.max(0, Math.min(100, totalRaw));

  const classe: ScoreBreakdown["classe"] = total >= 70 ? "alto" : total >= 40 ? "medio" : "baixo";

  return { total, items, classe };
}

function textoSemMarkup(notas: string | null): number {
  if (!notas) return 0;
  const trimmed = notas.trim();
  if (!trimmed) return 0;
  // Se for JSON BlockNote, extrai texto plano
  if (trimmed.startsWith("[")) {
    try {
      const blocks = JSON.parse(trimmed) as Array<{ content?: unknown }>;
      let total = 0;
      for (const b of blocks) {
        const c = b.content;
        if (typeof c === "string") total += c.length;
        else if (Array.isArray(c)) {
          for (const seg of c) {
            if (typeof seg === "string") total += seg.length;
            else if (seg && typeof seg === "object" && "text" in seg && typeof (seg as { text: string }).text === "string") {
              total += (seg as { text: string }).text.length;
            }
          }
        }
      }
      return total;
    } catch {
      return trimmed.length;
    }
  }
  return trimmed.length;
}

function estagioLabel(s: LeadStatus): string {
  const map: Record<LeadStatus, string> = {
    NOVO: "Novo",
    QUALIFICACAO: "Qualificação",
    DIAGNOSTICO: "Diagnóstico",
    PROPOSTA_ENVIADA: "Proposta enviada",
    NEGOCIACAO: "Negociação",
    GANHO: "Ganho",
    PERDIDO: "Perdido",
  };
  return map[s];
}
