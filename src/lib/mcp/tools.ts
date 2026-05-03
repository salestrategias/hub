import { z } from "zod";
import { prisma } from "@/lib/db";
import { zodToJsonSchema } from "./zod-to-json";
import { hasScope } from "./scopes";
import type { ToolDefinition, ToolResult } from "./types";

const ok = (text: string): ToolResult => ({ content: [{ type: "text", text }] });
const okJson = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (message: string): ToolResult => ({ content: [{ type: "text", text: `Erro: ${message}` }], isError: true });

function tool<TInput>(def: Omit<ToolDefinition<TInput>, "jsonSchema">): ToolDefinition<TInput> {
  return { ...def, jsonSchema: zodToJsonSchema(def.inputSchema) };
}

const IdInput = z.object({ id: z.string() });

/* ─────────────────── CLIENTES ─────────────────── */
const ClienteListarInput = z.object({
  status: z.enum(["ATIVO", "INATIVO", "PROSPECT", "CHURNED"]).optional(),
  busca: z.string().optional().describe("Filtra por nome ou email"),
  comTag: z.string().optional().describe("Nome de uma tag para filtrar"),
});
const ClienteCriarInput = z.object({
  nome: z.string().min(2),
  cnpj: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO", "PROSPECT", "CHURNED"]).default("PROSPECT"),
  valorContratoMensal: z.number().min(0).default(0),
  notas: z.string().optional(),
  tags: z.array(z.string()).default([]).describe("Nomes de tags existentes para vincular"),
});
const ClienteAtualizarInput = z.object({
  id: z.string(),
  nome: z.string().min(2).optional(),
  cnpj: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO", "PROSPECT", "CHURNED"]).optional(),
  valorContratoMensal: z.number().min(0).optional(),
  notas: z.string().optional(),
});

