/**
 * Catálogo + tipos das seções modulares do Diagnóstico estratégico.
 *
 * Espelha o espírito de `proposta-blocos.ts`, mas em vez de blocos fixos
 * o diagnóstico é um ARRAY ordenável/toggleável de seções. Marcelo liga,
 * desliga e reordena por cliente — e pode até adicionar seções custom.
 *
 * Cada seção:
 *  - `tipo`    — chave do catálogo (texto, "custom", ou bloco visual)
 *  - `titulo`  — editável (default vem do catálogo)
 *  - `conteudo`— JSON BlockNote serializado (seções de TEXTO). "" = vazia.
 *  - `dados`   — payload do bloco visual (seções ESTRUTURADAS). Json no banco.
 *  - `visivel` — toggle on/off na apresentação/PDF
 *  - `ordem`   — posição na renderização
 *
 * Dois tipos de seção:
 *  - TEXTO (capa, sumário, gargalos…): corpo em `conteudo`, ancoradas em
 *    `perguntasGuia`, preenchíveis pela IA.
 *  - BLOCO VISUAL (kpis, timeline, cases, garantias, equipe, faq, pacotes):
 *    reusam 100% a biblioteca da proposta (`proposta-blocos.ts`) — editor,
 *    render público e defaults. Corpo em `dados`. A IA NÃO toca neles.
 *
 * As `perguntasGuia` do catálogo têm DOIS usos:
 *  1. Checklist de qualidade no editor (Marcelo vê o que não pode faltar).
 *  2. Alimentam o prompt da IA (cada seção pede pra IA cobrir essas perguntas).
 *
 * Metodologia SAL embutida nas perguntas (ver memórias project_sal_*):
 *  - ancore em FALAS REAIS do cliente (cite a dor nas palavras dele);
 *  - ache a OPORTUNIDADE NÃO-ÓBVIA que ninguém apontou;
 *  - respeite a NUANCE DO SETOR (ex.: ética profissional na odonto);
 *  - VIRE o histórico ruim com agências em diferencial;
 *  - IA é facilitador/produtividade — estratégia é decisão humana;
 *  - SEO inclui GEO (aparecer em LLMs / AI Overview);
 *  - audiência: lojistas, negócios locais, e-commerces, marcas (NUNCA "PMEs").
 */

import {
  type BlocoKpis,
  type BlocoTimeline,
  type BlocoCases,
  type BlocoGarantias,
  type BlocoEquipe,
  type BlocoFaq,
  type BlocoPacotes,
  defaultKpis,
  defaultTimeline,
  defaultCases,
  defaultGarantias,
  defaultEquipe,
  defaultFaq,
  defaultPacotes,
} from "@/lib/proposta-blocos";

// ─── Tipos ────────────────────────────────────────────────────────────

/**
 * Tipos de seção de TEXTO (corpo em BlockNote, ancorado em `perguntasGuia`,
 * preenchível pela IA).
 */
export type SecaoTipoTexto =
  | "capa"
  | "sumarioExecutivo"
  | "contextoNegocio"
  | "presencaDigital"
  | "marcaPosicionamento"
  | "publicoJornada"
  | "concorrenciaMercado"
  | "gargalos"
  | "oportunidades"
  | "recomendacoesPlano"
  | "metasKpis"
  | "proximosPassos"
  | "custom";

/**
 * Tipos de BLOCO VISUAL estruturado — reusam 100% a biblioteca de blocos da
 * proposta (`proposta-blocos.ts`): editor, render público e defaults. O corpo
 * fica em `dados` (objeto do bloco), não em `conteudo`. A IA NÃO mexe neles.
 */
export type SecaoTipoEstruturado =
  | "kpis"
  | "timeline"
  | "cases"
  | "garantias"
  | "equipe"
  | "faq"
  | "pacotes";

export type SecaoTipo = SecaoTipoTexto | SecaoTipoEstruturado;

/** Payload estruturado de uma seção visual (espelha BlocoDados da proposta). */
export type SecaoDados =
  | BlocoKpis
  | BlocoTimeline
  | BlocoCases
  | BlocoGarantias
  | BlocoEquipe
  | BlocoFaq
  | BlocoPacotes;

export type DiagnosticoSecao = {
  id: string;
  tipo: SecaoTipo;
  titulo: string;
  /** JSON BlockNote serializado (seções de TEXTO). "" = vazia. */
  conteudo: string;
  /** Payload do bloco visual (seções ESTRUTURADAS). Json no banco. */
  dados?: SecaoDados;
  visivel: boolean;
  ordem: number;
};

