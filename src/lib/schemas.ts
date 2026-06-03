import { z } from "zod";

// ─── Cliente ──────────────────────────────────────────────────────
export const clienteSchema = z.object({
  nome: z.string().min(2, "Mínimo 2 caracteres"),
  cnpj: z.string().optional().nullable(),
  email: z.string().email("Email inválido").or(z.literal("")).optional().nullable(),
  telefone: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  status: z.enum(["ATIVO", "INATIVO", "PROSPECT", "CHURNED"]).default("ATIVO"),
  valorContratoMensal: z.coerce.number().min(0).default(0),
  notas: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional().default([]),
});
export type ClienteInput = z.infer<typeof clienteSchema>;

// ─── Post (Calendário Editorial) ──────────────────────────────────
export const postSchema = z.object({
  titulo: z.string().min(1),
  legenda: z.string().optional().nullable(),
  pilar: z.string().optional().nullable(),
  formato: z.enum(["FEED", "STORIES", "REELS", "CARROSSEL"]),
  status: z.enum(["RASCUNHO", "COPY_PRONTA", "DESIGN_PRONTO", "AGENDADO", "PUBLICADO"]),
  dataPublicacao: z.coerce.date(),
  clienteId: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  cta: z.string().max(500).optional().nullable().or(z.literal("")),
  observacoesProducao: z.string().optional().nullable(),
});
export type PostInput = z.infer<typeof postSchema>;

export const postArquivoSchema = z.object({
  tipo: z.enum(["IMAGEM", "VIDEO", "DOCUMENTO", "LINK_EXTERNO"]),
  // dataURL ou URL — sem URL validation estrita porque dataURL é grande
  url: z.string().min(10, "URL ou arquivo inválido").max(5_000_000, "Arquivo muito grande (5MB max)"),
  nome: z.string().max(120).optional().nullable().or(z.literal("")),
  legenda: z.string().max(500).optional().nullable().or(z.literal("")),
  ordem: z.coerce.number().int().default(0),
});
export type PostArquivoInput = z.infer<typeof postArquivoSchema>;

export const postArquivosReordenarSchema = z.object({
  itens: z.array(z.object({ id: z.string(), ordem: z.coerce.number().int() })),
});

// ─── Criativo (Tráfego Pago) ──────────────────────────────────────
export const criativoSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  status: z
    .enum(["RASCUNHO", "EM_APROVACAO", "APROVADO", "RECUSADO", "NO_AR", "PAUSADO", "ENCERRADO"])
    .default("RASCUNHO"),
  plataforma: z.enum(["META_ADS", "GOOGLE_ADS", "TIKTOK_ADS", "YOUTUBE_ADS", "LINKEDIN_ADS"]),
  formato: z
    .enum([
      "POST_IMAGEM",
      "POST_VIDEO",
      "CARROSSEL",
      "COLLECTION",
      "STORY",
      "REELS_AD",
      "RESPONSIVE_DISPLAY",
      "SEARCH_AD",
      "PERFORMANCE_MAX",
    ])
    .default("POST_IMAGEM"),
  textoPrincipal: z.string().max(5000).optional().nullable().or(z.literal("")),
  headline: z.string().max(200).optional().nullable().or(z.literal("")),
  descricao: z.string().max(2000).optional().nullable().or(z.literal("")),
  ctaBotao: z.string().max(60).optional().nullable().or(z.literal("")),
  urlDestino: z.string().max(2000).optional().nullable().or(z.literal("")),
  publicoAlvo: z.string().max(2000).optional().nullable().or(z.literal("")),
  orcamento: z.coerce.number().nonnegative().optional().nullable(),
  inicio: z.coerce.date().optional().nullable(),
  fim: z.coerce.date().optional().nullable(),
  observacoesProducao: z.string().max(5000).optional().nullable().or(z.literal("")),
  clienteId: z.string().min(1, "Cliente obrigatório"),
  campanhaPagaId: z.string().optional().nullable(),
});
export type CriativoInput = z.infer<typeof criativoSchema>;

export const criativoArquivoSchema = z.object({
  tipo: z.enum(["IMAGEM", "VIDEO", "DOCUMENTO", "LINK_EXTERNO"]),
  url: z.string().min(10, "URL ou arquivo inválido").max(5_000_000, "Arquivo muito grande (5MB max)"),
  nome: z.string().max(120).optional().nullable().or(z.literal("")),
  legenda: z.string().max(500).optional().nullable().or(z.literal("")),
  ordem: z.coerce.number().int().default(0),
});
export type CriativoArquivoInput = z.infer<typeof criativoArquivoSchema>;

