import bcrypt from "bcryptjs";
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Endpoint público que serve o conteúdo compartilhado via PublicShare.
 *
 * Suporta entidades NOTA, BRIEFING, REUNIAO, RELATORIO. Cada uma busca
 * o registro próprio e devolve formato limitado (só campos seguros).
 *
 * Igual ao de proposta, side effects (incrementar views, primeiroAcesso)
 * acontecem só após validar senha (se houver).
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  return handle(req, params.token, null);
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const body = (await req.json().catch(() => ({}))) as { senha?: string };
    return resolveShare(params.token, body.senha ?? null);
  });
}

function handle(_req: Request, token: string, senha: string | null) {
  return apiHandler(async () => resolveShare(token, senha));
}

async function resolveShare(token: string, senhaProvida: string | null) {
  const share = await prisma.publicShare.findUnique({ where: { token } });
  if (!share) throw new Error("Conteúdo não encontrado");
  if (share.expiraEm && share.expiraEm < new Date()) throw new Error("Este link expirou.");

  if (share.senha) {
    if (!senhaProvida) return { precisaSenha: true };
    const ok = await bcrypt.compare(senhaProvida, share.senha);
    if (!ok) throw new Error("Senha incorreta");
  }

  // Side effects
  void prisma.publicShare
    .update({
      where: { id: share.id },
      data: {
        views: { increment: 1 },
        primeiroAcesso: share.primeiroAcesso ?? new Date(),
        ultimoAcesso: new Date(),
      },
    })
    .catch(() => undefined);

  // Resolve entidade
  switch (share.entidadeTipo) {
    case "NOTA":
    case "BRIEFING": {
      const nota = await prisma.nota.findUnique({
        where: { id: share.entidadeId },
        select: { id: true, titulo: true, pasta: true, tags: true, conteudo: true, updatedAt: true },
      });
      if (!nota) throw new Error("Conteúdo não encontrado");
      return {
        tipo: share.entidadeTipo,
        titulo: nota.titulo,
        pasta: nota.pasta,
        tags: nota.tags,
        conteudo: nota.conteudo,
        atualizadoEm: nota.updatedAt.toISOString(),
        podeBaixarPdf: share.podeBaixarPdf,
      };
    }
    case "REUNIAO": {
      const reuniao = await prisma.reuniao.findUnique({
        where: { id: share.entidadeId },
        select: {
          id: true,
          titulo: true,
          data: true,
          resumoIA: true,
          notasLivres: true,
          actionItems: { select: { texto: true, responsavel: true, prazo: true, concluido: true } },
          cliente: { select: { nome: true } },
        },
      });
      if (!reuniao) throw new Error("Conteúdo não encontrado");
      return {
        tipo: "REUNIAO",
        titulo: reuniao.titulo,
        data: reuniao.data.toISOString(),
        cliente: reuniao.cliente?.nome ?? null,
        resumoIA: reuniao.resumoIA,
        notasLivres: reuniao.notasLivres,
        actionItems: reuniao.actionItems,
        podeBaixarPdf: share.podeBaixarPdf,
      };
    }
    case "MANUAL_SECAO": {
      const secao = await prisma.docSecao.findUnique({
        where: { id: share.entidadeId },
        select: {
          id: true, tipo: true, titulo: true, slug: true, icone: true,
          conteudo: true, updatedAt: true,
        },
      });
      if (!secao) throw new Error("Conteúdo não encontrado");
      return {
        tipo: "MANUAL_SECAO",
        tipoManual: secao.tipo,
        titulo: secao.titulo,
        slug: secao.slug,
        icone: secao.icone,
        conteudo: secao.conteudo,
        atualizadoEm: secao.updatedAt.toISOString(),
        podeBaixarPdf: share.podeBaixarPdf,
      };
    }
    default:
      throw new Error("Tipo de conteúdo não suportado");
  }
}