export type CatalogoEntrada = {
  titulo: string;
  /** Placeholder no editor + descrição curta do propósito da seção. */
  placeholder: string;
  /** Nome do ícone lucide-react (mapeado pra componente no editor). */
  icone: string;
  visivelPorPadrao: boolean;
  /** Perguntas que a seção precisa responder — checklist + insumo da IA. */
  perguntasGuia: string[];
  /** Bloco visual estruturado (edita `dados`, não `conteudo`; IA ignora). */
  estruturado?: boolean;
  /** Factory do `dados` default (só nos estruturados). */
  defaultDados?: () => SecaoDados;
};

// ─── Catálogo (ordem = ordem default no diagnóstico) ──────────────────

export const CATALOGO_SECOES: Record<Exclude<SecaoTipoTexto, "custom">, CatalogoEntrada> = {
  capa: {
    titulo: "Identificação",
    placeholder:
      "Abertura do diagnóstico: cliente, segmento, praça e o momento do negócio numa frase.",
    icone: "FileText",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Nome do cliente/negócio, segmento e cidade/praça de atuação?",
      "Quem participou da reunião de diagnóstico e em que data?",
      "Uma frase que captura a essência do momento atual do negócio.",
    ],
  },
  sumarioExecutivo: {
    titulo: "Sumário Executivo",
    placeholder:
      "A leitura de 30 segundos: onde o negócio está, pra onde pode ir e o caminho central.",
    icone: "Sparkles",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Em 3-5 linhas: onde o negócio está hoje, pra onde pode ir e o caminho?",
      "Qual é a UMA grande oportunidade que este diagnóstico revela?",
      "Qual o principal gargalo/risco que trava o crescimento agora?",
    ],
  },
  contextoNegocio: {
    titulo: "Contexto do Negócio",
    placeholder:
      "Como o negócio funciona, o momento atual e o histórico com marketing — nas palavras do cliente.",
    icone: "Building2",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Modelo de negócio, ticket médio e capacidade de atendimento/produção?",
      "O que o cliente falou que mais importa pra ele? (cite as palavras dele)",
      "Histórico com marketing/agências — o que funcionou e o que frustrou?",
      "Momento atual: crescendo, estagnado, expandindo (unidade/serviço novo)?",
    ],
  },
  presencaDigital: {
    titulo: "Raio-X da Presença Digital",
    placeholder:
      "Diagnóstico técnico do que existe hoje: redes, Google, site, busca e gaps óbvios.",
    icone: "ScanSearch",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Como estão Instagram / Google / site hoje (frequência, qualidade, engajamento)?",
      "O negócio aparece quando buscam pelo serviço na região — no Google E em IA/LLMs (GEO)?",
      "Gaps técnicos óbvios (sem Google Meu Negócio, site sem SEO, perfil sem CTA)?",
      "O que a concorrência faz no digital que este negócio ainda não faz?",
    ],
  },
  marcaPosicionamento: {
    titulo: "Marca & Posicionamento",
    placeholder:
      "Como o negócio se vê vs. como o mercado o percebe — e o diferencial que vira posicionamento.",
    icone: "Gem",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Como o cliente se descreve vs. como o mercado o percebe?",
      "Qual o diferencial real (não-óbvio) que pode virar posicionamento?",
      "A comunicação atual reflete o nível/preço do serviço entregue?",
      "Tom de voz e identidade são consistentes entre canais?",
    ],
  },
  publicoJornada: {
    titulo: "Público & Jornada",
    placeholder:
      "Quem é o cliente ideal e como ele descobre, confia e decide — onde a jornada quebra.",
    icone: "Users",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Quem é o cliente ideal (perfil, dor, gatilho de compra)?",
      "Como ele descobre, considera e decide hoje?",
      "Onde a jornada quebra (descoberta, confiança ou conversão)?",
      "Há nuance do setor que muda a jornada (ética profissional, ticket alto, decisão longa)?",
    ],
  },
  concorrenciaMercado: {
    titulo: "Concorrência & Mercado",
    placeholder:
      "Quem disputa a mesma praça, como se posicionam e onde há espaço não-disputado.",
    icone: "Swords",
    visivelPorPadrao: false,
    perguntasGuia: [
      "Quem são os concorrentes diretos na praça e como se posicionam?",
      "Onde há espaço não-disputado (categoria, mensagem ou canal)?",
      "Tendências do setor/mercado local que abrem ou fecham janelas agora?",
    ],
  },
  gargalos: {
    titulo: "Gargalos & Travas",
    placeholder:
      "O que realmente trava o crescimento hoje — incluindo o que o cliente não enxerga.",
    icone: "AlertTriangle",
    visivelPorPadrao: true,
    perguntasGuia: [
      "O que TRAVA o crescimento hoje (operacional, comercial, digital)?",
      "Quais gargalos o cliente reconhece vs. quais ele não enxerga?",
      "O que precisa ser destravado ANTES de investir em mídia/conteúdo?",
    ],
  },
  oportunidades: {
    titulo: "Oportunidades",
    placeholder:
      "A oportunidade não-óbvia + quick wins vs. apostas estruturais.",
    icone: "Lightbulb",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Qual a oportunidade não-óbvia que ninguém apontou pra ele?",
      "Quick wins (30-60 dias) vs. apostas estruturais (6-12 meses)?",
      "Onde a IA pode acelerar execução (como facilitador, não substituto da estratégia)?",
    ],
  },
  recomendacoesPlano: {
    titulo: "Recomendações & Plano de Ação",
    placeholder:
      "As frentes recomendadas, em que ordem, e por que a SAL é diferente do histórico ruim.",
    icone: "Target",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Quais frentes (conteúdo, tráfego, SEO/GEO, marca, portal) e em que ordem?",
      "O que a SAL faz diferente do histórico ruim que o cliente teve com agências?",
      "Como o portal/plataforma própria da SAL entra como diferencial?",
      "Fases realistas — o que entra em cada uma?",
    ],
  },
  metasKpis: {
    titulo: "Metas & KPIs",
    placeholder:
      "Metas mensuráveis e os indicadores que o cliente vai conseguir acompanhar e cobrar.",
    icone: "Gauge",
    visivelPorPadrao: true,
    perguntasGuia: [
      "Que metas mensuráveis fazem sentido — e em que prazo?",
      "Quais KPIs o cliente vai conseguir acompanhar/cobrar de verdade?",
      "Baseline atual vs. meta — com números concretos quando possível.",
    ],
  },
  proximosPassos: {
    titulo: "Próximos Passos",
    placeholder:
      "O convite de ação claro: o que acontece depois deste diagnóstico.",
    icone: "Flag",
    visivelPorPadrao: true,
    perguntasGuia: [
      "O que acontece depois deste diagnóstico (apresentação, proposta, piloto)?",
      "Qual o convite de ação claro pro cliente?",
      "Prazo e formato do próximo encontro.",
    ],
  },
};