export const criativoArquivosReordenarSchema = z.object({
  itens: z.array(z.object({ id: z.string(), ordem: z.coerce.number().int() })),
});

export const criativoVincularCampanhaSchema = z.object({
  campanhaPagaId: z.string().nullable(),
});

// ─── Portal v2 — submissão de conteúdo pelo CLIENTE ───────────────
// Cliente envia post/criativo pra Marcelo revisar (caminho inverso).
// Reusa as mesmas regras de arquivo (dataURL até 5MB ou URL externa).
// clienteId NÃO vem do body — é derivado do token da sessão. Status e
// origem/revisão são forçados no servidor (RASCUNHO + CLIENTE + PENDENTE).
const portalArquivoSchema = z.object({
  tipo: z.enum(["IMAGEM", "VIDEO", "DOCUMENTO", "LINK_EXTERNO"]),
  url: z.string().min(10, "URL ou arquivo inválido").max(5_000_000, "Arquivo muito grande (5MB max)"),
  nome: z.string().max(120).optional().nullable().or(z.literal("")),
  legenda: z.string().max(500).optional().nullable().or(z.literal("")),
  ordem: z.coerce.number().int().default(0),
});

export const portalPostSubmissaoSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  legenda: z.string().max(20_000).optional().nullable().or(z.literal("")),
  formato: z.enum(["FEED", "STORIES", "REELS", "CARROSSEL"]),
  dataPublicacao: z.coerce.date(),
  hashtags: z.array(z.string().max(80)).max(60).default([]),
  arquivos: z.array(portalArquivoSchema).max(20).default([]),
});
export type PortalPostSubmissaoInput = z.infer<typeof portalPostSubmissaoSchema>;

// Cliente ANEXA arte(s) num post EXISTENTE da SAL (não cria post novo).
// Reusa a mesma regra de arquivo (dataURL até 5MB ou URL externa). Os
// PostArquivo criados ganham enviadoPorCliente=true no servidor. clienteId
// e postId vêm da URL/sessão — nunca do body.
export const portalAnexarArteSchema = z.object({
  arquivos: z.array(portalArquivoSchema).min(1, "Anexe pelo menos uma arte").max(20),
});
export type PortalAnexarArteInput = z.infer<typeof portalAnexarArteSchema>;

export const portalCriativoSubmissaoSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  textoPrincipal: z.string().max(5000).optional().nullable().or(z.literal("")),
  headline: z.string().max(200).optional().nullable().or(z.literal("")),
  plataforma: z.enum(["META_ADS", "GOOGLE_ADS", "TIKTOK_ADS", "YOUTUBE_ADS", "LINKEDIN_ADS"]),
  formato: z.enum([
    "POST_IMAGEM",
    "POST_VIDEO",
    "CARROSSEL",
    "COLLECTION",
    "STORY",
    "REELS_AD",
    "RESPONSIVE_DISPLAY",
    "SEARCH_AD",
    "PERFORMANCE_MAX",
  ]),
  arquivos: z.array(portalArquivoSchema).max(20).default([]),
});
export type PortalCriativoSubmissaoInput = z.infer<typeof portalCriativoSubmissaoSchema>;

// ─── Revisão (Marcelo revisa conteúdo submetido pelo cliente) ─────
// Usado por /api/posts/[id]/revisar e /api/criativos/[id]/revisar.
// nota é obrigatória quando a decisão é AJUSTE (vira revisaoNota).
export const revisaoSchema = z
  .object({
    decisao: z.enum(["APROVADO", "AJUSTE"]),
    nota: z.string().trim().max(5000).optional().nullable(),
  })
  .refine((d) => d.decisao !== "AJUSTE" || !!d.nota, {
    message: "Nota é obrigatória ao pedir ajuste",
    path: ["nota"],
  });
export type RevisaoInput = z.infer<typeof revisaoSchema>;

