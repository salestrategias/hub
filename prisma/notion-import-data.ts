/**
 * Dados extraídos do Notion (workspace SAL + Marketing Lindóia Shopping)
 * em 2026-05-13 via Claude + Notion MCP.
 *
 * Fonte:
 *  - 👥 Clientes (15d1cdf7) — DB principal, 7 clientes ativos
 *  - ⭐ Clientes SAL (b4187a08) — DB paralelo, 13 clientes (inclui histórico)
 *  - ✅ Tarefas (96117f7e) — 21 tarefas
 *  - 📅 Calendário Editorial (b7369d74) — 14 posts
 *  - 📈 CRM (ebd71553) — 1 lead de teste (skipado)
 *  - 📅 Controle Mensal (240000db) — 3 meses (Abr/Mai/Jun 2026)
 *  - 🧠 Playbook + 🏠 Sobre a SAL + 💰 Finanças + ⚙️ Operações — seções do Manual
 *
 * Merge de clientes feito por NOME normalizado (lower + sem acento).
 * Tarefas/Posts resolvem cliente via mapa NotionUrl → ClienteNome.
 *
 * Script de import: scripts/import-notion.ts (executa via Prisma).
 */

// ─────────────────────────────────────────────────────────────────────
// Mapa de URLs Notion → Nome do cliente (pra resolver relações)
// ─────────────────────────────────────────────────────────────────────
export const URL_PARA_NOME_CLIENTE: Record<string, string> = {
  // 👥 Clientes (DB principal)
  "https://www.notion.so/32645d5465e88132a335e276d350b2b3": "Lindoia Shopping",
  "https://www.notion.so/32645d5465e88144a088e0dd8dd5b5e4": "Pipehline Services",
  "https://www.notion.so/32645d5465e8814bb40dc73f60499e8c": "Rua da Praia Shopping",
  "https://www.notion.so/32645d5465e881b8a7cfebb77bba0f51": "Galeria Chaves",
  "https://www.notion.so/32645d5465e881e39307cca544c7d206": "Canal do Vannucci",
  "https://www.notion.so/32645d5465e881ecb580d941677cbe3b": "Conhecer para Transformar",
  "https://www.notion.so/32645d5465e881fb8bb6e1f27488d606": "Tavi Papelaria",
};

// ─────────────────────────────────────────────────────────────────────
// CLIENTES — merge dos 2 DBs por nome
// ─────────────────────────────────────────────────────────────────────
export type ClienteImport = {
  nome: string;
  email: string | null;
  telefone: string | null;
  site: string | null;
  status: "ATIVO" | "INATIVO" | "PROSPECT" | "CHURNED";
  categoria: string | null;        // → tag
  servicos: string[];               // → tags
  diaFoco: string | null;           // → vai pra observações
  guiaMarca: string | null;         // → vai pra observações
  observacoes: string;
  dataCadastro: string | null;      // ISO
};