/**
 * Catálogo dos BLOCOS VISUAIS estruturados disponíveis no diagnóstico.
 *
 * Reusa a biblioteca da proposta (`proposta-blocos.ts`): mesmos tipos de dados,
 * mesmos `default*()` e os mesmos componentes de editor/render. Aqui só
 * registramos título + ícone + a factory de `dados` — a IA NUNCA toca neles
 * (não têm `perguntasGuia`).
 */
export const CATALOGO_BLOCOS: Record<SecaoTipoEstruturado, CatalogoEntrada> = {
  kpis: {
    titulo: "KPIs / Metas",
    placeholder: "Cards com metas em destaque (baseline → meta) — compromisso mensurável.",
    icone: "BarChart3",
    visivelPorPadrao: true,
    perguntasGuia: [],
    estruturado: true,
    defaultDados: () => ({ ...defaultKpis(), visivel: true }),
  },
  timeline: {
    titulo: "Cronograma",
    placeholder: "Marcos visuais com período + status (concluído / em andamento / pendente).",
    icone: "Calendar",
    visivelPorPadrao: true,
    perguntasGuia: [],
    estruturado: true,
    defaultDados: () => ({ ...defaultTimeline(), visivel: true }),
  },
  cases: {
    titulo: "Cases / Prova social",
    placeholder: "Grid de resultados de clientes anteriores — credibilidade.",
    icone: "Trophy",
    visivelPorPadrao: true,
    perguntasGuia: [],
    estruturado: true,
    defaultDados: () => ({ ...defaultCases(), visivel: true }),
  },
  garantias: {
    titulo: "Garantias",
    placeholder: "Selos de confiança (transparência, sem fidelidade, suporte).",
    icone: "ShieldCheck",
    visivelPorPadrao: true,
    perguntasGuia: [],
    estruturado: true,
    defaultDados: () => ({ ...defaultGarantias(), visivel: true }),
  },
  equipe: {
    titulo: "Equipe",
    placeholder: "Headshots + bios de quem vai cuidar do cliente — humaniza.",
    icone: "Users",
    visivelPorPadrao: true,
    perguntasGuia: [],
    estruturado: true,
    defaultDados: () => ({ ...defaultEquipe(), visivel: true }),
  },
  faq: {
    titulo: "FAQ",
    placeholder: "Perguntas frequentes — mata objeções.",
    icone: "HelpCircle",
    visivelPorPadrao: true,
    perguntasGuia: [],
    estruturado: true,
    defaultDados: () => ({ ...defaultFaq(), visivel: true }),
  },
  pacotes: {
    titulo: "Tabela de pacotes",
    placeholder: "Tabela comparativa de pacotes com features.",
    icone: "Package",
    visivelPorPadrao: true,
    perguntasGuia: [],
    estruturado: true,
    defaultDados: () => ({ ...defaultPacotes(), visivel: true }),
  },
};