// ─── Contrato ─────────────────────────────────────────────────────
export const contratoSchema = z.object({
  clienteId: z.string().min(1),
  valor: z.coerce.number().min(0),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  status: z.enum(["ATIVO", "ENCERRADO", "EM_RENOVACAO", "CANCELADO"]).default("ATIVO"),
  multaRescisoria: z.string().optional().nullable(),
  reajuste: z.string().optional().default("IGP-M"),
  observacoes: z.string().optional().nullable(),
  googleDriveFileId: z.string().optional().nullable(),
  googleDriveFileUrl: z.string().optional().nullable(),
});
export type ContratoInput = z.infer<typeof contratoSchema>;

// ─── Projeto ──────────────────────────────────────────────────────
export const projetoSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional().nullable(),
  prioridade: z.enum(["URGENTE", "ALTA", "NORMAL", "BAIXA"]).default("NORMAL"),
  status: z.enum(["BRIEFING", "PRODUCAO", "REVISAO", "APROVACAO", "ENTREGUE"]).default("BRIEFING"),
  dataEntrega: z.coerce.date().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  criarPastaDrive: z.boolean().optional().default(false),
});
export type ProjetoInput = z.infer<typeof projetoSchema>;

// ─── Tarefa ───────────────────────────────────────────────────────
export const tarefaSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  prioridade: z.enum(["URGENTE", "ALTA", "NORMAL", "BAIXA"]).default("NORMAL"),
  dataEntrega: z.coerce.date().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  projetoId: z.string().optional().nullable(),
  concluida: z.boolean().optional().default(false),
});
export type TarefaInput = z.infer<typeof tarefaSchema>;

// ─── Lançamento Financeiro ────────────────────────────────────────
export const lancamentoSchema = z.object({
  descricao: z.string().min(1),
  valor: z.coerce.number(),
  tipo: z.enum(["RECEITA", "DESPESA"]),
  categoria: z.string().optional().nullable(),
  data: z.coerce.date(),
  recorrente: z.boolean().optional().default(false),
  entidade: z.enum(["PJ", "PF"]).default("PJ"),
  clienteId: z.string().optional().nullable(),
});
export type LancamentoInput = z.infer<typeof lancamentoSchema>;

// ─── Métricas ─────────────────────────────────────────────────────
export const metricaRedeSchema = z.object({
  clienteId: z.string(),
  rede: z.enum(["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "YOUTUBE"]),
  ano: z.coerce.number().int(),
  mes: z.coerce.number().int().min(1).max(12),
  seguidores: z.coerce.number().int().default(0),
  alcance: z.coerce.number().int().default(0),
  impressoes: z.coerce.number().int().default(0),
  engajamento: z.coerce.number().int().default(0),
  posts: z.coerce.number().int().default(0),
  stories: z.coerce.number().int().default(0),
  reels: z.coerce.number().int().default(0),
});
export type MetricaRedeInput = z.infer<typeof metricaRedeSchema>;

export const metricaSeoSchema = z.object({
  clienteId: z.string(),
  ano: z.coerce.number().int(),
  mes: z.coerce.number().int().min(1).max(12),
  posicaoMedia: z.coerce.number().default(0),
  cliquesOrganicos: z.coerce.number().int().default(0),
  impressoes: z.coerce.number().int().default(0),
  ctr: z.coerce.number().default(0),
  keywordsRanqueadas: z.coerce.number().int().default(0),
  observacoes: z.string().optional().nullable(),
});
export type MetricaSeoInput = z.infer<typeof metricaSeoSchema>;

export const seoKeywordSchema = z.object({
  clienteId: z.string(),
  keyword: z.string().min(1),
  posicaoAtual: z.coerce.number().int().default(0),
  posicaoAnterior: z.coerce.number().int().default(0),
  volumeEstimado: z.coerce.number().int().default(0),
  urlRanqueada: z.string().optional().nullable(),
});
export type SeoKeywordInput = z.infer<typeof seoKeywordSchema>;

export const campanhaPagaSchema = z.object({
  clienteId: z.string(),
  ano: z.coerce.number().int(),
  mes: z.coerce.number().int().min(1).max(12),
  plataforma: z.enum(["META_ADS", "GOOGLE_ADS", "TIKTOK_ADS", "YOUTUBE_ADS", "LINKEDIN_ADS"]),
  nome: z.string().min(1),
  investimento: z.coerce.number().min(0),
  impressoes: z.coerce.number().int().default(0),
  cliques: z.coerce.number().int().default(0),
  conversoes: z.coerce.number().int().default(0),
  cpa: z.coerce.number().default(0),
  roas: z.coerce.number().default(0),
  cpm: z.coerce.number().default(0),
  cpcMedio: z.coerce.number().default(0),
  insights: z.string().optional().nullable(),
});
export type CampanhaPagaInput = z.infer<typeof campanhaPagaSchema>;

// ─── Evento Agenda (UI) ───────────────────────────────────────────
export const eventoSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  inicio: z.coerce.date(),
  fim: z.coerce.date(),
});
export type EventoInput = z.infer<typeof eventoSchema>;

