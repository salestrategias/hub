/**
 * Gerador de notificações in-app — varre regras e cria/atualiza linhas
 * em `Notificacao` de forma idempotente.
 *
 * Regras cobertas:
 *  - Contrato vencendo (60 / 30 / 15 / 7 dias antes da dataFim)
 *  - Action item de reunião atrasado (prazo string parseável + concluido=false)
 *  - Tarefa atrasada (URGENTE/ALTA, dataEntrega < hoje, concluida=false)
 *  - Reunião hoje (data entre início e fim do dia)
 *  - Post agendado pra hoje (dataPublicacao no dia)
 *
 * Chave de idempotência: cada notificação tem `chave` única = combinação
 * estável de tipo + entidadeId + dia (YYYY-MM-DD). Rodar duas vezes no
 * mesmo dia é no-op.
 *
 * Performance: chamado on-demand quando user abre dashboard/sininho.
 * Como o volume é pequeno (dezenas de contratos/tarefas), as queries
 * paralelas executam em < 200ms tipicamente.
 */
import { prisma } from "@/lib/db";
import type { TipoNotificacao } from "@prisma/client";

type NotificacaoSeed = {
  tipo: TipoNotificacao;
  titulo: string;
  descricao?: string;
  href?: string;
  entidadeTipo?: string;
  entidadeId?: string;
  chave: string;
};

const HOJE_KEY = () => new Date().toISOString().slice(0, 10);

/**
 * Roda todas as regras pra um usuário e persiste as notificações novas.
 * Retorna stats de quantas foram criadas / já existentes.
 */
export async function gerarNotificacoes(userId: string): Promise<{ criadas: number; existentes: number }> {
  const seeds: NotificacaoSeed[] = [];
  const hoje = HOJE_KEY();

  await Promise.all([
    coletarContratosVencendo(seeds, hoje),
    coletarActionItemsAtrasados(seeds, hoje),
    coletarTarefasAtrasadas(seeds, hoje),
    coletarReunioesHoje(seeds, hoje),
    coletarPostsHoje(seeds, hoje),
  ]);

  if (seeds.length === 0) return { criadas: 0, existentes: 0 };

  // upsert idempotente: insertMany com skipDuplicates aproveita @@unique(userId, chave)
  const result = await prisma.notificacao.createMany({
    data: seeds.map((s) => ({ ...s, userId })),
    skipDuplicates: true,
  });

  return { criadas: result.count, existentes: seeds.length - result.count };
}

// ─── Regras ──────────────────────────────────────────────────────

async function coletarContratosVencendo(seeds: NotificacaoSeed[], hoje: string): Promise<void> {
  const thresholds = [60, 30, 15, 7];
  const hojeDt = new Date();
  hojeDt.setHours(0, 0, 0, 0);

  // Limite máximo: 60 dias à frente
  const max = new Date(hojeDt);
  max.setDate(max.getDate() + Math.max(...thresholds));

  const contratos = await prisma.contrato.findMany({
    where: {
      status: "ATIVO",
      dataFim: { gte: hojeDt, lte: max },
    },
    include: { cliente: { select: { id: true, nome: true } } },
  });

  for (const c of contratos) {
    const dias = diasAte(c.dataFim, hojeDt);
    // Match com o threshold mais próximo (que ainda não passou)
    const threshold = thresholds.find((t) => dias === t);
    if (threshold === undefined) continue;

    seeds.push({
      tipo: "CONTRATO_VENCENDO",
      titulo: `Contrato ${c.cliente.nome} vence em ${threshold} dias`,
      descricao: `Vencimento: ${c.dataFim.toLocaleDateString("pt-BR")}`,
      href: `/contratos?contrato=${c.id}`,
      entidadeTipo: "CONTRATO",
      entidadeId: c.id,
      chave: `CONTRATO_VENCENDO:${c.id}:${threshold}d:${hoje}`,
    });
  }
}

async function coletarActionItemsAtrasados(seeds: NotificacaoSeed[], hoje: string): Promise<void> {
  // ReuniaoAction.prazo é string livre — não dá pra filtrar via SQL deterministicamente.
  // Fetch open + filtro em memória, regex pra DD/MM/YYYY ou DD/MM
  const abertos = await prisma.reuniaoAction.findMany({
    where: { concluido: false, prazo: { not: null } },
    include: { reuniao: { select: { id: true, titulo: true, cliente: { select: { nome: true } } } } },
    take: 100,
  });

  const hojeDt = new Date();
  hojeDt.setHours(0, 0, 0, 0);

  for (const a of abertos) {
    const prazoDt = parsePrazoLivre(a.prazo!);
    if (!prazoDt) continue;
    if (prazoDt >= hojeDt) continue;

    const diasAtraso = Math.floor((hojeDt.getTime() - prazoDt.getTime()) / (1000 * 60 * 60 * 24));

    seeds.push({
      tipo: "ACTION_ITEM_ATRASADO",
      titulo: `Action item atrasado · ${a.reuniao.cliente?.nome ?? "Reunião interna"}`,
      descricao: `${a.texto.slice(0, 80)}${a.texto.length > 80 ? "…" : ""} · ${diasAtraso}d atrasado`,
      href: `/reunioes/${a.reuniao.id}`,
      entidadeTipo: "REUNIAO_ACTION",
      entidadeId: a.id,
      chave: `ACTION_ITEM_ATRASADO:${a.id}:${hoje}`,
    });
  }
}

