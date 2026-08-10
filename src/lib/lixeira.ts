/**
 * Hub 2.0 — Lixeira universal.
 *
 * Estratégia: em vez de soft-delete por tabela (deletedAt em tudo, todo
 * query filtrando), o DELETE tira um SNAPSHOT JSON completo da entidade
 * pra tabela LixeiraItem e só então apaga de verdade. Nenhuma query
 * existente precisa mudar; restaurar = recriar do snapshot.
 *
 * Tipos suportados (v1): TAREFA, NOTA, POST, LEAD, PROJETO, PAGE, PROPOSTA.
 * Fora do v1 (nested demais, avaliar depois): Reunião (blocks/actions/
 * capítulos), Database (properties/rows/views), Cliente (grafo inteiro).
 *
 * Restauração:
 *  - Recria com o MESMO id (snapshots preservam cuid) — links antigos voltam
 *  - FKs revalidadas: se o cliente/projeto/coluna referenciado sumiu,
 *    o campo vira null (mesmo comportamento do onDelete: SetNull)
 *  - Nested restaurado: checklist (tarefa), arquivos (post)
 *  - Proposta com numero em conflito ganha sufixo "-rest"
 *
 * Retenção: itens com mais de 30 dias são purgados no GET da lixeira.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type LixeiraTipo =
  | "TAREFA"
  | "NOTA"
  | "POST"
  | "LEAD"
  | "PROJETO"
  | "PAGE"
  | "PROPOSTA";

export const LIXEIRA_RETENCAO_DIAS = 30;

const TIPO_LABEL: Record<LixeiraTipo, string> = {
  TAREFA: "Tarefa",
  NOTA: "Nota",
  POST: "Post",
  LEAD: "Lead",
  PROJETO: "Projeto",
  PAGE: "Página",
  PROPOSTA: "Proposta",
};

export function labelDoTipo(tipo: string): string {
  return TIPO_LABEL[tipo as LixeiraTipo] ?? tipo;
}

/** Serializa Date/Decimal pra JSON estável (Prisma devolve objetos ricos). */
function serializar(obj: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(obj, (_k, v) => {
      // Decimal do Prisma tem toJSON próprio; Date vira ISO via JSON.stringify
      return v;
    })
  );
}

/**
 * Apaga a entidade COM passagem pela lixeira (snapshot antes do delete).
 * Se o snapshot falhar, aborta — nunca apaga sem cópia.
 */
export async function apagarComLixeira(
  tipo: LixeiraTipo,
  id: string,
  apagadoPor?: string | null
): Promise<void> {
  let titulo = "(sem título)";
  let dados: unknown = null;

  switch (tipo) {
    case "TAREFA": {
      const t = await prisma.tarefa.findUniqueOrThrow({
        where: { id },
        include: { checklist: { orderBy: { ordem: "asc" } } },
      });
      titulo = t.titulo;
      dados = t;
      break;
    }
    case "NOTA": {
      const n = await prisma.nota.findUniqueOrThrow({ where: { id } });
      titulo = n.titulo;
      dados = n;
      break;
    }
    case "POST": {
      const p = await prisma.post.findUniqueOrThrow({
        where: { id },
        include: { arquivos: { orderBy: { ordem: "asc" } } },
      });
      titulo = p.titulo;
      dados = p;
      break;
    }
    case "LEAD": {
      const l = await prisma.lead.findUniqueOrThrow({ where: { id } });
      titulo = l.empresa;
      dados = l;
      break;
    }
    case "PROJETO": {
      const p = await prisma.projeto.findUniqueOrThrow({ where: { id } });
      titulo = p.nome;
      dados = p;
      break;
    }
    case "PAGE": {
      const p = await prisma.page.findUniqueOrThrow({ where: { id } });
      titulo = p.titulo;
      dados = p;
      break;
    }
    case "PROPOSTA": {
      const p = await prisma.proposta.findUniqueOrThrow({ where: { id } });
      titulo = `${p.numero} — ${p.titulo}`;
      dados = p;
      break;
    }
  }

  await prisma.lixeiraItem.create({
    data: { tipo, titulo, dados: serializar(dados), apagadoPor: apagadoPor ?? null },
  });

  // Delete real — só depois do snapshot persistido
  switch (tipo) {
    case "TAREFA": await prisma.tarefa.delete({ where: { id } }); break;
    case "NOTA": await prisma.nota.delete({ where: { id } }); break;
    case "POST": await prisma.post.delete({ where: { id } }); break;
    case "LEAD": await prisma.lead.delete({ where: { id } }); break;
    case "PROJETO": await prisma.projeto.delete({ where: { id } }); break;
    case "PAGE": await prisma.page.delete({ where: { id } }); break;
    case "PROPOSTA": await prisma.proposta.delete({ where: { id } }); break;
  }
}