// ─── Reunião ──────────────────────────────────────────────────────
export const reuniaoTipoEnum = z.enum([
  "DIAGNOSTICO",
  "ALINHAMENTO",
  "KICKOFF",
  "RETRO",
  "COMERCIAL",
  "INTERNA",
]);

export const reuniaoSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório"),
  data: z.coerce.date(),
  duracaoSeg: z.coerce.number().int().min(0).optional().nullable(),
  audioUrl: z.string().optional().nullable(),
  resumoIA: z.string().optional().nullable(),
  notasLivres: z.string().optional().nullable(),
  status: z.enum(["GRAVANDO", "PROCESSANDO", "TRANSCRITA", "GRAVADA"]).default("GRAVADA"),
  participantes: z.array(z.string()).default([]),
  tagsLivres: z.array(z.string()).default([]),
  clienteId: z.string().optional().nullable(),
  // Fase 2: classificação + pauta/notas (BlockNote) + vínculo com lead
  tipo: reuniaoTipoEnum.optional().nullable(),
  conteudo: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
});
export type ReuniaoInput = z.infer<typeof reuniaoSchema>;

export const reuniaoBlockSchema = z.object({
  reuniaoId: z.string(),
  ordem: z.coerce.number().int().default(0),
  timestamp: z.coerce.number().int().min(0),
  speaker: z.string().min(1),
  speakerCor: z.string().optional().nullable(),
  texto: z.string().min(1),
});
export type ReuniaoBlockInput = z.infer<typeof reuniaoBlockSchema>;

export const reuniaoActionSchema = z.object({
  reuniaoId: z.string(),
  ordem: z.coerce.number().int().default(0),
  texto: z.string().min(1),
  responsavel: z.string().optional().nullable(),
  prazo: z.string().optional().nullable(),
  concluido: z.boolean().default(false),
});
export type ReuniaoActionInput = z.infer<typeof reuniaoActionSchema>;

export const reuniaoCapituloSchema = z.object({
  reuniaoId: z.string(),
  ordem: z.coerce.number().int().default(0),
  timestamp: z.coerce.number().int().min(0),
  titulo: z.string().min(1),
});
export type ReuniaoCapituloInput = z.infer<typeof reuniaoCapituloSchema>;

// ─── Nota ─────────────────────────────────────────────────────────
export const notaSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  pasta: z.string().default("Inbox"),
  conteudo: z.string().default(""),
  tags: z.array(z.string()).default([]),
  favorita: z.boolean().default(false),
});
export type NotaInput = z.infer<typeof notaSchema>;

// ─── Mapa Mental ──────────────────────────────────────────────────
export const mindMapNodeSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number().default(140),
  h: z.number().default(60),
  tipo: z.enum(["rect", "circle", "sticky", "text"]).default("rect"),
  texto: z.string().default(""),
  subtexto: z.string().optional(),
  cor: z.string().default("#7E30E1"),
});

export const mindMapEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  estilo: z.enum(["solid", "dashed", "dotted"]).default("solid"),
  cor: z.string().default("#9696A8"),
});

export const mindMapDataSchema = z.object({
  nodes: z.array(mindMapNodeSchema),
  edges: z.array(mindMapEdgeSchema),
});

export const mindMapSchema = z.object({
  titulo: z.string().min(1).max(200),
  descricao: z.string().optional().nullable(),
  data: mindMapDataSchema,
  thumbnail: z.string().optional().nullable(),
});
export type MindMapInput = z.infer<typeof mindMapSchema>;
export type MindMapNode = z.infer<typeof mindMapNodeSchema>;
export type MindMapEdge = z.infer<typeof mindMapEdgeSchema>;

