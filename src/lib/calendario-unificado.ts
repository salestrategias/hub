/**
 * Fetcher unificado pro calendário — agrega 6 tipos de evento numa
 * janela de tempo, com classificação por origem pra UI poder colorir
 * e filtrar.
 *
 * Tipos cobertos:
 *  - TAREFA            → dataEntrega
 *  - POST (cliente)    → dataPublicacao
 *  - CONTEUDO_SAL      → dataPublicacao
 *  - REUNIAO           → data
 *  - CONTRATO_VENCENDO → dataFim (só status=ATIVO)
 *  - PROPOSTA_EXPIRA   → enviadaEm + validadeDias (status=ENVIADA/VISTA)
 *
 * Decisões:
 *  - Janela default = 60 dias atrás → 90 dias à frente. Pode mudar via
 *    query params da API. Mantemos passado pra "histórico" de tarefas
 *    concluídas e reuniões realizadas.
 *  - Reagendamento (drag-drop) só funciona pra TAREFA, POST, CONTEUDO_SAL
 *    e REUNIAO. CONTRATO e PROPOSTA são "marcos" (não dá pra arrastar a
 *    data de vencimento) — desabilitamos drag desses no client.
 *  - Cada evento traz `href` pra abrir detalhe + `entidadeId` pra dar
 *    PATCH no endpoint correto durante reagendamento.
 */
import { prisma } from "@/lib/db";

export type CalendarioOrigem =
  | "TAREFA"
  | "POST"
  | "CONTEUDO_SAL"
  | "REUNIAO"
  | "CONTRATO_VENCENDO"
  | "PROPOSTA_EXPIRA";

export type CalendarioEvento = {
  id: string;                  // único por linha (origem + entidadeId)
  origem: CalendarioOrigem;
  entidadeId: string;          // id no banco da entidade fonte
  titulo: string;
  descricao: string | null;
  inicio: string;              // ISO
  fim: string;                 // ISO (= inicio + 30min default, ou data do evento)
  clienteId: string | null;
  clienteNome: string | null;
  href: string;                // rota pra abrir detalhe no Hub
  /** Permite drag-drop pra reagendar */
  reagendavel: boolean;
  /** Status visual: "concluido", "atrasado", "futuro" — usado pra cor */
  estado: "concluido" | "atrasado" | "futuro" | "marco";
  /** Cor base sugerida (hex) — UI pode override */
  cor: string;
};

const CORES: Record<CalendarioOrigem, string> = {
  TAREFA: "#3B82F6",            // azul
  POST: "#7E30E1",              // roxo SAL
  CONTEUDO_SAL: "#10B981",      // verde
  REUNIAO: "#F59E0B",           // âmbar
  CONTRATO_VENCENDO: "#EF4444", // vermelho
  PROPOSTA_EXPIRA: "#EC4899",   // rosa
};

