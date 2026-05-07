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
});
export type PostInput = z.infer<typeof postSchema>;

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