// ─── Template ──────────────────────────────────────────────────────
export const templateSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(120),
  descricao: z.string().max(500).optional().nullable(),
  tipo: z.enum(["NOTA", "REUNIAO", "BRIEFING", "TAREFA", "PROJETO"]),
  categoria: z.string().max(60).optional().nullable(),
  icone: z.string().max(40).optional().nullable(),
  cor: z.string().max(20).optional().nullable(),
  conteudo: z.string().default(""),
  compartilhado: z.boolean().default(true),
});
export type TemplateInput = z.infer<typeof templateSchema>;

export const templateInstanciarSchema = z.object({
  /** Contexto opcional (cliente associado, etc) pra expandir variáveis. */
  clienteId: z.string().optional().nullable(),
  /** Overrides — ex: `{ titulo: "Custom" }` se quiser sobrescrever campos do template */
  overrides: z.record(z.string()).optional(),
});
export type TemplateInstanciarInput = z.infer<typeof templateInstanciarSchema>;

// ─── Proposta ──────────────────────────────────────────────────────
export const propostaSchema = z.object({
  titulo: z.string().min(1).max(200),
  clienteId: z.string().optional().nullable(),
  clienteNome: z.string().min(1).max(200),
  clienteEmail: z.string().email().optional().nullable().or(z.literal("")),
  capa: z.string().default(""),
  diagnostico: z.string().default(""),
  objetivo: z.string().default(""),
  escopo: z.string().default(""),
  cronograma: z.string().default(""),
  investimento: z.string().default(""),
  proximosPassos: z.string().default(""),
  termos: z.string().default(""),
  valorMensal: z.coerce.number().nonnegative().optional().nullable(),
  valorTotal: z.coerce.number().nonnegative().optional().nullable(),
  duracaoMeses: z.coerce.number().int().positive().optional().nullable(),
  validadeDias: z.coerce.number().int().positive().max(365).default(30),
  logoUrl: z.string().max(500_000).optional().nullable().or(z.literal("")),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use formato #RRGGBB)").optional().nullable().or(z.literal("")),
  capaImagemUrl: z.string().max(2_500_000).optional().nullable().or(z.literal("")),
  /** Blocos extras de personalização avançada (pacotes, cases, KPIs, equipe, FAQ). */
  extras: z.unknown().optional().nullable(),
  /** Fase 1: array unificado de blocos (substitui gradualmente as 8 colunas + extras). Normalizado em src/lib/blocos.ts. */
  secoes: z.unknown().optional().nullable(),
  /** Fase 1: tema visual avançado (cores/fonte/estilo de capa). */
  tema: z.unknown().optional().nullable(),
});
export type PropostaInput = z.infer<typeof propostaSchema>;

export const propostaEnviarSchema = z.object({
  /** Sobrescreve validadeDias da proposta. Opcional. */
  validadeDias: z.coerce.number().int().positive().max(365).optional(),
  /** Senha opcional pra proteger o link público. */
  senha: z.string().min(4).max(40).optional().or(z.literal("")),
});
export type PropostaEnviarInput = z.infer<typeof propostaEnviarSchema>;

export const propostaRecusarSchema = z.object({
  motivo: z.string().max(500).optional(),
});

// ─── Diagnóstico estratégico ──────────────────────────────────────
// Seção modular do diagnóstico. `conteudo` é JSON BlockNote serializado.
// Catálogo de tipos em `src/lib/diagnostico-secoes.ts`.
export const diagnosticoSecaoSchema = z.object({
  id: z.string().min(1),
  tipo: z.string().min(1),
  titulo: z.string().max(200),
  conteudo: z.string().default(""),
  // Payload dos blocos visuais estruturados (kpis/timeline/cases/etc.).
  // Json livre — o shape é validado em runtime por normalizarSecoes.
  dados: z.unknown().optional().nullable(),
  visivel: z.boolean().default(true),
  ordem: z.coerce.number().int().default(0),
});
export type DiagnosticoSecaoInput = z.infer<typeof diagnosticoSecaoSchema>;

export const diagnosticoSchema = z.object({
  titulo: z.string().min(1).max(200),
  clienteId: z.string().optional().nullable(),
  clienteNome: z.string().min(1).max(200),
  clienteEmail: z.string().email().optional().nullable().or(z.literal("")),
  leadId: z.string().optional().nullable(),
  reuniaoId: z.string().optional().nullable(),
  // Array completo de seções — o editor envia tudo (PATCH otimista).
  // No create é ignorado (server gera defaultSecoes()).
  secoes: z.array(diagnosticoSecaoSchema).optional(),
  logoUrl: z.string().max(500_000).optional().nullable().or(z.literal("")),
  corPrimaria: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use formato #RRGGBB)")
    .optional()
    .nullable()
    .or(z.literal("")),
  capaImagemUrl: z.string().max(2_500_000).optional().nullable().or(z.literal("")),
  status: z.enum(["RASCUNHO", "PRONTO", "ENVIADO", "VISTO", "ARQUIVADO"]).optional(),
});
export type DiagnosticoInput = z.infer<typeof diagnosticoSchema>;

