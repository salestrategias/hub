/**
 * Tipos + defaults dos blocos extras de proposta.
 *
 * Cada bloco tem:
 *  - `visivel` (toggle on/off da proposta — Marcelo decide caso a caso)
 *  - dados específicos do tipo
 *
 * Renderizam em posições fixas estratégicas na pública (definidas em
 * `proposta-publica.tsx`):
 *  - CASES → após Diagnóstico (prova social pra ganhar credibilidade)
 *  - KPIs → após Objetivo (visualiza metas SMART)
 *  - PACOTES → após Investimento (compara opções)
 *  - EQUIPE → antes do CTA (humaniza)
 *  - FAQ → antes do CTA (mata objeções de última hora)
 */

// ─── PACOTES (tabela comparativa) ─────────────────────────────────────

export type PacoteFeature = {
  texto: string;
  incluso: boolean; // ✓ ou —
  destaque?: boolean; // negrito + estrelinha
};

export type Pacote = {
  id: string;
  nome: string; // "Starter" / "Profissional" / "Premium"
  destaque?: boolean; // marca como "Recomendado"
  valor: string; // "R$ 2.500/mês" — string livre pra permitir variações
  subtitulo?: string; // "Pra começar" / "Mais escolhido" / "Tudo + custom"
  cta?: string; // "Quero esse" / "Falar com vendas"
  features: PacoteFeature[];
};

export type BlocoPacotes = {
  visivel: boolean;
  titulo: string; // "Escolha o pacote ideal"
  subtitulo?: string;
  pacotes: Pacote[];
};

export function defaultPacotes(): BlocoPacotes {
  return {
    visivel: false,
    titulo: "Escolha o pacote ideal pra você",
    subtitulo: "Comece pequeno, suba quando precisar.",
    pacotes: [
      {
        id: "starter",
        nome: "Starter",
        valor: "R$ 2.500/mês",
        subtitulo: "Pra começar",
        cta: "Quero o Starter",
        features: [
          { texto: "Calendário editorial 12 posts/mês", incluso: true },
          { texto: "Gestão de Instagram + Facebook", incluso: true },
          { texto: "Relatório mensal", incluso: true },
          { texto: "Tráfego pago", incluso: false },
          { texto: "SEO", incluso: false },
          { texto: "Reuniões mensais", incluso: true },
        ],
      },
      {
        id: "profissional",
        nome: "Profissional",
        destaque: true,
        valor: "R$ 5.000/mês",
        subtitulo: "Mais escolhido",
        cta: "Quero o Profissional",
        features: [
          { texto: "Calendário editorial 20 posts/mês", incluso: true, destaque: true },
          { texto: "Gestão de Instagram, Facebook + LinkedIn", incluso: true },
          { texto: "Relatório mensal + dashboard", incluso: true },
          { texto: "Tráfego pago Meta Ads", incluso: true, destaque: true },
          { texto: "SEO básico (4 keywords)", incluso: true },
          { texto: "Reuniões quinzenais", incluso: true },
        ],
      },
      {
        id: "premium",
        nome: "Premium",
        valor: "R$ 9.500/mês",
        subtitulo: "Tudo + customização",
        cta: "Quero o Premium",
        features: [
          { texto: "Calendário editorial ilimitado", incluso: true, destaque: true },
          { texto: "Todas as redes + YouTube + TikTok", incluso: true },
          { texto: "Dashboard executivo + alertas", incluso: true },
          { texto: "Tráfego pago Meta + Google Ads", incluso: true, destaque: true },
          { texto: "SEO completo (15 keywords + content marketing)", incluso: true, destaque: true },
          { texto: "Reuniões semanais + WhatsApp direto", incluso: true },
        ],
      },
    ],
  };
}

// ─── CASES (clientes anteriores) ──────────────────────────────────────

export type Case = {
  id: string;
  cliente: string; // "Galeria Chaves Barcellos"
  segmento?: string; // "Decoração / Mobiliário"
  resultado: string; // "+340% em vendas online em 6 meses"
  metricaPrincipal?: string; // "+340%" — destacado visualmente
  descricao?: string; // texto curto contextualizando
  logoUrl?: string; // logo do cliente (dataURL ou URL)
};

