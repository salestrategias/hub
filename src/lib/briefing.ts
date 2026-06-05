/**
 * Briefings — catálogo de tipos de pergunta + templates padrão por serviço.
 *
 * Os templates padrão vivem aqui (código), no espírito de `diagnostico-secoes.ts`.
 * Ao criar um briefing, copiamos as perguntas do template pro `Briefing.perguntas`
 * (snapshot editável), então editar um template não muda briefings já enviados.
 * Templates customizados salvos ficam em `BriefingTemplate` (banco).
 */

export type BriefingTipoPergunta =
  | "TEXTO" // resposta curta
  | "PARAGRAFO" // texto longo
  | "ESCOLHA" // 1 opção (radio)
  | "CAIXAS" // várias opções (checkbox)
  | "LISTA" // dropdown
  | "NUMERO"
  | "DATA"
  | "LINK" // URL
  | "SIM_NAO"
  | "UPLOAD"; // arquivo (logo, refs, manual de marca)

export type BriefingPergunta = {
  id: string;
  pergunta: string;
  tipo: BriefingTipoPergunta;
  opcoes?: string[]; // ESCOLHA | CAIXAS | LISTA
  obrigatoria?: boolean;
  ajuda?: string; // texto de apoio abaixo da pergunta
  secao?: string; // agrupamento visual
};

export type BriefingTemplatePadrao = {
  slug: string;
  nome: string;
  tipoServico: "COMPLETO" | "REDES" | "TRAFEGO" | "SEO" | "BRANDING";
  descricao: string;
  perguntas: BriefingPergunta[];
};

/** Metadados dos tipos pro editor (label + se tem opções). */
export const TIPOS_PERGUNTA: {
  tipo: BriefingTipoPergunta;
  label: string;
  temOpcoes: boolean;
}[] = [
  { tipo: "TEXTO", label: "Resposta curta", temOpcoes: false },
  { tipo: "PARAGRAFO", label: "Parágrafo", temOpcoes: false },
  { tipo: "ESCOLHA", label: "Múltipla escolha (uma)", temOpcoes: true },
  { tipo: "CAIXAS", label: "Caixas de seleção (várias)", temOpcoes: true },
  { tipo: "LISTA", label: "Lista suspensa", temOpcoes: true },
  { tipo: "NUMERO", label: "Número", temOpcoes: false },
  { tipo: "DATA", label: "Data", temOpcoes: false },
  { tipo: "LINK", label: "Link (URL)", temOpcoes: false },
  { tipo: "SIM_NAO", label: "Sim / Não", temOpcoes: false },
  { tipo: "UPLOAD", label: "Upload de arquivo", temOpcoes: false },
];

export function tipoTemOpcoes(t: BriefingTipoPergunta): boolean {
  return t === "ESCOLHA" || t === "CAIXAS" || t === "LISTA";
}

/** ID estável p/ perguntas novas criadas no editor. */
export function novaPerguntaId(): string {
  return "q_" + Math.random().toString(36).slice(2, 10);
}

// helper interno pra montar as perguntas dos templates de forma enxuta
function q(
  id: string,
  pergunta: string,
  tipo: BriefingTipoPergunta,
  extra: Omit<BriefingPergunta, "id" | "pergunta" | "tipo"> = {}
): BriefingPergunta {
  return { id, pergunta, tipo, ...extra };
}

// ─── Blocos reutilizados entre templates ────────────────────────────────
const BLOCO_EMPRESA: BriefingPergunta[] = [
  q("empresa_nome", "Nome da empresa / marca", "TEXTO", { secao: "Empresa", obrigatoria: true }),
  q("empresa_segmento", "Segmento / ramo de atuação", "TEXTO", { secao: "Empresa", obrigatoria: true }),
  q("empresa_tempo", "Há quanto tempo está no mercado?", "TEXTO", { secao: "Empresa" }),
  q("empresa_local", "Cidade(s) / região de atuação", "TEXTO", { secao: "Empresa" }),
  q("empresa_site", "Site (se tiver)", "LINK", { secao: "Empresa" }),
  q("empresa_redes", "Links das redes sociais (Instagram, Facebook, etc.)", "PARAGRAFO", { secao: "Empresa" }),
  q("empresa_produtos", "Principais produtos / serviços que vende", "PARAGRAFO", { secao: "Empresa", obrigatoria: true }),
  q("empresa_ticket", "Ticket médio (valor médio de venda)", "TEXTO", { secao: "Empresa" }),
];

const BLOCO_PUBLICO: BriefingPergunta[] = [
  q("publico_ideal", "Quem é o seu cliente ideal? (idade, perfil, hábitos)", "PARAGRAFO", { secao: "Público", obrigatoria: true }),
  q("publico_dores", "Quais dores / desejos esse cliente tem?", "PARAGRAFO", { secao: "Público" }),
  q("publico_regiao", "De onde vêm seus clientes? (bairro, cidade, online)", "TEXTO", { secao: "Público" }),
];