export const diagnosticoEnviarSchema = z.object({
  /** Dias até o link público expirar. Default 60 (diagnóstico vale mais tempo que proposta). */
  validadeDias: z.coerce.number().int().positive().max(365).optional(),
  senha: z.string().min(4).max(40).optional().or(z.literal("")),
});
export type DiagnosticoEnviarInput = z.infer<typeof diagnosticoEnviarSchema>;

// Input do gerador "gerar proposta a partir do diagnóstico" (ponte opcional).
export const diagnosticoGerarPropostaSchema = z.object({
  /** Título da proposta. Default = "Proposta — {titulo do diagnóstico}". */
  titulo: z.string().max(200).optional(),
});

// ─── Lead (pipeline pré-cliente) ──────────────────────────────────
export const leadSchema = z.object({
  empresa: z.string().min(1, "Empresa obrigatória").max(200),
  contatoNome: z.string().max(120).optional().nullable().or(z.literal("")),
  contatoEmail: z.string().email().optional().nullable().or(z.literal("")),
  contatoTelefone: z.string().max(40).optional().nullable().or(z.literal("")),
  segmento: z.string().max(80).optional().nullable().or(z.literal("")),
  porte: z.enum(["SMALL", "MID", "LARGE"]).optional().nullable(),
  origem: z.string().max(120).optional().nullable().or(z.literal("")),
  status: z
    .enum(["NOVO", "QUALIFICACAO", "DIAGNOSTICO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "GANHO", "PERDIDO"])
    .default("NOVO"),
  prioridade: z.enum(["URGENTE", "ALTA", "NORMAL", "BAIXA"]).default("NORMAL"),
  valorEstimadoMensal: z.coerce.number().nonnegative().optional().nullable(),
  duracaoEstimadaMeses: z.coerce.number().int().positive().max(120).optional().nullable(),
  notas: z.string().default(""),
  proximaAcao: z.string().max(200).optional().nullable().or(z.literal("")),
  proximaAcaoEm: z.coerce.date().optional().nullable(),
  tags: z.array(z.string()).default([]),
  motivoPerdido: z.string().max(1000).optional().nullable().or(z.literal("")),
  // Score: automático (gerado server-side) ou manual (override do usuário).
  // Aceita null pra "voltar pro automático".
  score: z.coerce.number().int().min(0).max(100).optional(),
  scoreManual: z.coerce.number().int().min(0).max(100).optional().nullable(),
});
export type LeadInput = z.infer<typeof leadSchema>;

// Importação de leads em batch via CSV (Meta Lead Ads, etc).
// Mesmo shape do importarRelatorioSchema mas destino é Lead.
export const importarLeadsSchema = z.object({
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).min(1, "Cole pelo menos 1 linha"),
  /** Sobrescreve campo `origem` em todos os leads importados (opcional). */
  origemOverride: z.string().max(120).optional().nullable().or(z.literal("")),
  /**
   * Modo de gravação:
   *  - `pular` (default): se email já existe, ignora a linha
   *  - `atualizar`: se email já existe, faz merge (campos vazios são preenchidos)
   *  - `criar_sempre`: cria novo lead mesmo se email duplicado
   */
  modo: z.enum(["pular", "atualizar", "criar_sempre"]).default("pular"),
});
export type ImportarLeadsInput = z.infer<typeof importarLeadsSchema>;

export const leadConverterSchema = z.object({
  /**
   * Modo de conversão:
   *  - `novo` → cria Cliente novo usando dados do lead
   *  - `existente` → vincula a um cliente já cadastrado (clienteId obrigatório)
   */
  modo: z.enum(["novo", "existente"]),
  clienteId: z.string().optional().nullable(),
  /** Override do valor contratado. Default = lead.valorEstimadoMensal */
  valorContratoMensal: z.coerce.number().nonnegative().optional().nullable(),
});
export type LeadConverterInput = z.infer<typeof leadConverterSchema>;

// ─── Conteudo SAL ─────────────────────────────────────────────────
export const conteudoSalSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  copy: z.string().default(""),
  briefing: z.string().default(""),
  formato: z.enum([
    "INSTAGRAM_FEED",
    "INSTAGRAM_STORIES",
    "INSTAGRAM_REELS",
    "LINKEDIN",
    "TIKTOK",
    "YOUTUBE",
    "NEWSLETTER",
    "BLOG_POST",
    "AD_CREATIVE",
  ]),
  status: z.enum(["RASCUNHO", "COPY_PRONTA", "DESIGN_PRONTO", "AGENDADO", "PUBLICADO"]).default("RASCUNHO"),
  pilar: z.string().max(60).optional().nullable().or(z.literal("")),
  dataPublicacao: z.coerce.date(),
  url: z.string().url().optional().nullable().or(z.literal("")),
});
export type ConteudoSalInput = z.infer<typeof conteudoSalSchema>;