export const CLIENTES: ClienteImport[] = [
  // ── Ativos (do DB 👥 Clientes) ──
  {
    nome: "Lindoia Shopping",
    email: null,
    telefone: null,
    site: null,
    status: "ATIVO",
    categoria: "Suporte e Consultoria",
    servicos: ["Consultoria estratégica"],
    diaFoco: "Quarta",
    guiaMarca: null,
    observacoes: "Cliente focado em consultoria estratégica. Dia de foco: Quarta.",
    dataCadastro: null,
  },
  {
    nome: "Pipehline Services",
    email: null,
    telefone: null,
    site: "https://pipehlineservices.com.br/",
    status: "ATIVO",
    categoria: "Digital completo",
    servicos: ["Planejamento", "Tráfego pago", "Produção de Conteúdo", "Criação de Site"],
    diaFoco: "Terça",
    guiaMarca: null,
    observacoes: "Dia de foco: Terça. Cliente digital completo.",
    dataCadastro: "2025-08-01",
  },
  {
    nome: "Rua da Praia Shopping",
    email: null,
    telefone: null,
    site: "https://instagram.com/ruadapraiashopping",
    status: "ATIVO",
    categoria: "Alto envolvimento",
    servicos: ["Planejamento", "Redes sociais", "Ativações presenciais"],
    diaFoco: "Segunda",
    guiaMarca: "https://docs.google.com/document/d/1a42YdEjYNeK9m2MiHH1ozsX86zl7cuVS/edit?usp=sharing&ouid=101811989676405516860&rtpof=true&sd=true",
    observacoes: "Dia de foco: Segunda. Cliente de alto envolvimento. Guia de Marca no Drive (link nas tags).",
    dataCadastro: null,
  },
  {
    nome: "Galeria Chaves",
    email: null,
    telefone: null,
    site: "https://galeriachaves.poa.br",
    status: "ATIVO",
    categoria: "Alto envolvimento",
    servicos: ["Planejamento", "Redes sociais", "Ativações presenciais", "Assessoria Full"],
    diaFoco: "Segunda",
    guiaMarca: "https://docs.google.com/document/d/1ZuHolqho2iDeIjTctjN6Nnq4ERpbk9L0LaGVH4CqZVY/edit?usp=sharing",
    observacoes: "Dia de foco: Segunda. Guia de Marca no Drive.",
    dataCadastro: "2026-03-11",
  },
  {
    nome: "Canal do Vannucci",
    email: null,
    telefone: null,
    site: "https://canaldovannucci.com.br/",
    status: "ATIVO",
    categoria: "Suporte e Consultoria",
    servicos: ["Gestão de site", "Criação de Site"],
    diaFoco: "Quarta",
    guiaMarca: null,
    observacoes: "Dia de foco: Quarta. Cliente: José Armando Vannucci.",
    dataCadastro: "2025-02-10",
  },
  {
    nome: "Conhecer para Transformar",
    email: null,
    telefone: null,
    site: null,
    status: "ATIVO",
    categoria: "Suporte e Consultoria",
    servicos: ["Gestão de site", "Podcast"],
    diaFoco: "Quarta",
    guiaMarca: null,
    observacoes: "Dia de foco: Quarta. Inclui podcast Áudio do Bem.",
    dataCadastro: null,
  },
  {
    nome: "Tavi Papelaria",
    email: null,
    telefone: null,
    site: null,
    status: "ATIVO",
    categoria: "Digital completo",
    servicos: ["Tráfego pago", "Redes sociais", "Email marketing", "Gestão de site", "Gestão de Mídia Paga", "Estratégias Digitais"],
    diaFoco: "Terça",
    guiaMarca: null,
    observacoes: "Dia de foco: Terça. Cliente digital completo.",
    dataCadastro: "2024-11-28",
  },

  // ── Ativos adicionais (só no DB ⭐ Clientes SAL) ──
  {
    nome: "SAL Campanhas",
    email: "contato@salestrategias.com.br",
    telefone: "51993380278",
    site: "https://salestrategias.com.br",
    status: "ATIVO",
    categoria: null,
    servicos: ["Assessoria Full"],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "Conta da própria SAL — campanhas internas.",
    dataCadastro: "2025-09-03",
  },
  {
    nome: "De Camillis Advogados",
    email: null,
    telefone: null,
    site: null,
    status: "ATIVO",
    categoria: null,
    servicos: ["Assessoria de Branding"],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "",
    dataCadastro: "2024-08-23",
  },
  {
    nome: "Pontua",
    email: "renan@pontopronto.com",
    telefone: null,
    site: null,
    status: "ATIVO",
    categoria: null,
    servicos: ["Assessoria de Branding", "Estratégias Digitais"],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "Contato: Renan.",
    dataCadastro: "2024-11-22",
  },
  {
    nome: "Levante Festival",
    email: null,
    telefone: null,
    site: null,
    status: "ATIVO",
    categoria: null,
    servicos: [],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "",
    dataCadastro: null,
  },

  // ── Inativos (histórico, marca como CHURNED no Hub) ──
  {
    nome: "W2 Contabilidade",
    email: "contato@w2contabilidade.com.br",
    telefone: "51 99797-1905",
    site: "https://w2contabilidade.com.br/",
    status: "CHURNED",
    categoria: null,
    servicos: ["Gestão de Mídia Paga", "Estratégias Digitais"],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "Histórico. Cadastrado em 2024-09-09.",
    dataCadastro: "2024-09-09",
  },
  {
    nome: "Pignus BPO Financeiro",
    email: "atendimento@pignusbpo.com.br",
    telefone: "51 99797-1905",
    site: "https://www.pignusbpo.com.br/",
    status: "CHURNED",
    categoria: null,
    servicos: ["Criação de Site"],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "Histórico. Cadastrado em 2024-10-07.",
    dataCadastro: "2024-10-07",
  },
  {
    nome: "Divulga Vagas",
    email: "edicao.cv@gmail.com",
    telefone: null,
    site: "https://divulgavagas.com.br",
    status: "CHURNED",
    categoria: null,
    servicos: ["SEO", "Gestão de Mídia Paga"],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "Histórico. Cadastrado em 2025-07-14.",
    dataCadastro: "2025-07-14",
  },
  {
    nome: "APTC",
    email: null,
    telefone: null,
    site: null,
    status: "CHURNED",
    categoria: null,
    servicos: ["Criação de Site"],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "Histórico. Cadastrado em 2025-04-07.",
    dataCadastro: "2025-04-07",
  },
  {
    nome: "Ponto Pronto",
    email: null,
    telefone: null,
    site: null,
    status: "CHURNED",
    categoria: null,
    servicos: [],
    diaFoco: null,
    guiaMarca: null,
    observacoes: "Histórico.",
    dataCadastro: null,
  },
];