/** FK helper: retorna o id se o registro ainda existe, senão null. */
async function seExiste(
  tabela: "cliente" | "projeto" | "coluna" | "reuniao" | "lead" | "page" | "proposta" | "user",
  id: string | null | undefined
): Promise<string | null> {
  if (!id) return null;
  const found = await (prisma[tabela] as { findUnique: (a: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null> })
    .findUnique({ where: { id }, select: { id: true } });
  return found ? id : null;
}

type Snap = Record<string, unknown>;
const d = (v: unknown) => (v ? new Date(v as string) : null);

/**
 * Restaura um item da lixeira. Retorna rota de destino pra UI navegar.
 * Remove o item da lixeira só se a recriação der certo.
 */
export async function restaurarDaLixeira(lixeiraId: string): Promise<{ tipo: string; href: string }> {
  const item = await prisma.lixeiraItem.findUniqueOrThrow({ where: { id: lixeiraId } });
  const s = item.dados as Snap;
  const tipo = item.tipo as LixeiraTipo;
  let href = "/";

  switch (tipo) {
    case "TAREFA": {
      const checklist = (s.checklist as Snap[] | undefined) ?? [];
      await prisma.tarefa.create({
        data: {
          id: s.id as string,
          titulo: s.titulo as string,
          descricao: (s.descricao as string) ?? null,
          prioridade: (s.prioridade as "URGENTE" | "ALTA" | "NORMAL" | "BAIXA") ?? "NORMAL",
          dataEntrega: d(s.dataEntrega),
          concluida: Boolean(s.concluida),
          tipoDemanda: (s.tipoDemanda as "TRAFEGO" | "SEO" | "CONTEUDO" | "RELATORIO" | "ADMIN" | null) ?? null,
          ordemColuna: (s.ordemColuna as number) ?? 0,
          arquivadaEm: null,
          colunaId: await seExiste("coluna", s.colunaId as string | null),
          clienteId: await seExiste("cliente", s.clienteId as string | null),
          projetoId: await seExiste("projeto", s.projetoId as string | null),
          reuniaoId: await seExiste("reuniao", s.reuniaoId as string | null),
          checklist: {
            create: checklist.map((c) => ({
              texto: c.texto as string,
              concluido: Boolean(c.concluido),
              ordem: (c.ordem as number) ?? 0,
            })),
          },
        },
      });
      href = `/?tarefa=${s.id}`;
      break;
    }
    case "NOTA": {
      await prisma.nota.create({
        data: {
          id: s.id as string,
          titulo: s.titulo as string,
          pasta: (s.pasta as string) ?? "Inbox",
          conteudo: (s.conteudo as string) ?? "",
          tags: (s.tags as string[]) ?? [],
          favorita: Boolean(s.favorita),
        },
      });
      href = "/notas";
      break;
    }
    case "POST": {
      // Post.clienteId é obrigatório — sem o cliente, não tem como restaurar
      const clienteId = await seExiste("cliente", s.clienteId as string | null);
      if (!clienteId) {
        throw new Error("O cliente deste post foi excluído — não dá pra restaurar.");
      }
      const arquivos = (s.arquivos as Snap[] | undefined) ?? [];
      await prisma.post.create({
        data: {
          id: s.id as string,
          titulo: s.titulo as string,
          legenda: (s.legenda as string) ?? null,
          pilar: (s.pilar as string) ?? null,
          formato: (s.formato as "FEED" | "STORIES" | "REELS" | "CARROSSEL") ?? "FEED",
          canais: (s.canais as string[]) ?? [],
          status: (s.status as "RASCUNHO" | "COPY_PRONTA" | "DESIGN_PRONTO" | "AGENDADO" | "PUBLICADO") ?? "RASCUNHO",
          dataPublicacao: d(s.dataPublicacao) ?? new Date(),
          hashtags: (s.hashtags as string[]) ?? [],
          cta: (s.cta as string) ?? null,
          observacoesProducao: (s.observacoesProducao as string) ?? null,
          origem: (s.origem as "SAL" | "CLIENTE") ?? "SAL",
          clienteId,
          arquivos: {
            create: arquivos.map((a) => ({
              tipo: a.tipo as "IMAGEM" | "VIDEO" | "DOCUMENTO" | "LINK_EXTERNO",
              url: a.url as string,
              nome: (a.nome as string) ?? null,
              legenda: (a.legenda as string) ?? null,
              ordem: (a.ordem as number) ?? 0,
              enviadoPorCliente: Boolean(a.enviadoPorCliente),
            })),
          },
        },
      });
      href = `/editorial?post=${s.id}`;
      break;
    }
    case "LEAD": {
      // responsavel é FK obrigatória pra User — se sumiu, usa qualquer admin
      let responsavel = await seExiste("user", s.responsavel as string | null);
      if (!responsavel) {
        const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
        if (!admin) throw new Error("Nenhum usuário disponível pra assumir o lead.");
        responsavel = admin.id;
      }
      await prisma.lead.create({
        data: {
          id: s.id as string,
          empresa: s.empresa as string,
          contatoNome: (s.contatoNome as string) ?? null,
          contatoEmail: (s.contatoEmail as string) ?? null,
          contatoTelefone: (s.contatoTelefone as string) ?? null,
          segmento: (s.segmento as string) ?? null,
          porte: (s.porte as "SMALL" | "MID" | "LARGE" | null) ?? null,
          origem: (s.origem as string) ?? null,
          status: (s.status as "NOVO" | "QUALIFICACAO" | "DIAGNOSTICO" | "PROPOSTA_ENVIADA" | "NEGOCIACAO" | "GANHO" | "PERDIDO") ?? "NOVO",
          prioridade: (s.prioridade as "URGENTE" | "ALTA" | "NORMAL" | "BAIXA") ?? "NORMAL",
          valorEstimadoMensal: (s.valorEstimadoMensal as number | string | null) ?? null,
          duracaoEstimadaMeses: (s.duracaoEstimadaMeses as number) ?? null,
          notas: (s.notas as string) ?? null,
          proximaAcao: (s.proximaAcao as string) ?? null,
          proximaAcaoEm: d(s.proximaAcaoEm),
          tags: (s.tags as string[]) ?? [],
          score: (s.score as number) ?? 0,
          scoreManual: (s.scoreManual as number) ?? null,
          qualidadeIA: (s.qualidadeIA as number) ?? null,
          enriquecimentoIA: (s.enriquecimentoIA as Prisma.InputJsonValue) ?? undefined,
          enriquecimentoIAEm: d(s.enriquecimentoIAEm),
          clienteId: await seExiste("cliente", s.clienteId as string | null),
          convertidoEm: d(s.convertidoEm),
          motivoPerdido: (s.motivoPerdido as string) ?? null,
          responsavel,
        },
      });
      href = "/leads";
      break;
    }
    case "PROJETO": {
      await prisma.projeto.create({
        data: {
          id: s.id as string,
          nome: s.nome as string,
          descricao: (s.descricao as string) ?? null,
          prioridade: (s.prioridade as "URGENTE" | "ALTA" | "NORMAL" | "BAIXA") ?? "NORMAL",
          status: (s.status as "BRIEFING" | "PRODUCAO" | "REVISAO" | "APROVACAO" | "ENTREGUE") ?? "BRIEFING",
          dataEntrega: d(s.dataEntrega),
          ordem: (s.ordem as number) ?? 0,
          clienteId: await seExiste("cliente", s.clienteId as string | null),
        },
      });
      href = "/projetos";
      break;
    }
    case "PAGE": {
      await prisma.page.create({
        data: {
          id: s.id as string,
          titulo: (s.titulo as string) ?? "Sem título",
          icone: (s.icone as string) ?? null,
          capaUrl: (s.capaUrl as string) ?? null,
          conteudo: (s.conteudo as string) ?? "",
          ordem: (s.ordem as number) ?? 0,
          fixada: Boolean(s.fixada),
          arquivadaEm: null,
          parentId: await seExiste("page", s.parentId as string | null),
          criadoPor: (s.criadoPor as string) ?? null,
        },
      });
      href = `/workspace/${s.id}`;
      break;
    }
    case "PROPOSTA": {
      // numero é @unique — se já existe (ex: recriada manualmente), sufixa
      let numero = s.numero as string;
      const conflito = await prisma.proposta.findUnique({ where: { numero }, select: { id: true } });
      if (conflito) numero = `${numero}-rest`;
      // criadoPor obrigatório
      let criadoPor = await seExiste("user", s.criadoPor as string | null);
      if (!criadoPor) {
        const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
        if (!admin) throw new Error("Nenhum usuário disponível pra assumir a proposta.");
        criadoPor = admin.id;
      }
      await prisma.proposta.create({
        data: {
          id: s.id as string,
          numero,
          titulo: s.titulo as string,
          clienteNome: (s.clienteNome as string) ?? "",
          clienteEmail: (s.clienteEmail as string) ?? null,
          capa: (s.capa as string) ?? null,
          diagnostico: (s.diagnostico as string) ?? null,
          objetivo: (s.objetivo as string) ?? null,
          escopo: (s.escopo as string) ?? null,
          cronograma: (s.cronograma as string) ?? null,
          investimento: (s.investimento as string) ?? null,
          proximosPassos: (s.proximosPassos as string) ?? null,
          termos: (s.termos as string) ?? null,
          valorMensal: (s.valorMensal as number | string | null) ?? null,
          valorTotal: (s.valorTotal as number | string | null) ?? null,
          duracaoMeses: (s.duracaoMeses as number) ?? null,
          validadeDias: (s.validadeDias as number) ?? 30,
          logoUrl: (s.logoUrl as string) ?? null,
          corPrimaria: (s.corPrimaria as string) ?? null,
          capaImagemUrl: (s.capaImagemUrl as string) ?? null,
          extras: (s.extras as Prisma.InputJsonValue) ?? undefined,
          status: (s.status as "RASCUNHO" | "ENVIADA" | "VISTA" | "ACEITA" | "RECUSADA" | "EXPIRADA") ?? "RASCUNHO",
          versao: (s.versao as number) ?? 1,
          versaoAtual: Boolean(s.versaoAtual ?? true),
          motivoRevisao: (s.motivoRevisao as string) ?? null,
          versaoRaizId: await seExiste("proposta", s.versaoRaizId as string | null),
          clienteId: await seExiste("cliente", s.clienteId as string | null),
          leadId: await seExiste("lead", s.leadId as string | null),
          criadoPor,
        },
      });
      href = `/propostas/${s.id}`;
      break;
    }
    default:
      throw new Error(`Tipo "${item.tipo}" não tem restauração implementada.`);
  }

  await prisma.lixeiraItem.delete({ where: { id: lixeiraId } });
  return { tipo: item.tipo, href };
}

/** Purge lazy: apaga itens além da retenção. Chamado no GET da lixeira. */
export async function purgarLixeiraAntiga(): Promise<number> {
  const corte = new Date(Date.now() - LIXEIRA_RETENCAO_DIAS * 24 * 3600_000);
  const r = await prisma.lixeiraItem.deleteMany({ where: { createdAt: { lt: corte } } });
  return r.count;
}