// ─── Importação de relatórios ─────────────────────────────────────
// Dado bruto vindo do front: linhas já parseadas em JS objects, com
// chaves correspondentes às colunas normalizadas (lower-case sem
// espaços) do CSV. Validação fina (campos obrigatórios por fonte) é
// feita no mapeador, não aqui — aqui só garantimos shape básico.
export const importarRelatorioSchema = z.object({
  clienteId: z.string().min(1, "Cliente obrigatório"),
  fonte: z.enum(["REDES", "SEO", "TRAFEGO"]),
  /** Rows já normalizadas (chaves snake_case lower) vindas do parser */
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).min(1, "Cole pelo menos 1 linha"),
  /** Opcional: vincular a uma integração de Sheets (registra ultimaSync) */
  integracaoId: z.string().optional().nullable(),
  /** Modo de gravação: upsert (default — chave natural) ou append (sempre cria) */
  modo: z.enum(["upsert", "append"]).default("upsert"),
});
export type ImportarRelatorioInput = z.infer<typeof importarRelatorioSchema>;

// ─── Integração Sheets ─────────────────────────────────────────────
export const integracaoSheetsSchema = z.object({
  clienteId: z.string().min(1, "Cliente obrigatório"),
  fonte: z.enum(["REDES", "SEO", "TRAFEGO"]),
  sheetUrl: z
    .string()
    .url("URL inválida")
    .refine((u) => u.includes("docs.google.com/spreadsheets"), "Use URL do Google Sheets"),
  rotulo: z.string().max(120).optional().nullable().or(z.literal("")),
  ativo: z.boolean().default(true),
});
export type IntegracaoSheetsInput = z.infer<typeof integracaoSheetsSchema>;

// ─── Manual (Playbook + Marca) ─────────────────────────────────────
export const docSecaoSchema = z.object({
  tipo: z.enum(["PLAYBOOK", "MARCA", "HUB"]),
  titulo: z.string().min(1, "Título obrigatório").max(200),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífen"),
  conteudo: z.string().default(""),
  icone: z.string().max(40).optional().nullable().or(z.literal("")),
  ordem: z.coerce.number().int().default(0),
  publicada: z.boolean().default(true),
  parentId: z.string().optional().nullable(),
});
export type DocSecaoInput = z.infer<typeof docSecaoSchema>;

// Reorder em batch — usado pelo drag-drop na sidebar
export const docReordenarSchema = z.object({
  itens: z.array(
    z.object({
      id: z.string(),
      ordem: z.coerce.number().int(),
      parentId: z.string().nullable().optional(),
    })
  ),
});

// ─── Workspace: Páginas livres (estilo Notion) ─────────────────────
// `conteudo` é JSON do editor (Tiptap/BlockNote) serializado. Árvore
// hierárquica via parentId (self-relation Cascade no schema). Databases
// podem ser aninhados sob páginas (outro bloco — não tratado aqui).
export const pageSchema = z.object({
  titulo: z.string().min(1).max(200).default("Sem título"),
  icone: z.string().max(40).optional().nullable().or(z.literal("")),
  capaUrl: z.string().max(2_500_000).optional().nullable().or(z.literal("")),
  conteudo: z.string().default(""),
  parentId: z.string().optional().nullable(),
  ordem: z.coerce.number().int().default(0),
});
export type PageInput = z.infer<typeof pageSchema>;