// ─────────────────────────────────────────────────────────────────────
// TAREFAS
// ─────────────────────────────────────────────────────────────────────
export type TarefaImport = {
  titulo: string;
  descricao: string;
  prioridade: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA";
  dataEntrega: string | null;     // ISO
  concluida: boolean;
  clienteNome: string | null;
  tipo: string | null;            // só pra anotar na descrição
};

export const TAREFAS: TarefaImport[] = [
  { titulo: "Planejamento FPP - Lindoia", descricao: "Fazer cronograma anual do Lindoia com orçamento", prioridade: "URGENTE", dataEntrega: "2026-03-17", concluida: true, clienteNome: "Lindoia Shopping", tipo: "Consultoria" },
  { titulo: "E-mail marketing Tavi - 23/03/26", descricao: "Não to conseguindo subir listas. Maicon ta verificando.", prioridade: "URGENTE", dataEntrega: "2026-03-23T11:00:00.000Z", concluida: true, clienteNome: "Tavi Papelaria", tipo: "Email marketing" },
  { titulo: "Produzir conteúdos Galeria Chaves", descricao: "", prioridade: "URGENTE", dataEntrega: "2026-03-18", concluida: false, clienteNome: "Galeria Chaves", tipo: "Social media" },
  { titulo: "Editar e agendar Áudio do Bem CpT", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-03-18", concluida: true, clienteNome: "Conhecer para Transformar", tipo: "Podcast" },
  { titulo: "Editar banners Cinema lindoia", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-03-18", concluida: true, clienteNome: "Lindoia Shopping", tipo: "Consultoria" },
  { titulo: "Artes Telão Cinema Lindoia", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-03-26", concluida: true, clienteNome: "Lindoia Shopping", tipo: "Consultoria" },
  { titulo: "Artes Cinema Telão Lindoia", descricao: "", prioridade: "NORMAL", dataEntrega: null, concluida: true, clienteNome: "Lindoia Shopping", tipo: null },
  { titulo: "Produzir arte para Lixeiras RDPS", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-03-27", concluida: true, clienteNome: "Rua da Praia Shopping", tipo: "Consultoria" },
  { titulo: "Formatar PC Renato", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-03-27", concluida: true, clienteNome: null, tipo: "Aleatorio" },
  { titulo: "Produzir Planejamento Anual Rua da Praia + Financeiro", descricao: "", prioridade: "URGENTE", dataEntrega: "2026-03-24", concluida: true, clienteNome: "Rua da Praia Shopping", tipo: "Planejamento" },
  { titulo: "Agendar conteúdos de março 100% Vegetal", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-03-23", concluida: true, clienteNome: "Pipehline Services", tipo: "Social media" },
  { titulo: "Produzir conteúdos 100% Vegetal", descricao: "", prioridade: "URGENTE", dataEntrega: "2026-03-23T21:00:00.000Z", concluida: false, clienteNome: "Pipehline Services", tipo: "Social media" },
  { titulo: "Produzir Card Palestra Lindoia", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-03-23", concluida: true, clienteNome: "Lindoia Shopping", tipo: "Consultoria" },
  { titulo: "Produzir Artes De Camillis", descricao: "", prioridade: "URGENTE", dataEntrega: "2026-03-23", concluida: false, clienteNome: "De Camillis Advogados", tipo: "Consultoria" },
  { titulo: "Arte para Totens Rua da Praia", descricao: "Arte para Totem com CTA para Praça de Alimentação", prioridade: "NORMAL", dataEntrega: "2026-04-13", concluida: true, clienteNome: "Rua da Praia Shopping", tipo: "Design" },
  { titulo: "Áudio do Bem #52", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-04-13", concluida: true, clienteNome: "Conhecer para Transformar", tipo: "Podcast" },
  { titulo: "Áudio do Bem #51", descricao: "", prioridade: "URGENTE", dataEntrega: "2026-04-13", concluida: true, clienteNome: "Conhecer para Transformar", tipo: "Podcast" },
  { titulo: "Apresentação Comercial Rua da Praia Shopping", descricao: "", prioridade: "NORMAL", dataEntrega: "2026-04-13", concluida: true, clienteNome: "Rua da Praia Shopping", tipo: "Design" },
  { titulo: "Ajustar e-mails Canal do Vannucci", descricao: "", prioridade: "URGENTE", dataEntrega: "2026-04-13", concluida: true, clienteNome: "Canal do Vannucci", tipo: null },
  { titulo: "Ajustar e-mails do Tiago Dresh", descricao: "", prioridade: "NORMAL", dataEntrega: null, concluida: false, clienteNome: null, tipo: null },
  { titulo: "Manutenção Geral do Site", descricao: "Diagnóstico inicial do portal + Manutenção Geral", prioridade: "URGENTE", dataEntrega: "2026-04-30", concluida: false, clienteNome: "Conhecer para Transformar", tipo: "Site" },
];

// ─────────────────────────────────────────────────────────────────────
// POSTS EDITORIAIS (Calendário Editorial dos clientes)
// ─────────────────────────────────────────────────────────────────────
export type PostImport = {
  titulo: string;
  legenda: string;                  // briefing/copy
  formato: "FEED" | "STORIES" | "REELS" | "CARROSSEL";
  status: "RASCUNHO" | "COPY_PRONTA" | "DESIGN_PRONTO" | "AGENDADO" | "PUBLICADO";
  dataPublicacao: string;            // ISO
  clienteNome: string | null;
  pilar: string | null;
};

export const POSTS: PostImport[] = [
  { titulo: "Lugares obrigatórios para visitar no Centro de Porto Alegre", legenda: "[Aprovado] Carrossel Instagram. Slides sobre lugares no Centro de POA. CTA Galeria Chaves.", formato: "CARROSSEL", status: "DESIGN_PRONTO", dataPublicacao: "2026-03-30", clienteNome: "Galeria Chaves", pilar: null },
  { titulo: "Casa do Pão de Queijo: ótimo café, atendimento diferenciado e o melhor pão de queijo da Andradas", legenda: "[Aprovação] Carrossel sobre Casa do Pão de Queijo (collab @casadopaodequeijochaves)", formato: "CARROSSEL", status: "COPY_PRONTA", dataPublicacao: "2026-03-30", clienteNome: "Galeria Chaves", pilar: null },
  { titulo: "Carrossel — Até 5 anos: por que a maioria dos negócios locais fecha antes de sair do nível 2", legenda: "[Publicado] Carrossel SAL próprio sobre gestão de PMEs", formato: "CARROSSEL", status: "PUBLICADO", dataPublicacao: "2026-04-07", clienteNome: null, pilar: "Autoridade" },
  { titulo: "Tour pelo Rua da Praia: conheça tudo o que tem aqui dentro", legenda: "Carrossel apresentando os andares do shopping (moda, alimentação, serviços, academia)", formato: "CARROSSEL", status: "RASCUNHO", dataPublicacao: "2026-04-09", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Como chegar ao Rua da Praia Shopping", legenda: "Carrossel de localização. Andradas 1044 + mapa + pontos de referência (Farol Santander, MARGS, Casa de Cultura, Praça da Alfândega)", formato: "CARROSSEL", status: "RASCUNHO", dataPublicacao: "2026-04-17", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Dia das Mães está chegando — e o Rua tem tudo para você celebrar", legenda: "[Campanha Dia das Mães — orçamento R$3.000] Post lançamento. Tom emotivo/celebrativo.", formato: "CARROSSEL", status: "RASCUNHO", dataPublicacao: "2026-04-28", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Canal de Descontos do Rua: ofertas exclusivas direto no seu WhatsApp", legenda: "Reel divulgando Canal WhatsApp de Descontos. Lojistas → Canal → Públic. CTA com link bio.", formato: "REELS", status: "RASCUNHO", dataPublicacao: "2026-04-24", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Apresentação: o único shopping do Centro Histórico de POA", legenda: "Reel campanha Brand Awareness abril. Fachada, Andradas 1044, andares, mix de lojas. Slogan: 'O Centro passa por aqui.'", formato: "REELS", status: "RASCUNHO", dataPublicacao: "2026-04-07", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Do café da manhã ao almoço: todas as pausas do seu dia têm lugar no Rua", legenda: "Reel opções de alimentação por horário (Troppo Benne, Mc Café, Aromaz, praça de alimentação)", formato: "REELS", status: "RASCUNHO", dataPublicacao: "2026-04-13", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Mais do que lojas: veja todos os serviços do Rua da Praia", legenda: "Carrossel serviços (Academia Moinhos Fitness, estacionamento, hotel anexo Master, escritórios)", formato: "CARROSSEL", status: "RASCUNHO", dataPublicacao: "2026-04-15", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Porto Alegre tem um Centro incrível — e o Rua fica bem no meio de tudo", legenda: "Carrossel turismo. Pontos: Farol Santander, MARGS, Casa de Cultura, Praça da Alfândega, Mercado Público + Rua como parada.", formato: "CARROSSEL", status: "RASCUNHO", dataPublicacao: "2026-04-26", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Dia Mundial do Livro: em collab com a Pop-up Livros", legenda: "[COLLAB Pop-up Livros] Post Dia do Livro 23/04 + antecipação Feira do Livro 2026.", formato: "FEED", status: "RASCUNHO", dataPublicacao: "2026-04-23", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Centro Histórico: um patrimônio que passa por aqui", legenda: "Reel lifestyle Centro POA + shopping. Calçadão, Praça Alfândega, Farol Santander, fachada Rua.", formato: "REELS", status: "RASCUNHO", dataPublicacao: "2026-04-22", clienteNome: "Rua da Praia Shopping", pilar: null },
  { titulo: "Praça de alimentação do Rua: do almoço ao happy hour", legenda: "Post praça de alimentação: Tipo Exportação (buffet), Trattoria, Sagrada Parrilla, Pastellon. Abre sáb/dom.", formato: "FEED", status: "RASCUNHO", dataPublicacao: "2026-04-11", clienteNome: "Rua da Praia Shopping", pilar: null },
];

// ─────────────────────────────────────────────────────────────────────
// LANÇAMENTOS FINANCEIROS (Controle Mensal — SAL)
// ─────────────────────────────────────────────────────────────────────
export type LancamentoImport = {
  descricao: string;
  valor: number;
  tipo: "RECEITA" | "DESPESA";
  categoria: string;
  data: string;                     // ISO (dia 1 do mês)
  entidade: "PJ" | "PF";
  recorrente: boolean;
};

export const LANCAMENTOS: LancamentoImport[] = [
  // Abril 2026 — Aberto (12.100 receita, 1.431 despesa)
  { descricao: "Faturamento Bruto — Abril 2026", valor: 12100, tipo: "RECEITA", categoria: "Faturamento", data: "2026-04-01", entidade: "PJ", recorrente: false },
  { descricao: "Despesas Agência — Abril 2026", valor: 1431, tipo: "DESPESA", categoria: "Despesas Fixas", data: "2026-04-01", entidade: "PJ", recorrente: false },

  // Maio 2026 — Projetado (12.100 receita, 1.431 despesa)
  { descricao: "Faturamento Bruto — Maio 2026 (projetado)", valor: 12100, tipo: "RECEITA", categoria: "Faturamento", data: "2026-05-01", entidade: "PJ", recorrente: false },
  { descricao: "Despesas Agência — Maio 2026", valor: 1431, tipo: "DESPESA", categoria: "Despesas Fixas", data: "2026-05-01", entidade: "PJ", recorrente: false },

  // Junho 2026 — Projetado com queda (10.600 receita = -1.500 do Pipeline)
  { descricao: "Faturamento Bruto — Junho 2026 (projetado, Pipeline -R$1.500)", valor: 10600, tipo: "RECEITA", categoria: "Faturamento", data: "2026-06-01", entidade: "PJ", recorrente: false },
  { descricao: "Despesas Agência — Junho 2026", valor: 1431, tipo: "DESPESA", categoria: "Despesas Fixas", data: "2026-06-01", entidade: "PJ", recorrente: false },
];

// ─────────────────────────────────────────────────────────────────────
// MANUAL SAL — seções pra preencher (Playbook + Marca + sobre)
//
// Texto FOI extraído das páginas-índice. Subpáginas com conteúdo rico
// (Tom de Voz, Identidade Visual, Personas, etc) retornaram 404 da
// integração MCP — placeholders ficam com links pro Notion original
// pra Marcelo abrir e copiar manualmente.
// ─────────────────────────────────────────────────────────────────────
export type DocSecaoImport = {
  tipo: "PLAYBOOK" | "MARCA";
  titulo: string;
  slug: string;
  icone: string;
  ordem: number;
  conteudoMarkdown: string;         // será convertido pra BlockNote no script
};

export const DOC_SECOES: DocSecaoImport[] = [
  // ── PLAYBOOK ──
  {
    tipo: "PLAYBOOK",
    titulo: "Sobre a SAL",
    slug: "sobre-a-sal",
    icone: "🏢",
    ordem: 10,
    conteudoMarkdown: `## Quem somos

A **SAL Estratégias de Marketing** é uma assessoria fundada por **Marcelo Freitas**, especialista em SEO, Performance e estratégias de crescimento digital. Nascemos da percepção de que PMEs precisam de atenção personalizada, estratégia sob medida e resultados mensuráveis — não de fórmulas prontas.

**SAL** = Simplificar, Atrair e Libertar. Marketing na medida certa.

## Missão

Ajudar PMEs a crescerem de forma sustentável através de estratégias de marketing digital eficazes e mensuráveis.

## Visão

Ser a assessoria de referência para PMEs que buscam crescimento real e parceria estratégica.

## Valores

- Resultados
- Transparência
- Parceria real
- Dados
- Educação
- Excelência
- Ética

## Referências no Notion original

- [SAL Estratégias — Nossa História](https://www.notion.so/10645d5465e880278038e554460943a5)
- [Briefing da Marca SAL](https://www.notion.so/1d745d5465e880edb86aebb76fe5286f)
- [Essência da Marca SAL](https://www.notion.so/1d745d5465e8807aa41fc3c8892c61f4)
- [Planejamento Marcelo da SAL](https://www.notion.so/20845d5465e880e0bd0ef81d3a4178f9)`,
  },
  {
    tipo: "PLAYBOOK",
    titulo: "Rotina semanal",
    slug: "rotina-semanal",
    icone: "📅",
    ordem: 20,
    conteudoMarkdown: `## Foco diário por cliente

- **Segunda**: Galeria Chaves · Rua da Praia Shopping
- **Terça**: Pipehline Services · Tavi Papelaria
- **Quarta**: Lindoia Shopping · Conhecer para Transformar · Canal do Vannucci
- **Quinta**: Revisões e entregas
- **Sexta**: Planejamento da semana seguinte

## Check diário (15 min)

1. Abrir **Tarefas → Kanban** e ver o que está em andamento
2. Checar o que vence hoje
3. Marcar como feito o que foi entregue
4. Adicionar novas demandas com cliente e prazo`,
  },
  {
    tipo: "PLAYBOOK",
    titulo: "Finanças e separação PJ × PF",
    slug: "financas-pj-pf",
    icone: "💰",
    ordem: 30,
    conteudoMarkdown: `## Regra de ouro

A empresa paga o pró-labore, e o pró-labore paga a sua vida.

## Separação PJ × PF

- Conta PJ → recebe clientes, paga despesas da agência
- Conta PF → recebe pró-labore, paga vida pessoal
- Cartão PJ → só agência
- Cartão PF → só pessoal

## Indicadores chave

- Pró-labore: transferir todo dia 5
- Ponto de equilíbrio estimado: **R$ 8.500/mês**
- Meta de reserva de emergência: **R$ 11.000** (2 meses de custo fixo)

## Despesas Fixas da Agência (referência)

- Contabilidade: R$ 250
- Hospedagem site: R$ 150
- Internet: R$ 120
- Telefone agência: R$ 41
- Estudos/cursos: R$ 500
- Computador (parcela): R$ 370
- **Total fixo agência**: **R$ 1.431**

## Despesas Fixas Pessoais (referência)

- Aluguel + cond. + IPTU: R$ 1.700
- Energia elétrica: R$ 150
- Telefone pessoal: R$ 45
- **Total fixo pessoal**: **R$ 1.895**

> Aluguel: definir com contabilidade se parte entra como despesa PJ (uso como escritório).

## Rotina financeira

- **Semanal** (15 min): conferir entradas/saídas, classificar lançamentos
- **Mensal** (30 min): fechar o mês no Controle Mensal, atualizar indicadores, planejar próximo mês`,
  },
  {
    tipo: "PLAYBOOK",
    titulo: "Workflow editorial",
    slug: "workflow-editorial",
    icone: "✍️",
    ordem: 40,
    conteudoMarkdown: `## Status do fluxo

1. **💡 Ideia** — pauta capturada
2. **✍️ Produção** — copy/roteiro em desenvolvimento
3. **👀 Aprovação** — enviado pro cliente revisar
4. **✅ Aprovado** — arte sendo produzida
5. **📤 Publicado** — no ar

## Tipo de conteúdo

- Post estático
- Carrossel
- Reels / Vídeo
- Stories
- Email
- Artigo de blog

## Canais

Instagram · Facebook · LinkedIn · TikTok · Email · Blog/Site

## Padrão por cliente

(documentar aqui especificidades de cada cliente — tom, hashtags, frequência)`,
  },
  {
    tipo: "PLAYBOOK",
    titulo: "Comercial e propostas",
    slug: "comercial-propostas",
    icone: "💼",
    ordem: 50,
    conteudoMarkdown: `## Pipeline (8 etapas)

1. 🔵 Lead frio
2. 📞 Primeiro contato
3. 💬 Em conversa
4. 📄 Proposta enviada
5. 🤝 Negociação
6. ✅ Fechado (GANHO)
7. ❌ Perdido
8. 😴 Inativo

## Origens

Instagram · LinkedIn · Indicação · Site · WhatsApp · Evento

## Tipo de lead

- Novo lead
- Indicação
- Retorno
- Upsell

## Serviços oferecidos

- Planejamento
- Redes sociais
- Tráfego pago
- Email marketing
- Gestão de site
- SEO
- Podcast
- Ativações
- Consultoria

## Referências no Notion original

- [Apresentação Comercial SAL](https://www.notion.so/20e45d5465e880598a20e8de3768752b)
- [Apresentação SAL Estratégias de Marketing](https://www.notion.so/1f845d5465e880329c6bcf4469325a25)`,
  },

  // ── MARCA ──
  {
    tipo: "MARCA",
    titulo: "Posicionamento",
    slug: "posicionamento",
    icone: "🎯",
    ordem: 10,
    conteudoMarkdown: `## Tagline

**Marketing na medida certa.**

## Significado da marca

**SAL** = Simplificar, Atrair e Libertar.

- **Simplificar**: tirar a complexidade do marketing pra PME entender e decidir
- **Atrair**: estratégias que geram demanda real, mensurável
- **Libertar**: dar ao dono do negócio liberdade de focar no que ele faz melhor

## Frase-âncora

> "Por trás de cada marca, existe uma história — a nossa missão é contá-la do jeito certo."

## Público

PMEs (Pequenas e Médias Empresas) que buscam:
- Crescimento sustentável
- Estratégia sob medida (vs fórmulas prontas)
- Parceria real, não só prestação de serviço
- Resultados mensuráveis`,
  },
  {
    tipo: "MARCA",
    titulo: "Tom de voz",
    slug: "tom-de-voz",
    icone: "🗣️",
    ordem: 20,
    conteudoMarkdown: `## Princípios

- **Direto, sem floreio** — explicamos com clareza, evitamos jargão
- **Consultivo, não vendedor** — autoridade sem arrogância
- **Pragmático** — foco em resultado mensurável, não em promessas vagas
- **Próximo** — primeira pessoa do plural ("vamos", "entregamos", "nossa equipe")

## Evitar

- "Vamos potencializar sua marca" → ❌ vago
- "Vamos gerar X leads qualificados/mês" → ✅ específico

## Referência completa no Notion

[Tom de Voz da SAL](https://www.notion.so/1d745d5465e8802694c9eef106368d40) — abrir manualmente e copiar conteúdo aqui quando tiver tempo.`,
  },
  {
    tipo: "MARCA",
    titulo: "Identidade visual",
    slug: "identidade-visual",
    icone: "🎨",
    ordem: 30,
    conteudoMarkdown: `## Cores

- **Roxo primário SAL**: #7E30E1
- **Roxo escuro**: #54199F
- Gradient identidade: \`linear-gradient(135deg, #7E30E1, #54199F)\`

## Tipografia

- Display: Inter Tight (títulos)
- Body: Inter (corpo)
- Mono: JetBrains Mono (números, código)

## Referência completa no Notion

[Identidade Visual](https://www.notion.so/1ec45d5465e880958c86e0132c45f4ec) — abrir manualmente e copiar conteúdo aqui (logos, espaçamento, regras de uso).`,
  },
  {
    tipo: "MARCA",
    titulo: "Personas SAL",
    slug: "personas",
    icone: "👥",
    ordem: 40,
    conteudoMarkdown: `## Persona principal

Donos de PME (pequenas e médias empresas) que:
- Faturam mensalmente, têm time pequeno (1-15 pessoas)
- Sabem que precisam de marketing digital, mas não têm tempo/expertise pra fazer sozinhos
- Já tentaram agência grande e ficaram frustrados (fórmula pronta, sem atenção)
- Querem alguém que entenda o negócio antes de propor solução

## Referência completa no Notion

[Público-Alvo e Personas](https://www.notion.so/1ec45d5465e880d89ff6e66b19598098) — abrir manualmente e copiar detalhamento de cada persona.`,
  },
  {
    tipo: "MARCA",
    titulo: "Metodologia 5Ds",
    slug: "metodologia-5ds",
    icone: "📐",
    ordem: 50,
    conteudoMarkdown: `## Os 5Ds da SAL

(estrutura proprietária da agência — documentar cada D)

1. **D**iagnóstico — entender o negócio, métricas atuais, dor
2. **D**esenho — estratégia sob medida
3. **D**esenvolvimento — produção do plano (conteúdo, campanhas, site)
4. **D**istribuição — execução nos canais
5. **D**ados — monitoramento, relatório mensal, ajustes

## Referência completa no Notion

[Metodologia SAL — 5Ds](https://www.notion.so/1d745d5465e880ccb359eef24ffbfe9e) — copiar conteúdo completo aqui.`,
  },
  {
    tipo: "MARCA",
    titulo: "Frases e gatilhos",
    slug: "frases-gatilhos",
    icone: "💬",
    ordem: 60,
    conteudoMarkdown: `## Gatilhos da marca

(coleção de frases-âncora pra usar em comunicação)

## Referências no Notion

- [Central de Frases e Gatilhos](https://www.notion.so/1eb45d5465e880738024e28df912769e)
- [Frases e Gatilhos da Marca](https://www.notion.so/1d745d5465e880288ab2c4853ad4f8f0)`,
  },
];

// ─────────────────────────────────────────────────────────────────────
// Pilares de Conteúdo SAL (referência rápida)
// ─────────────────────────────────────────────────────────────────────
export const PILARES_CONTEUDO_SAL = [
  "Educacional",
  "Autoridade",
  "Prova social",
  "Bastidores",
  "Vendas / CTA",
  "Marca pessoal",
];