const BLOCO_CONCORRENCIA: BriefingPergunta[] = [
  q("conc_quem", "Principais concorrentes (nomes e/ou links)", "PARAGRAFO", { secao: "Mercado & Concorrência" }),
  q("conc_admira", "O que você admira na comunicação de algum concorrente / marca?", "PARAGRAFO", { secao: "Mercado & Concorrência" }),
  q("conc_evitar", "O que você NÃO quer parecer / quer evitar?", "PARAGRAFO", { secao: "Mercado & Concorrência" }),
];

// ─── Templates padrão ───────────────────────────────────────────────────
export const TEMPLATES_PADRAO: BriefingTemplatePadrao[] = [
  // 1) COMPLETO — engloba tudo
  {
    slug: "completo",
    nome: "Briefing Completo (empresa + marca)",
    tipoServico: "COMPLETO",
    descricao: "Visão 360° da empresa e da marca — base pra qualquer serviço da SAL.",
    perguntas: [
      ...BLOCO_EMPRESA,
      q("marca_proposito", "Qual o propósito / missão da empresa? Por que ela existe?", "PARAGRAFO", { secao: "Marca & Posicionamento" }),
      q("marca_valores", "Quais valores guiam o negócio?", "PARAGRAFO", { secao: "Marca & Posicionamento" }),
      q("marca_diferencial", "Por que um cliente deve escolher você e não o concorrente?", "PARAGRAFO", { secao: "Marca & Posicionamento", obrigatoria: true }),
      q("marca_tom", "Como a marca deve soar? (ex.: próxima/divertida, séria/técnica, sofisticada)", "PARAGRAFO", { secao: "Marca & Posicionamento" }),
      q("marca_identidade", "Já tem identidade visual? (logo, cores, manual de marca)", "SIM_NAO", { secao: "Marca & Posicionamento" }),
      q("marca_identidade_arquivo", "Se tiver, anexe logo / manual / referências da marca", "UPLOAD", { secao: "Marca & Posicionamento" }),
      ...BLOCO_PUBLICO,
      ...BLOCO_CONCORRENCIA,
      q("mkt_historico", "O que já fez de marketing? O que funcionou e o que não funcionou?", "PARAGRAFO", { secao: "Marketing & Objetivos" }),
      q("mkt_objetivo", "Qual o principal objetivo nos próximos 6 meses?", "PARAGRAFO", { secao: "Marketing & Objetivos", obrigatoria: true }),
      q("mkt_metas", "Tem metas claras? (faturamento, leads, seguidores, etc.)", "PARAGRAFO", { secao: "Marketing & Objetivos" }),
      q("op_aprova", "Quem aprova os conteúdos / decisões pelo seu lado?", "TEXTO", { secao: "Operacional" }),
      q("op_proibido", "Tem algo que NÃO pode ser falado / mostrado? (restrições)", "PARAGRAFO", { secao: "Operacional" }),
      q("op_materiais", "Que materiais você já tem? (fotos, vídeos, textos)", "PARAGRAFO", { secao: "Operacional" }),
      q("op_datas", "Datas / campanhas importantes no calendário do negócio", "PARAGRAFO", { secao: "Operacional" }),
    ],
  },

  // 2) REDES SOCIAIS
  {
    slug: "redes",
    nome: "Briefing — Gestão de Redes Sociais",
    tipoServico: "REDES",
    descricao: "Tudo pra planejar e produzir o conteúdo das redes do cliente.",
    perguntas: [
      q("rs_redes", "Quais redes você usa hoje? (cole os links)", "PARAGRAFO", { secao: "Canais", obrigatoria: true }),
      q("rs_foco", "Em quais redes quer focar?", "CAIXAS", { secao: "Canais", opcoes: ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube"] }),
      q("rs_frequencia", "Frequência desejada de posts (por semana)", "TEXTO", { secao: "Canais" }),
      q("rs_objetivo", "Objetivo principal das redes", "ESCOLHA", { secao: "Conteúdo", opcoes: ["Vendas", "Autoridade / posicionamento", "Engajamento / comunidade", "Atendimento", "Misto"] }),
      q("rs_temas", "Temas / assuntos que quer abordar", "PARAGRAFO", { secao: "Conteúdo" }),
      q("rs_nao", "O que NÃO pode ou não quer falar", "PARAGRAFO", { secao: "Conteúdo" }),
      q("rs_tom", "Tom de voz desejado (ex.: descontraído, técnico, acolhedor)", "TEXTO", { secao: "Conteúdo" }),
      q("rs_referencias", "Perfis que você admira / quer se inspirar (links)", "PARAGRAFO", { secao: "Conteúdo" }),
      q("rs_concorrentes", "Concorrentes nas redes (links)", "PARAGRAFO", { secao: "Conteúdo" }),
      q("rs_identidade", "Tem identidade visual / manual de marca?", "SIM_NAO", { secao: "Identidade" }),
      q("rs_identidade_arq", "Anexe logo, cores, fontes ou manual (se tiver)", "UPLOAD", { secao: "Identidade" }),
      q("rs_acervo", "Tem fotos / vídeos próprios pra usar? Como nos envia?", "PARAGRAFO", { secao: "Identidade" }),
      q("rs_cta", "Para onde mandar as pessoas? (WhatsApp, site, loja...)", "TEXTO", { secao: "Operacional" }),
      q("rs_aprova", "Quem aprova os conteúdos pelo seu lado?", "TEXTO", { secao: "Operacional" }),
      q("rs_datas", "Promoções, lançamentos ou datas importantes próximas", "PARAGRAFO", { secao: "Operacional" }),
    ],
  },

  // 3) TRÁFEGO PAGO
  {
    slug: "trafego",
    nome: "Briefing — Tráfego Pago",
    tipoServico: "TRAFEGO",
    descricao: "Pra estruturar campanhas de mídia paga (Meta, Google, etc.).",
    perguntas: [
      q("tp_objetivo", "Qual o principal resultado que você quer?", "ESCOLHA", { secao: "Objetivo & Oferta", obrigatoria: true, opcoes: ["Gerar leads", "Vendas online", "Agendamentos", "Visitas à loja", "Alcance / reconhecimento"] }),
      q("tp_oferta", "Qual produto / serviço / oferta vamos promover?", "PARAGRAFO", { secao: "Objetivo & Oferta", obrigatoria: true }),
      q("tp_ticket", "Ticket médio e margem (quanto sobra por venda)", "TEXTO", { secao: "Objetivo & Oferta" }),
      q("tp_publico", "Quem é o público-alvo? (perfil, interesses)", "PARAGRAFO", { secao: "Público & Mercado" }),
      q("tp_regiao", "Região de atuação / onde quer anunciar", "TEXTO", { secao: "Público & Mercado" }),
      q("tp_plataformas", "Onde quer anunciar?", "CAIXAS", { secao: "Público & Mercado", opcoes: ["Meta (Instagram/Facebook)", "Google", "TikTok", "YouTube", "Não sei / sugerir"] }),
      q("tp_contas", "Já tem conta de anúncios / pixel / Business Manager configurados?", "PARAGRAFO", { secao: "Estrutura" }),
      q("tp_historico", "Já investiu em anúncios antes? O que funcionou / não funcionou?", "PARAGRAFO", { secao: "Estrutura" }),
      q("tp_criativos", "Tem criativos / fotos / vídeos prontos? Anexe ou descreva", "UPLOAD", { secao: "Estrutura" }),
      q("tp_landing", "Tem site / landing page / WhatsApp pra onde mandar o tráfego? (link)", "LINK", { secao: "Estrutura" }),
      q("tp_orcamento", "Orçamento mensal pretendido pra mídia (R$)", "TEXTO", { secao: "Metas & Orçamento", obrigatoria: true }),
      q("tp_metas", "Tem metas de custo por lead/venda (CPL/CPA) ou ROAS?", "PARAGRAFO", { secao: "Metas & Orçamento" }),
      q("tp_sazonal", "Sazonalidade / datas de pico do negócio", "PARAGRAFO", { secao: "Metas & Orçamento" }),
    ],
  },

  // 4) SEO / GEO
  {
    slug: "seo",
    nome: "Briefing — SEO / GEO",
    tipoServico: "SEO",
    descricao: "Pra estratégia de busca orgânica (Google) e visibilidade em IA.",
    perguntas: [
      q("seo_site", "URL do site atual", "LINK", { secao: "Site & Acesso", obrigatoria: true }),
      q("seo_cms", "Plataforma / CMS do site (WordPress, Shopify, Wix, outro)", "TEXTO", { secao: "Site & Acesso" }),
      q("seo_blog", "O site tem blog / área de conteúdo?", "SIM_NAO", { secao: "Site & Acesso" }),
      q("seo_acessos", "Consegue dar acesso ao Google Search Console / Analytics?", "ESCOLHA", { secao: "Site & Acesso", opcoes: ["Sim", "Não", "Preciso de ajuda pra configurar"] }),
      q("seo_objetivo", "O que você quer alcançar com SEO?", "PARAGRAFO", { secao: "Objetivos", obrigatoria: true }),
      q("seo_prioridade", "Quais produtos / serviços são prioridade pra aparecer no Google?", "PARAGRAFO", { secao: "Objetivos" }),
      q("seo_regiao", "Atende qual região? (local x nacional)", "TEXTO", { secao: "Objetivos" }),
      q("seo_termos", "Que termos você acha que seus clientes buscam no Google?", "PARAGRAFO", { secao: "Palavras & Conteúdo" }),
      q("seo_duvidas", "Dúvidas frequentes que seus clientes têm (viram conteúdo)", "PARAGRAFO", { secao: "Palavras & Conteúdo" }),
      q("seo_conc", "Concorrentes que aparecem bem no Google (links)", "PARAGRAFO", { secao: "Palavras & Conteúdo" }),
      q("seo_tecnico", "Quem pode passar informação técnica do negócio pra produção de conteúdo?", "TEXTO", { secao: "Operacional" }),
    ],
  },

  // 5) BRANDING / SITE / IDENTIDADE
  {
    slug: "branding",
    nome: "Briefing — Branding / Site / Identidade",
    tipoServico: "BRANDING",
    descricao: "Pra criação/reformulação de marca, identidade visual e site.",
    perguntas: [
      q("br_escopo", "O que você precisa?", "CAIXAS", { secao: "Escopo", obrigatoria: true, opcoes: ["Logo", "Identidade visual completa", "Site / landing page", "Rebranding (renovar marca atual)", "Manual de marca"] }),
      q("br_porque", "Por que agora? O que motivou esse projeto?", "PARAGRAFO", { secao: "Escopo" }),
      q("br_historia", "Conte a história da empresa / marca", "PARAGRAFO", { secao: "Essência" }),
      q("br_proposito", "Propósito, missão e valores", "PARAGRAFO", { secao: "Essência" }),
      q("br_personalidade", "Se a marca fosse uma pessoa, como ela seria?", "PARAGRAFO", { secao: "Essência" }),
      q("br_transmitir", "O que a marca PRECISA transmitir? (3 palavras)", "TEXTO", { secao: "Essência", obrigatoria: true }),
      ...BLOCO_PUBLICO.map((p) => ({ ...p, secao: "Público & Mercado" })),
      ...BLOCO_CONCORRENCIA.map((p) => ({ ...p, secao: "Público & Mercado" })),
      q("br_atual", "Tem algo hoje? (logo, cores, fontes, site) — anexe", "UPLOAD", { secao: "Visual & Referências" }),
      q("br_refs_gosta", "Referências visuais que você GOSTA (links ou imagens)", "PARAGRAFO", { secao: "Visual & Referências" }),
      q("br_refs_naogosta", "Referências / estilos que você NÃO gosta", "PARAGRAFO", { secao: "Visual & Referências" }),
      q("br_cores", "Cores ou estilos com os quais se identifica (ou que quer evitar)", "PARAGRAFO", { secao: "Visual & Referências" }),
      q("br_aplicacoes", "Onde a marca vai aparecer? (redes, fachada, embalagem, site...)", "PARAGRAFO", { secao: "Operacional" }),
      q("br_prazo", "Tem prazo / data limite?", "DATA", { secao: "Operacional" }),
    ],
  },
];

export function getTemplatePadrao(slug: string): BriefingTemplatePadrao | undefined {
  return TEMPLATES_PADRAO.find((t) => t.slug === slug);
}

// ─── Status (metadata compartilhada por lista/editor/aba do cliente) ────
export type BriefingStatusUi = "RASCUNHO" | "ENVIADO" | "RESPONDIDO" | "ARQUIVADO";

/** Label + classes Tailwind (theme-aware) por status. Sem React aqui. */
export const BRIEFING_STATUS_META: Record<
  BriefingStatusUi,
  { label: string; bg: string; text: string; border: string }
> = {
  RASCUNHO: { label: "Rascunho", bg: "bg-secondary", text: "text-muted-foreground", border: "border-border" },
  ENVIADO: { label: "Enviado", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  RESPONDIDO: { label: "Respondido", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  ARQUIVADO: { label: "Arquivado", bg: "bg-secondary", text: "text-muted-foreground/70", border: "border-border" },
};

/** Parse defensivo de `perguntas` (Json do banco) → BriefingPergunta[]. */
export function normalizarPerguntas(raw: unknown): BriefingPergunta[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is BriefingPergunta => !!p && typeof p === "object" && typeof (p as BriefingPergunta).id === "string" && typeof (p as BriefingPergunta).pergunta === "string")
    .map((p) => ({
      id: p.id,
      pergunta: p.pergunta,
      tipo: (p.tipo ?? "TEXTO") as BriefingTipoPergunta,
      opcoes: Array.isArray(p.opcoes) ? p.opcoes : undefined,
      obrigatoria: !!p.obrigatoria,
      ajuda: typeof p.ajuda === "string" ? p.ajuda : undefined,
      secao: typeof p.secao === "string" ? p.secao : undefined,
    }));
}