async function coletarTarefasAtrasadas(seeds: NotificacaoSeed[], hoje: string): Promise<void> {
  const hojeDt = new Date();
  hojeDt.setHours(0, 0, 0, 0);

  const tarefas = await prisma.tarefa.findMany({
    where: {
      concluida: false,
      prioridade: { in: ["URGENTE", "ALTA"] },
      dataEntrega: { lt: hojeDt },
    },
    include: { cliente: { select: { nome: true } } },
    take: 50,
  });

  for (const t of tarefas) {
    const dias = Math.floor((hojeDt.getTime() - (t.dataEntrega?.getTime() ?? 0)) / (1000 * 60 * 60 * 24));
    seeds.push({
      tipo: "TAREFA_ATRASADA",
      titulo: `${t.prioridade === "URGENTE" ? "🔴" : "🟠"} Tarefa atrasada · ${t.titulo}`,
      descricao: `${t.cliente?.nome ?? "Sem cliente"} · ${dias}d em atraso`,
      href: `/tarefas?tarefa=${t.id}`,
      entidadeTipo: "TAREFA",
      entidadeId: t.id,
      chave: `TAREFA_ATRASADA:${t.id}:${hoje}`,
    });
  }
}

async function coletarReunioesHoje(seeds: NotificacaoSeed[], hoje: string): Promise<void> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);

  const reunioes = await prisma.reuniao.findMany({
    where: { data: { gte: inicio, lt: fim } },
    include: { cliente: { select: { nome: true } } },
    orderBy: { data: "asc" },
    take: 20,
  });

  for (const r of reunioes) {
    const horario = r.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    seeds.push({
      tipo: "REUNIAO_HOJE",
      titulo: `Reunião hoje às ${horario} · ${r.cliente?.nome ?? "Interna"}`,
      descricao: r.titulo,
      href: `/reunioes/${r.id}`,
      entidadeTipo: "REUNIAO",
      entidadeId: r.id,
      chave: `REUNIAO_HOJE:${r.id}:${hoje}`,
    });
  }
}

async function coletarPostsHoje(seeds: NotificacaoSeed[], hoje: string): Promise<void> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);

  const posts = await prisma.post.findMany({
    where: {
      dataPublicacao: { gte: inicio, lt: fim },
      // PostStatus = RASCUNHO | COPY_PRONTA | DESIGN_PRONTO | AGENDADO | PUBLICADO.
      // Notificamos para o que está pronto (DESIGN_PRONTO) ou agendado mas
      // ainda não publicado.
      status: { in: ["AGENDADO", "DESIGN_PRONTO"] },
    },
    include: { cliente: { select: { nome: true } } },
    take: 20,
  });

  for (const p of posts) {
    seeds.push({
      tipo: "POST_HOJE",
      titulo: `Post hoje · ${p.cliente?.nome ?? "Sem cliente"}`,
      descricao: `${p.titulo ?? "(sem título)"} · status ${p.status.toLowerCase()}`,
      href: `/editorial?post=${p.id}`,
      entidadeTipo: "POST",
      entidadeId: p.id,
      chave: `POST_HOJE:${p.id}:${hoje}`,
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function diasAte(target: Date, base: Date): number {
  const diff = target.getTime() - base.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Parser leve para `prazo` livre digitado em ações (ex: "12/05", "até 15/05/2026", "amanhã").
 * Retorna Date ou null se não consegue interpretar.
 *
 * Casos cobertos:
 *  - DD/MM (assume ano corrente)
 *  - DD/MM/YYYY (ou YY)
 *  - "amanha" / "amanhã"
 *  - "hoje"
 */
function parsePrazoLivre(prazo: string): Date | null {
  const s = prazo.toLowerCase().trim();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (s.includes("amanh")) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (s.includes("hoje")) return hoje;

  // DD/MM ou DD/MM/YYYY ou DD/MM/YY
  const m = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10) - 1;
    let ano = m[3] ? parseInt(m[3], 10) : hoje.getFullYear();
    if (ano < 100) ano += 2000;
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}