const TOOLS: ToolDefinition<unknown>[] = [
  tool({
    name: "cliente_listar",
    description: "Lista clientes com filtros opcionais. Retorna nome, status, tags, valor mensal e contadores.",
    requiredScopes: ["clientes:read"],
    inputSchema: ClienteListarInput,
    handler: async (input) => {
      const { status, busca, comTag } = input;
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (busca) {
        where.OR = [
          { nome: { contains: busca, mode: "insensitive" } },
          { email: { contains: busca, mode: "insensitive" } },
        ];
      }
      if (comTag) where.tags = { some: { nome: comTag } };
      const clientes = await prisma.cliente.findMany({
        where,
        include: { tags: { select: { nome: true, cor: true } }, _count: { select: { posts: true, projetos: true, tarefas: true, contratos: true, reunioes: true } } },
        orderBy: { nome: "asc" },
      });
      return okJson(clientes.map((c) => ({
        id: c.id,
        nome: c.nome,
        status: c.status,
        valorContratoMensal: Number(c.valorContratoMensal),
        email: c.email,
        telefone: c.telefone,
        tags: c.tags.map((t) => t.nome),
        totais: c._count,
      })));
    },
  }),
  tool({
    name: "cliente_buscar",
    description: "Retorna detalhes completos de um cliente (use cliente_listar para descobrir o id).",
    requiredScopes: ["clientes:read"],
    inputSchema: IdInput,
    handler: async ({ id }) => {
      const c = await prisma.cliente.findUnique({
        where: { id },
        include: {
          tags: true,
          contratos: { orderBy: { dataFim: "desc" } },
          _count: { select: { posts: true, projetos: true, tarefas: true, contratos: true, reunioes: true, lancamentos: true } },
        },
      });
      if (!c) return fail(`Cliente ${id} não encontrado`);
      return okJson({
        ...c,
        valorContratoMensal: Number(c.valorContratoMensal),
        contratos: c.contratos.map((ct) => ({ ...ct, valor: Number(ct.valor) })),
      });
    },
  }),
  tool({
    name: "cliente_criar",
    description: "Cria um novo cliente. Use status='PROSPECT' para leads e 'ATIVO' para clientes em contrato.",
    requiredScopes: ["clientes:write"],
    inputSchema: ClienteCriarInput,
    handler: async (input) => {
      const { tags: tagNomes, ...dados } = input;
      const tagsExistentes = tagNomes?.length
        ? await prisma.tag.findMany({ where: { nome: { in: tagNomes } } })
        : [];
      const cliente = await prisma.cliente.create({
        data: {
          ...dados,
          tags: tagsExistentes.length ? { connect: tagsExistentes.map((t) => ({ id: t.id })) } : undefined,
        },
        include: { tags: true },
      });
      return ok(`Cliente "${cliente.nome}" criado com id ${cliente.id}.`);
    },
  }),
  tool({
    name: "cliente_atualizar",
    description: "Atualiza campos do cliente. Apenas os campos fornecidos são alterados.",
    requiredScopes: ["clientes:write"],
    inputSchema: ClienteAtualizarInput,
    handler: async ({ id, ...patch }) => {
      const cliente = await prisma.cliente.update({ where: { id }, data: patch });
      return ok(`Cliente "${cliente.nome}" atualizado.`);
    },
  }),
  tool({
    name: "cliente_excluir",
    description: "Remove um cliente e todos seus dados vinculados (posts, projetos, tarefas, contratos, lançamentos, métricas, reuniões). Ação destrutiva.",
    requiredScopes: ["clientes:write"],
    inputSchema: IdInput,
    handler: async ({ id }) => {
      const c = await prisma.cliente.delete({ where: { id } });
      return ok(`Cliente "${c.nome}" excluído.`);
    },
  }),

  /* ─────────────────── REUNIÕES ─────────────────── */
  tool({
    name: "reuniao_listar",
    description: "Lista reuniões com filtros. Retorna metadados (sem transcrição completa — use reuniao_buscar).",
    requiredScopes: ["reunioes:read"],
    inputSchema: z.object({
      clienteId: z.string().optional(),
      desde: z.string().optional().describe("Data ISO (yyyy-mm-dd)"),
      ate: z.string().optional(),
      limite: z.number().int().min(1).max(100).default(20),
    }),
    handler: async ({ clienteId, desde, ate, limite }) => {
      const where: Record<string, unknown> = {};
      if (clienteId) where.clienteId = clienteId;
      if (desde || ate) {
        where.data = {
          ...(desde ? { gte: new Date(desde) } : {}),
          ...(ate ? { lte: new Date(ate) } : {}),
        };
      }
      const reunioes = await prisma.reuniao.findMany({
        where,
        include: { cliente: { select: { id: true, nome: true } }, _count: { select: { actionItems: true, blocks: true } } },
        orderBy: { data: "desc" },
        take: limite,
      });
      return okJson(reunioes);
    },
  }),
  tool({
    name: "reuniao_buscar",
    description: "Retorna reunião com transcrição completa, action items e capítulos. Use para resumir, analisar ou extrair insights.",
    requiredScopes: ["reunioes:read"],
    inputSchema: IdInput,
    handler: async ({ id }) => {
      const r = await prisma.reuniao.findUnique({
        where: { id },
        include: {
          cliente: true,
          blocks: { orderBy: { ordem: "asc" } },
          actionItems: { orderBy: { ordem: "asc" } },
          capitulos: { orderBy: { ordem: "asc" } },
        },
      });
      if (!r) return fail(`Reunião ${id} não encontrada`);
      return okJson(r);
    },
  }),
  tool({
    name: "reuniao_criar",
    description: "Cria uma nova reunião. Use reuniao_adicionar_bloco depois para popular a transcrição.",
    requiredScopes: ["reunioes:write"],
    inputSchema: z.object({
      titulo: z.string().min(1),
      data: z.string().describe("Data/hora ISO (yyyy-mm-ddThh:mm)"),
      duracaoSeg: z.number().int().min(0).optional(),
      clienteId: z.string().optional(),
      participantes: z.array(z.string()).default([]),
      tagsLivres: z.array(z.string()).default([]),
      notasLivres: z.string().optional(),
      resumoIA: z.string().optional().describe("Resumo gerado pelo Claude"),
    }),
    handler: async (input) => {
      const r = await prisma.reuniao.create({
        data: {
          ...input,
          data: new Date(input.data),
          status: "TRANSCRITA",
        },
      });
      return ok(`Reunião "${r.titulo}" criada com id ${r.id}.`);
    },
  }),
  tool({
    name: "reuniao_adicionar_bloco",
    description: "Adiciona um bloco de transcrição (speaker + texto + timestamp). Útil para popular a transcrição linha por linha.",
    requiredScopes: ["reunioes:write"],
    inputSchema: z.object({
      reuniaoId: z.string(),
      timestamp: z.number().int().min(0).describe("Segundos desde o início"),
      speaker: z.string().min(1),
      speakerCor: z.string().optional().describe("Hex (#RRGGBB)"),
      texto: z.string().min(1),
    }),
    handler: async (input) => {
      const max = await prisma.reuniaoBlock.aggregate({
        where: { reuniaoId: input.reuniaoId },
        _max: { ordem: true },
      });
      await prisma.reuniaoBlock.create({
        data: { ...input, ordem: (max._max.ordem ?? 0) + 1 },
      });
      return ok("Bloco adicionado à transcrição.");
    },
  }),
  tool({
    name: "reuniao_adicionar_action",
    description: "Cria um action item vinculado à reunião. Use após resumir uma reunião para extrair tarefas.",
    requiredScopes: ["reunioes:write"],
    inputSchema: z.object({
      reuniaoId: z.string(),
      texto: z.string().min(1),
      responsavel: z.string().optional(),
      prazo: z.string().optional().describe("Texto livre, ex: 'até quinta'"),
    }),
    handler: async (input) => {
      const max = await prisma.reuniaoAction.aggregate({
        where: { reuniaoId: input.reuniaoId },
        _max: { ordem: true },
      });
      await prisma.reuniaoAction.create({
        data: { ...input, ordem: (max._max.ordem ?? 0) + 1 },
      });
      return ok(`Action item criado: "${input.texto}"`);
    },
  }),
  tool({
    name: "reuniao_atualizar",
    description: "Atualiza campos da reunião (resumo IA, notas, status, etc.).",
    requiredScopes: ["reunioes:write"],
    inputSchema: z.object({
      id: z.string(),
      resumoIA: z.string().optional(),
      notasLivres: z.string().optional(),
      status: z.enum(["GRAVANDO", "PROCESSANDO", "TRANSCRITA", "GRAVADA"]).optional(),
      tagsLivres: z.array(z.string()).optional(),
    }),
    handler: async ({ id, ...patch }) => {
      await prisma.reuniao.update({ where: { id }, data: patch });
      return ok("Reunião atualizada.");
    },
  }),
  tool({
    name: "reuniao_action_toggle",
    description: "Marca ou desmarca um action item como concluído.",
    requiredScopes: ["reunioes:write"],
    inputSchema: z.object({ actionId: z.string(), concluido: z.boolean() }),
    handler: async ({ actionId, concluido }) => {
      await prisma.reuniaoAction.update({ where: { id: actionId }, data: { concluido } });
      return ok(`Action item ${concluido ? "marcado como concluído" : "reaberto"}.`);
    },
  }),

  /* ─────────────────── NOTAS ─────────────────── */
  tool({
    name: "nota_listar",
    description: "Lista notas com busca e filtros por pasta/tag.",
    requiredScopes: ["notas:read"],
    inputSchema: z.object({
      busca: z.string().optional().describe("Texto a buscar em título e conteúdo"),
      pasta: z.string().optional(),
      tag: z.string().optional(),
      limite: z.number().int().min(1).max(100).default(30),
    }),
    handler: async ({ busca, pasta, tag, limite }) => {
      const where: Record<string, unknown> = {};
      if (pasta) where.pasta = pasta;
      if (tag) where.tags = { has: tag };
      if (busca) {
        where.OR = [
          { titulo: { contains: busca, mode: "insensitive" } },
          { conteudo: { contains: busca, mode: "insensitive" } },
        ];
      }
      const notas = await prisma.nota.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limite,
        select: { id: true, titulo: true, pasta: true, tags: true, favorita: true, updatedAt: true },
      });
      return okJson(notas);
    },
  }),
  tool({
    name: "nota_buscar",
    description: "Retorna o conteúdo markdown completo de uma nota.",
    requiredScopes: ["notas:read"],
    inputSchema: IdInput,
    handler: async ({ id }) => {
      const n = await prisma.nota.findUnique({ where: { id } });
      if (!n) return fail(`Nota ${id} não encontrada`);
      return okJson(n);
    },
  }),
  tool({
    name: "nota_criar",
    description: "Cria uma nota em formato markdown. Pode usar [[wikilinks]] e #tags inline no conteúdo.",
    requiredScopes: ["notas:write"],
    inputSchema: z.object({
      titulo: z.string().min(1),
      conteudo: z.string().default(""),
      pasta: z.string().default("Inbox"),
      tags: z.array(z.string()).default([]),
      favorita: z.boolean().default(false),
    }),
    handler: async (input) => {
      const n = await prisma.nota.create({ data: input });
      return ok(`Nota "${n.titulo}" criada com id ${n.id}.`);
    },
  }),
  tool({
    name: "nota_atualizar",
    description: "Atualiza uma nota existente. Sobrescreve o conteúdo se fornecido.",
    requiredScopes: ["notas:write"],
    inputSchema: z.object({
      id: z.string(),
      titulo: z.string().optional(),
      conteudo: z.string().optional(),
      pasta: z.string().optional(),
      tags: z.array(z.string()).optional(),
      favorita: z.boolean().optional(),
    }),
    handler: async ({ id, ...patch }) => {
      await prisma.nota.update({ where: { id }, data: patch });
      return ok("Nota atualizada.");
    },
  }),
  tool({
    name: "nota_excluir",
    description: "Remove uma nota permanentemente.",
    requiredScopes: ["notas:write"],
    inputSchema: IdInput,
    handler: async ({ id }) => {
      await prisma.nota.delete({ where: { id } });
      return ok("Nota excluída.");
    },
  }),
  tool({
    name: "nota_anexar",
    description: "Adiciona conteúdo ao final de uma nota existente (sem sobrescrever). Útil para acumular insights.",
    requiredScopes: ["notas:write"],
    inputSchema: z.object({ id: z.string(), conteudo: z.string().min(1) }),
    handler: async ({ id, conteudo }) => {
      const n = await prisma.nota.findUniqueOrThrow({ where: { id } });
      await prisma.nota.update({
        where: { id },
        data: { conteudo: `${n.conteudo}\n\n${conteudo}` },
      });
      return ok("Conteúdo anexado.");
    },
  }),

  /* ─────────────────── TAREFAS ─────────────────── */
  tool({
    name: "tarefa_listar",
    description: "Lista tarefas com filtros. Suporta filtro por cliente, status (concluída) e prazo.",
    requiredScopes: ["tarefas:read"],
    inputSchema: z.object({
      clienteId: z.string().optional(),
      concluida: z.boolean().optional(),
      atrasadas: z.boolean().optional().describe("Apenas tarefas com dataEntrega < hoje e não concluídas"),
      limite: z.number().int().min(1).max(100).default(50),
    }),
    handler: async ({ clienteId, concluida, atrasadas, limite }) => {
      const where: Record<string, unknown> = {};
      if (clienteId) where.clienteId = clienteId;
      if (concluida !== undefined) where.concluida = concluida;
      if (atrasadas) {
        where.concluida = false;
        where.dataEntrega = { lt: new Date() };
      }
      const tarefas = await prisma.tarefa.findMany({
        where,
        include: { cliente: { select: { nome: true } }, projeto: { select: { nome: true } }, _count: { select: { checklist: true } } },
        orderBy: [{ concluida: "asc" }, { dataEntrega: "asc" }],
        take: limite,
      });
      return okJson(tarefas);
    },
  }),
  tool({
    name: "tarefa_criar",
    description: "Cria uma nova tarefa. Pode vincular a cliente e/ou projeto.",
    requiredScopes: ["tarefas:write"],
    inputSchema: z.object({
      titulo: z.string().min(1),
      descricao: z.string().optional(),
      prioridade: z.enum(["URGENTE", "ALTA", "NORMAL", "BAIXA"]).default("NORMAL"),
      dataEntrega: z.string().optional().describe("ISO datetime"),
      clienteId: z.string().optional(),
      projetoId: z.string().optional(),
    }),
    handler: async (input) => {
      const t = await prisma.tarefa.create({
        data: { ...input, dataEntrega: input.dataEntrega ? new Date(input.dataEntrega) : null },
      });
      return ok(`Tarefa "${t.titulo}" criada com id ${t.id}.`);
    },
  }),
  tool({
    name: "tarefa_atualizar",
    description: "Atualiza uma tarefa (status, prazo, prioridade, descrição).",
    requiredScopes: ["tarefas:write"],
    inputSchema: z.object({
      id: z.string(),
      titulo: z.string().optional(),
      descricao: z.string().optional(),
      prioridade: z.enum(["URGENTE", "ALTA", "NORMAL", "BAIXA"]).optional(),
      dataEntrega: z.string().optional().nullable(),
      concluida: z.boolean().optional(),
    }),
    handler: async ({ id, dataEntrega, ...patch }) => {
      await prisma.tarefa.update({
        where: { id },
        data: {
          ...patch,
          ...(dataEntrega !== undefined ? { dataEntrega: dataEntrega ? new Date(dataEntrega) : null } : {}),
        },
      });
      return ok("Tarefa atualizada.");
    },
  }),
  tool({
    name: "tarefa_excluir",
    description: "Remove uma tarefa.",
    requiredScopes: ["tarefas:write"],
    inputSchema: IdInput,
    handler: async ({ id }) => {
      await prisma.tarefa.delete({ where: { id } });
      return ok("Tarefa excluída.");
    },
  }),

  /* ─────────────────── POSTS / EDITORIAL ─────────────────── */
  tool({
    name: "post_listar",
    description: "Lista posts do calendário editorial.",
    requiredScopes: ["editorial:read"],
    inputSchema: z.object({
      clienteId: z.string().optional(),
      status: z.enum(["RASCUNHO", "COPY_PRONTA", "DESIGN_PRONTO", "AGENDADO", "PUBLICADO"]).optional(),
      desde: z.string().optional(),
      ate: z.string().optional(),
      limite: z.number().int().min(1).max(100).default(50),
    }),
    handler: async ({ clienteId, status, desde, ate, limite }) => {
      const where: Record<string, unknown> = {};
      if (clienteId) where.clienteId = clienteId;
      if (status) where.status = status;
      if (desde || ate) {
        where.dataPublicacao = {
          ...(desde ? { gte: new Date(desde) } : {}),
          ...(ate ? { lte: new Date(ate) } : {}),
        };
      }
      const posts = await prisma.post.findMany({
        where,
        include: { cliente: { select: { nome: true } } },
        orderBy: { dataPublicacao: "asc" },
        take: limite,
      });
      return okJson(posts);
    },
  }),
  tool({
    name: "post_criar",
    description: "Cria um post no calendário editorial.",
    requiredScopes: ["editorial:write"],
    inputSchema: z.object({
      titulo: z.string().min(1),
      legenda: z.string().optional(),
      pilar: z.string().optional(),
      formato: z.enum(["FEED", "STORIES", "REELS", "CARROSSEL"]).default("FEED"),
      status: z.enum(["RASCUNHO", "COPY_PRONTA", "DESIGN_PRONTO", "AGENDADO", "PUBLICADO"]).default("RASCUNHO"),
      dataPublicacao: z.string().describe("ISO datetime"),
      clienteId: z.string(),
    }),
    handler: async (input) => {
      const p = await prisma.post.create({
        data: { ...input, dataPublicacao: new Date(input.dataPublicacao) },
      });
      return ok(`Post "${p.titulo}" criado com id ${p.id}.`);
    },
  }),
  tool({
    name: "post_atualizar",
    description: "Atualiza um post (status, legenda, data, formato).",
    requiredScopes: ["editorial:write"],
    inputSchema: z.object({
      id: z.string(),
      titulo: z.string().optional(),
      legenda: z.string().optional(),
      pilar: z.string().optional(),
      formato: z.enum(["FEED", "STORIES", "REELS", "CARROSSEL"]).optional(),
      status: z.enum(["RASCUNHO", "COPY_PRONTA", "DESIGN_PRONTO", "AGENDADO", "PUBLICADO"]).optional(),
      dataPublicacao: z.string().optional(),
    }),
    handler: async ({ id, dataPublicacao, ...patch }) => {
      await prisma.post.update({
        where: { id },
        data: { ...patch, ...(dataPublicacao ? { dataPublicacao: new Date(dataPublicacao) } : {}) },
      });
      return ok("Post atualizado.");
    },
  }),

  /* ─────────────────── PROJETOS ─────────────────── */
  tool({
    name: "projeto_listar",
    description: "Lista projetos do Kanban com seu status atual.",
    requiredScopes: ["projetos:read"],
    inputSchema: z.object({
      clienteId: z.string().optional(),
      status: z.enum(["BRIEFING", "PRODUCAO", "REVISAO", "APROVACAO", "ENTREGUE"]).optional(),
    }),
    handler: async ({ clienteId, status }) => {
      const projetos = await prisma.projeto.findMany({
        where: { ...(clienteId ? { clienteId } : {}), ...(status ? { status } : {}) },
        include: { cliente: { select: { nome: true } }, _count: { select: { tarefas: true } } },
        orderBy: { updatedAt: "desc" },
      });
      return okJson(projetos);
    },
  }),
  tool({
    name: "projeto_criar",
    description: "Cria um novo projeto no Kanban.",
    requiredScopes: ["projetos:write"],
    inputSchema: z.object({
      nome: z.string().min(1),
      descricao: z.string().optional(),
      prioridade: z.enum(["URGENTE", "ALTA", "NORMAL", "BAIXA"]).default("NORMAL"),
      status: z.enum(["BRIEFING", "PRODUCAO", "REVISAO", "APROVACAO", "ENTREGUE"]).default("BRIEFING"),
      dataEntrega: z.string().optional(),
      clienteId: z.string().optional(),
    }),
    handler: async (input) => {
      const p = await prisma.projeto.create({
        data: { ...input, dataEntrega: input.dataEntrega ? new Date(input.dataEntrega) : null },
      });
      return ok(`Projeto "${p.nome}" criado com id ${p.id}.`);
    },
  }),
  tool({
    name: "projeto_mover",
    description: "Move um projeto para outro status do Kanban (ex: PRODUCAO → REVISAO).",
    requiredScopes: ["projetos:write"],
    inputSchema: z.object({
      id: z.string(),
      status: z.enum(["BRIEFING", "PRODUCAO", "REVISAO", "APROVACAO", "ENTREGUE"]),
    }),
    handler: async ({ id, status }) => {
      await prisma.projeto.update({ where: { id }, data: { status } });
      return ok(`Projeto movido para ${status}.`);
    },
  }),

  /* ─────────────────── CONTRATOS ─────────────────── */
  tool({
    name: "contrato_listar",
    description: "Lista contratos. Útil para checar vencimentos próximos.",
    requiredScopes: ["contratos:read"],
    inputSchema: z.object({
      clienteId: z.string().optional(),
      vencendoEmDias: z.number().int().min(1).max(365).optional().describe("Filtra contratos ativos vencendo em até N dias"),
    }),
    handler: async ({ clienteId, vencendoEmDias }) => {
      const where: Record<string, unknown> = {};
      if (clienteId) where.clienteId = clienteId;
      if (vencendoEmDias) {
        const limite = new Date();
        limite.setDate(limite.getDate() + vencendoEmDias);
        where.status = "ATIVO";
        where.dataFim = { gte: new Date(), lte: limite };
      }
      const contratos = await prisma.contrato.findMany({
        where,
        include: { cliente: { select: { nome: true } } },
        orderBy: { dataFim: "asc" },
      });
      return okJson(contratos.map((c) => ({ ...c, valor: Number(c.valor) })));
    },
  }),
  tool({
    name: "contrato_criar",
    description: "Cria um contrato novo. Cria automaticamente um evento de aviso 30 dias antes do vencimento na agenda.",
    requiredScopes: ["contratos:write"],
    inputSchema: z.object({
      clienteId: z.string(),
      valor: z.number().min(0),
      dataInicio: z.string(),
      dataFim: z.string(),
      status: z.enum(["ATIVO", "ENCERRADO", "EM_RENOVACAO", "CANCELADO"]).default("ATIVO"),
      multaRescisoria: z.string().optional(),
      reajuste: z.string().default("IGP-M"),
      observacoes: z.string().optional(),
    }),
    handler: async (input) => {
      const c = await prisma.contrato.create({
        data: { ...input, dataInicio: new Date(input.dataInicio), dataFim: new Date(input.dataFim) },
      });
      return ok(`Contrato criado com id ${c.id}.`);
    },
  }),

  /* ─────────────────── FINANCEIRO ─────────────────── */
  tool({
    name: "lancamento_listar",
    description: "Lista lançamentos financeiros (receitas/despesas).",
    requiredScopes: ["financeiro:read"],
    inputSchema: z.object({
      entidade: z.enum(["PJ", "PF"]).optional(),
      tipo: z.enum(["RECEITA", "DESPESA"]).optional(),
      clienteId: z.string().optional(),
      desde: z.string().optional(),
      ate: z.string().optional(),
      limite: z.number().int().min(1).max(200).default(50),
    }),
    handler: async ({ entidade, tipo, clienteId, desde, ate, limite }) => {
      const where: Record<string, unknown> = {};
      if (entidade) where.entidade = entidade;
      if (tipo) where.tipo = tipo;
      if (clienteId) where.clienteId = clienteId;
      if (desde || ate) {
        where.data = {
          ...(desde ? { gte: new Date(desde) } : {}),
          ...(ate ? { lte: new Date(ate) } : {}),
        };
      }
      const ls = await prisma.lancamento.findMany({
        where,
        include: { cliente: { select: { nome: true } } },
        orderBy: { data: "desc" },
        take: limite,
      });
      return okJson(ls.map((l) => ({ ...l, valor: Number(l.valor) })));
    },
  }),
  tool({
    name: "lancamento_criar",
    description: "Cria um lançamento financeiro.",
    requiredScopes: ["financeiro:write"],
    inputSchema: z.object({
      descricao: z.string().min(1),
      valor: z.number(),
      tipo: z.enum(["RECEITA", "DESPESA"]),
      categoria: z.string().optional(),
      data: z.string(),
      recorrente: z.boolean().default(false),
      entidade: z.enum(["PJ", "PF"]).default("PJ"),
      clienteId: z.string().optional(),
    }),
    handler: async (input) => {
      const l = await prisma.lancamento.create({
        data: { ...input, data: new Date(input.data) },
      });
      return ok(`Lançamento "${l.descricao}" criado com id ${l.id}.`);
    },
  }),
  tool({
    name: "metricas_financeiras",
    description: "Retorna MRR atual, receitas/despesas do mês, lucro e projeção 3 meses para PJ.",
    requiredScopes: ["financeiro:read"],
    inputSchema: z.object({}),
    handler: async () => {
      const [clientesAtivos, lancsMes] = await Promise.all([
        prisma.cliente.findMany({ where: { status: "ATIVO" }, select: { valorContratoMensal: true } }),
        prisma.lancamento.findMany({
          where: {
            entidade: "PJ",
            data: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
        }),
      ]);
      const mrr = clientesAtivos.reduce((s, c) => s + Number(c.valorContratoMensal), 0);
      const receita = lancsMes.filter((l) => l.tipo === "RECEITA").reduce((s, l) => s + Number(l.valor), 0);
      const despesa = lancsMes.filter((l) => l.tipo === "DESPESA").reduce((s, l) => s + Number(l.valor), 0);
      const lucro = receita - despesa;
      return okJson({ mrr, receitaDoMes: receita, despesaDoMes: despesa, lucroDoMes: lucro, projecao3Meses: lucro * 3 });
    },
  }),

  /* ─────────────────── AGENDA ─────────────────── */
  tool({
    name: "agenda_proximos_eventos",
    description: "Lista os próximos eventos agendados localmente (espelho da Google Agenda).",
    requiredScopes: ["agenda:read"],
    inputSchema: z.object({ limite: z.number().int().min(1).max(50).default(10) }),
    handler: async ({ limite }) => {
      const eventos = await prisma.eventoAgenda.findMany({
        where: { inicio: { gte: new Date() } },
        orderBy: { inicio: "asc" },
        take: limite,
      });
      return okJson(eventos);
    },
  }),

  /* ─────────────────── BUSCA UNIVERSAL ─────────────────── */
  tool({
    name: "buscar_tudo",
    description: "Busca uma string em todos os módulos relevantes: clientes, notas, reuniões (em transcrições e resumos), tarefas e posts. Retorna resumo agrupado por tipo.",
    requiredScopes: ["busca:read"],
    inputSchema: z.object({ query: z.string().min(2), limite: z.number().int().min(1).max(20).default(10) }),
    handler: async ({ query, limite }) => {
      const q = query.trim();
      const [clientes, notas, reunioes, blocks, tarefas, posts] = await Promise.all([
        prisma.cliente.findMany({
          where: { OR: [{ nome: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
          select: { id: true, nome: true, status: true },
          take: limite,
        }),
        prisma.nota.findMany({
          where: { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { conteudo: { contains: q, mode: "insensitive" } }] },
          select: { id: true, titulo: true, pasta: true },
          take: limite,
        }),
        prisma.reuniao.findMany({
          where: { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { resumoIA: { contains: q, mode: "insensitive" } }] },
          select: { id: true, titulo: true, data: true },
          take: limite,
        }),
        prisma.reuniaoBlock.findMany({
          where: { texto: { contains: q, mode: "insensitive" } },
          select: { reuniaoId: true, speaker: true, texto: true, timestamp: true, reuniao: { select: { titulo: true } } },
          take: limite,
        }),
        prisma.tarefa.findMany({
          where: { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { descricao: { contains: q, mode: "insensitive" } }] },
          select: { id: true, titulo: true, concluida: true },
          take: limite,
        }),
        prisma.post.findMany({
          where: { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { legenda: { contains: q, mode: "insensitive" } }] },
          select: { id: true, titulo: true, status: true },
          take: limite,
        }),
      ]);
      return okJson({ clientes, notas, reunioes, trechosTranscricao: blocks, tarefas, posts });
    },
  }),
];

export const toolRegistry: Map<string, ToolDefinition<unknown>> = new Map(TOOLS.map((t) => [t.name, t]));

/** Lista de tools filtradas pelos escopos do token. */
export function listToolsForScopes(scopes: string[]) {
  return TOOLS.filter((t) => hasScope(scopes, t.requiredScopes)).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.jsonSchema,
  }));
}

export function canCallTool(scopes: string[], toolName: string): { allowed: boolean; required: readonly string[] } {
  const tool = toolRegistry.get(toolName);
  if (!tool) return { allowed: false, required: [] };
  return { allowed: hasScope(scopes, tool.requiredScopes), required: tool.requiredScopes };
}