/** Ordem canônica dos tipos de TEXTO (= ordem default no diagnóstico). */
export const ORDEM_CATALOGO: Array<Exclude<SecaoTipoTexto, "custom">> = [
  "capa",
  "sumarioExecutivo",
  "contextoNegocio",
  "presencaDigital",
  "marcaPosicionamento",
  "publicoJornada",
  "concorrenciaMercado",
  "gargalos",
  "oportunidades",
  "recomendacoesPlano",
  "metasKpis",
  "proximosPassos",
];

/** Ordem canônica dos blocos visuais no menu "Adicionar". */
export const ORDEM_BLOCOS: SecaoTipoEstruturado[] = [
  "kpis",
  "timeline",
  "cases",
  "garantias",
  "equipe",
  "faq",
  "pacotes",
];

/**
 * Uma seção é um bloco visual estruturado (edita `dados`, IA ignora)?
 * Aceita `string` (o tipo vem do banco como Json) e estreita pro literal.
 */
export function secaoEhEstruturada(tipo: SecaoTipo | string): tipo is SecaoTipoEstruturado {
  return tipo in CATALOGO_BLOCOS;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Gera ID único pra uma seção. */
export function gerarSecaoId(tipo: SecaoTipo): string {
  return `sec-${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Conjunto inicial de seções quando um diagnóstico é criado (template completo). */
export function defaultSecoes(): DiagnosticoSecao[] {
  return ORDEM_CATALOGO.map((tipo, i) => {
    const cat = CATALOGO_SECOES[tipo];
    return {
      id: gerarSecaoId(tipo),
      tipo,
      titulo: cat.titulo,
      conteudo: "",
      visivel: cat.visivelPorPadrao,
      ordem: i,
    };
  });
}

/** Metadados de catálogo de uma seção (perguntas-guia, ícone, placeholder). */
export function catalogoDe(tipo: SecaoTipo): CatalogoEntrada {
  if (secaoEhEstruturada(tipo)) {
    return CATALOGO_BLOCOS[tipo];
  }
  if (tipo === "custom" || !(tipo in CATALOGO_SECOES)) {
    return {
      titulo: "Seção personalizada",
      placeholder: "Conteúdo livre desta seção.",
      icone: "SquarePen",
      visivelPorPadrao: true,
      perguntasGuia: [],
    };
  }
  return CATALOGO_SECOES[tipo as Exclude<SecaoTipoTexto, "custom">];
}

/** `dados` default pra uma seção estruturada nova (vazio nos tipos de texto). */
export function defaultDadosDe(tipo: SecaoTipo): SecaoDados | undefined {
  return secaoEhEstruturada(tipo) ? CATALOGO_BLOCOS[tipo].defaultDados?.() : undefined;
}

/**
 * Garante shape válido mesmo se o DB tiver array antigo/parcial/null.
 * Usado no editor e na renderização pública. Reordena por `ordem`.
 */
export function normalizarSecoes(raw: unknown): DiagnosticoSecao[] {
  if (!Array.isArray(raw)) {
    return defaultSecoes();
  }
  const secoes = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s, i): DiagnosticoSecao => {
      const tipo = (typeof s.tipo === "string" ? s.tipo : "custom") as SecaoTipo;
      const estruturada = secaoEhEstruturada(tipo);
      return {
        id: typeof s.id === "string" && s.id ? s.id : gerarSecaoId(tipo),
        tipo,
        titulo:
          typeof s.titulo === "string" && s.titulo
            ? s.titulo
            : catalogoDe(tipo).titulo,
        conteudo: typeof s.conteudo === "string" ? s.conteudo : "",
        // Preserva o payload do bloco visual. Estruturada sem `dados` (criada
        // por algum caminho antigo) cai no default pra não quebrar o render.
        dados: estruturada
          ? ((s.dados as SecaoDados | undefined) ?? defaultDadosDe(tipo))
          : (s.dados as SecaoDados | undefined),
        visivel: typeof s.visivel === "boolean" ? s.visivel : true,
        ordem: typeof s.ordem === "number" ? s.ordem : i,
      };
    })
    .sort((a, b) => a.ordem - b.ordem)
    .map((s, i) => ({ ...s, ordem: i }));

  return secoes.length > 0 ? secoes : defaultSecoes();
}