export type BlocoCases = {
  visivel: boolean;
  titulo: string;
  subtitulo?: string;
  cases: Case[];
};

export function defaultCases(): BlocoCases {
  return {
    visivel: false,
    titulo: "Resultados que já entregamos",
    subtitulo: "Clientes que confiaram na SAL e cresceram.",
    cases: [],
  };
}

// ─── KPIs (grid de metas / antes-depois) ──────────────────────────────

export type Kpi = {
  id: string;
  label: string; // "Conversões/mês"
  valorAtual?: string; // "120"
  valorMeta: string; // "400"
  variacao?: string; // "+233%"
  cor?: string; // hex pro destaque (default = cor primária)
};

export type BlocoKpis = {
  visivel: boolean;
  titulo: string;
  subtitulo?: string;
  kpis: Kpi[];
};

export function defaultKpis(): BlocoKpis {
  return {
    visivel: false,
    titulo: "Metas que vamos atingir",
    subtitulo: "Compromisso público — você cobra.",
    kpis: [],
  };
}

// ─── EQUIPE (headshots + bios) ────────────────────────────────────────

export type MembroEquipe = {
  id: string;
  nome: string;
  cargo: string; // "Estrategista de Marketing"
  bio?: string; // 2-3 linhas
  fotoUrl?: string; // dataURL ou URL externa
  linkedinUrl?: string;
};

export type BlocoEquipe = {
  visivel: boolean;
  titulo: string;
  subtitulo?: string;
  membros: MembroEquipe[];
};

export function defaultEquipe(): BlocoEquipe {
  return {
    visivel: false,
    titulo: "Quem vai cuidar de você",
    subtitulo: "Time dedicado — você sabe pra quem ligar.",
    membros: [],
  };
}

// ─── FAQ (perguntas frequentes) ───────────────────────────────────────

export type Faq = {
  id: string;
  pergunta: string;
  resposta: string;
};

export type BlocoFaq = {
  visivel: boolean;
  titulo: string;
  subtitulo?: string;
  perguntas: Faq[];
};

export function defaultFaq(): BlocoFaq {
  return {
    visivel: false,
    titulo: "Perguntas frequentes",
    subtitulo: "Antes de assinar, vale tirar dúvidas.",
    perguntas: [
      {
        id: "faq-1",
        pergunta: "Posso cancelar a qualquer momento?",
        resposta: "Sim. Avise com 30 dias de antecedência. Sem multa após o período mínimo de 3 meses.",
      },
      {
        id: "faq-2",
        pergunta: "Quanto tempo até ver resultado?",
        resposta: "Tráfego pago: 7-15 dias. SEO: 90 dias. Editorial: a partir do primeiro mês.",
      },
      {
        id: "faq-3",
        pergunta: "Vocês cuidam dos textos ou eu preciso escrever?",
        resposta: "A SAL escreve toda a copy. Você aprova via portal antes de publicar — sem trabalho seu além de validar.",
      },
    ],
  };
}

// ─── Bloco container ──────────────────────────────────────────────────

export type PropostaExtras = {
  pacotes?: BlocoPacotes;
  cases?: BlocoCases;
  kpis?: BlocoKpis;
  equipe?: BlocoEquipe;
  faq?: BlocoFaq;
};

/**
 * Garante shape válido mesmo se DB tiver objeto antigo / parcial / null.
 * Usado tanto no editor quanto na renderização pública.
 */
export function normalizarExtras(raw: unknown): PropostaExtras {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const r = raw as Record<string, unknown>;
  return {
    pacotes: r.pacotes ? (r.pacotes as BlocoPacotes) : undefined,
    cases: r.cases ? (r.cases as BlocoCases) : undefined,
    kpis: r.kpis ? (r.kpis as BlocoKpis) : undefined,
    equipe: r.equipe ? (r.equipe as BlocoEquipe) : undefined,
    faq: r.faq ? (r.faq as BlocoFaq) : undefined,
  };
}

/** Gera ID único pra um item dentro de um bloco (case, kpi, membro, etc). */
export function gerarBlocoItemId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