// ─── Workspace: Databases (motor estilo Notion) ───────────────────
// Engine do comportamento por tipo vive em src/lib/database.ts. Aqui só
// validamos o shape de entrada da API. `config`/`valores` são Json livre
// (validados/coeridos em runtime pelo engine).
export const propertyTipoEnum = z.enum([
  "TEXTO",
  "NUMERO",
  "SELECT",
  "MULTISELECT",
  "DATA",
  "CHECKBOX",
  "URL",
  "RELACAO",
]);
export const viewTipoEnum = z.enum(["TABELA", "BOARD", "CALENDARIO"]);

export const databaseSchema = z.object({
  nome: z.string().min(1).max(200).default("Novo database"),
  icone: z.string().max(40).optional().nullable().or(z.literal("")),
  descricao: z.string().max(2000).optional().nullable().or(z.literal("")),
  parentPageId: z.string().optional().nullable(),
  ordem: z.coerce.number().int().default(0),
});
export type DatabaseInput = z.infer<typeof databaseSchema>;

export const databasePropertySchema = z.object({
  nome: z.string().min(1).max(120).default("Propriedade"),
  tipo: propertyTipoEnum.default("TEXTO"),
  config: z.unknown().optional().nullable(),
  ordem: z.coerce.number().int().default(0),
});
export type DatabasePropertyInput = z.infer<typeof databasePropertySchema>;

export const databaseRowSchema = z.object({
  // Merge parcial no Json — só as chaves enviadas são atualizadas.
  valores: z.record(z.string(), z.unknown()).optional(),
  ordem: z.coerce.number().int().optional(),
});
export type DatabaseRowInput = z.infer<typeof databaseRowSchema>;

export const databaseViewSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  config: z.unknown().optional().nullable(),
});
export type DatabaseViewInput = z.infer<typeof databaseViewSchema>;

// Criação de view: `tipo` obrigatório (TABELA/BOARD/CALENDARIO); nome default
// por tipo é aplicado no handler. config (Json livre) coerido na UI.
export const databaseViewCreateSchema = z.object({
  tipo: viewTipoEnum,
  nome: z.string().min(1).max(120).optional(),
  config: z.unknown().optional().nullable(),
  ordem: z.coerce.number().int().optional(),
});
export type DatabaseViewCreateInput = z.infer<typeof databaseViewCreateSchema>;

// ─── PublicShare ───────────────────────────────────────────────────
export const publicShareSchema = z.object({
  entidadeTipo: z.enum(["NOTA", "BRIEFING", "REUNIAO", "RELATORIO", "MANUAL_SECAO"]),
  entidadeId: z.string().min(1),
  expiraEm: z.coerce.date().optional().nullable(),
  senha: z.string().min(4).max(40).optional().or(z.literal("")),
  podeBaixarPdf: z.boolean().default(true),
});
export type PublicShareInput = z.infer<typeof publicShareSchema>;

// ─── Anexo (arquivo polimórfico) ──────────────────────────────────
// Anexável a qualquer entidade (REUNIAO/LEAD/CLIENTE/...). `url` aceita
// dataURL (upload até ~5MB) ou link externo/Drive. Mesmo padrão de
// upload de postArquivoSchema.
export const anexoSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(200),
  url: z.string().min(5, "URL ou arquivo inválido").max(5_000_000, "Arquivo muito grande (5MB max)"),
  tipo: z.enum(["IMAGEM", "VIDEO", "DOCUMENTO", "PLANILHA", "APRESENTACAO", "LINK", "OUTRO"]).default("DOCUMENTO"),
  tamanhoBytes: z.coerce.number().int().nonnegative().optional().nullable(),
  entidadeTipo: z.string().min(1).max(40),
  entidadeId: z.string().min(1),
  ordem: z.coerce.number().int().default(0),
});
export type AnexoInput = z.infer<typeof anexoSchema>;

// PATCH parcial — renomear/reordenar/recategorizar.
export const anexoPatchSchema = z.object({
  nome: z.string().min(1).max(200).optional(),
  ordem: z.coerce.number().int().optional(),
  tipo: z.enum(["IMAGEM", "VIDEO", "DOCUMENTO", "PLANILHA", "APRESENTACAO", "LINK", "OUTRO"]).optional(),
});
export type AnexoPatchInput = z.infer<typeof anexoPatchSchema>;