export async function montarCalendarioUnificado(opts: {
  inicio?: Date;
  fim?: Date;
  filtros?: Set<CalendarioOrigem>;
  clienteId?: string;
} = {}): Promise<CalendarioEvento[]> {
  const hoje = new Date();
  const inicio = opts.inicio ?? new Date(hoje.getTime() - 60 * 24 * 3600_000);
  const fim = opts.fim ?? new Date(hoje.getTime() + 90 * 24 * 3600_000);
  const f = opts.filtros;
  const incluir = (o: CalendarioOrigem) => !f || f.has(o);

  const baseWhereCliente = opts.clienteId ? { clienteId: opts.clienteId } : {};

  const [tarefas, posts, conteudoSal, reunioes, contratos, propostas] = await Promise.all([
    // Tarefas com dataEntrega
    incluir("TAREFA")
      ? prisma.tarefa.findMany({
          where: {
            ...baseWhereCliente,
            dataEntrega: { gte: inicio, lte: fim, not: null },
          },
          include: { cliente: { select: { id: true, nome: true } } },
          take: 500,
        })
      : Promise.resolve([]),

    // Posts editorial cliente
    incluir("POST")
      ? prisma.post.findMany({
          where: {
            ...baseWhereCliente,
            dataPublicacao: { gte: inicio, lte: fim },
          },
          include: { cliente: { select: { id: true, nome: true } } },
          take: 500,
        })
      : Promise.resolve([]),

    // ConteudoSAL (sem clienteId — é da SAL)
    incluir("CONTEUDO_SAL") && !opts.clienteId
      ? prisma.conteudoSAL.findMany({
          where: { dataPublicacao: { gte: inicio, lte: fim } },
          take: 500,
        })
      : Promise.resolve([]),

    // Reuniões
    incluir("REUNIAO")
      ? prisma.reuniao.findMany({
          where: {
            ...baseWhereCliente,
            data: { gte: inicio, lte: fim },
          },
          include: { cliente: { select: { id: true, nome: true } } },
          take: 500,
        })
      : Promise.resolve([]),

    // Contratos vencendo — dataFim na janela
    incluir("CONTRATO_VENCENDO")
      ? prisma.contrato.findMany({
          where: {
            ...baseWhereCliente,
            status: "ATIVO",
            dataFim: { gte: inicio, lte: fim },
          },
          include: { cliente: { select: { id: true, nome: true } } },
          take: 100,
        })
      : Promise.resolve([]),

    // Propostas expirando — enviadaEm + validadeDias dentro da janela
    // SQL não calcula isso, fetch todas ENVIADA/VISTA e filtra em memória
    incluir("PROPOSTA_EXPIRA")
      ? prisma.proposta.findMany({
          where: {
            status: { in: ["ENVIADA", "VISTA"] },
            enviadaEm: { not: null },
            ...(opts.clienteId ? { clienteId: opts.clienteId } : {}),
          },
          include: { cliente: { select: { id: true, nome: true } } },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  const eventos: CalendarioEvento[] = [];

  for (const t of tarefas) {
    if (!t.dataEntrega) continue;
    const atrasada = !t.concluida && t.dataEntrega < hoje;
    eventos.push({
      id: `TAREFA:${t.id}`,
      origem: "TAREFA",
      entidadeId: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      inicio: t.dataEntrega.toISOString(),
      fim: t.dataEntrega.toISOString(),
      clienteId: t.cliente?.id ?? null,
      clienteNome: t.cliente?.nome ?? null,
      href: `/tarefas?tarefa=${t.id}`,
      reagendavel: !t.concluida,
      estado: t.concluida ? "concluido" : atrasada ? "atrasado" : "futuro",
      cor: t.concluida ? "#9CA3AF" : atrasada ? "#EF4444" : CORES.TAREFA,
    });
  }

  for (const p of posts) {
    eventos.push({
      id: `POST:${p.id}`,
      origem: "POST",
      entidadeId: p.id,
      titulo: `📣 ${p.titulo}`,
      descricao: p.legenda ?? null,
      inicio: p.dataPublicacao.toISOString(),
      fim: p.dataPublicacao.toISOString(),
      clienteId: p.cliente?.id ?? null,
      clienteNome: p.cliente?.nome ?? null,
      href: `/editorial?post=${p.id}`,
      reagendavel: p.status !== "PUBLICADO",
      estado: p.status === "PUBLICADO" ? "concluido" : "futuro",
      cor: p.status === "PUBLICADO" ? "#9CA3AF" : CORES.POST,
    });
  }

  for (const c of conteudoSal) {
    eventos.push({
      id: `CONTEUDO_SAL:${c.id}`,
      origem: "CONTEUDO_SAL",
      entidadeId: c.id,
      titulo: `✨ ${c.titulo}`,
      descricao: c.briefing,
      inicio: c.dataPublicacao.toISOString(),
      fim: c.dataPublicacao.toISOString(),
      clienteId: null,
      clienteNome: "SAL (conteúdo próprio)",
      href: `/conteudo-sal?conteudo=${c.id}`,
      reagendavel: c.status !== "PUBLICADO",
      estado: c.status === "PUBLICADO" ? "concluido" : "futuro",
      cor: c.status === "PUBLICADO" ? "#9CA3AF" : CORES.CONTEUDO_SAL,
    });
  }

  for (const r of reunioes) {
    const dur = r.duracaoSeg ?? 30 * 60;
    const fimDt = new Date(r.data.getTime() + dur * 1000);
    eventos.push({
      id: `REUNIAO:${r.id}`,
      origem: "REUNIAO",
      entidadeId: r.id,
      titulo: `🎙️ ${r.titulo}`,
      descricao: r.notasLivres,
      inicio: r.data.toISOString(),
      fim: fimDt.toISOString(),
      clienteId: r.cliente?.id ?? null,
      clienteNome: r.cliente?.nome ?? null,
      href: `/reunioes/${r.id}`,
      reagendavel: r.status !== "TRANSCRITA",
      estado: r.data < hoje ? "concluido" : "futuro",
      cor: r.data < hoje ? "#9CA3AF" : CORES.REUNIAO,
    });
  }

  for (const c of contratos) {
    const dias = Math.floor((c.dataFim.getTime() - hoje.getTime()) / (24 * 3600_000));
    eventos.push({
      id: `CONTRATO_VENCENDO:${c.id}`,
      origem: "CONTRATO_VENCENDO",
      entidadeId: c.id,
      titulo: `📅 Contrato vence — ${c.cliente.nome}`,
      descricao: `${dias >= 0 ? `Vence em ${dias}d` : `Venceu há ${Math.abs(dias)}d`}. Renove ou encerre.`,
      inicio: c.dataFim.toISOString(),
      fim: c.dataFim.toISOString(),
      clienteId: c.cliente.id,
      clienteNome: c.cliente.nome,
      href: `/contratos?contrato=${c.id}`,
      reagendavel: false,
      estado: "marco",
      cor: CORES.CONTRATO_VENCENDO,
    });
  }

  for (const p of propostas) {
    if (!p.enviadaEm) continue;
    const expira = new Date(p.enviadaEm.getTime() + p.validadeDias * 24 * 3600_000);
    if (expira < inicio || expira > fim) continue;
    eventos.push({
      id: `PROPOSTA_EXPIRA:${p.id}`,
      origem: "PROPOSTA_EXPIRA",
      entidadeId: p.id,
      titulo: `📨 Proposta expira — ${p.clienteNome}`,
      descricao: `${p.titulo} · ${p.validadeDias}d validade`,
      inicio: expira.toISOString(),
      fim: expira.toISOString(),
      clienteId: p.cliente?.id ?? null,
      clienteNome: p.clienteNome,
      href: `/propostas/${p.id}`,
      reagendavel: false,
      estado: "marco",
      cor: CORES.PROPOSTA_EXPIRA,
    });
  }

  return eventos;
}
