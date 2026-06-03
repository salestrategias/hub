/**
 * Portal v2 — submissão de CRIATIVOS pelo cliente (caminho inverso).
 *
 * GET  /api/p/cliente/[token]/criativos-enviar  → lista as submissões DO
 *      PRÓPRIO cliente (origem=CLIENTE), com revisao + revisaoNota.
 *
 * POST /api/p/cliente/[token]/criativos-enviar  → cliente envia um criativo
 *      novo pra Marcelo revisar. Cria Criativo { origem=CLIENTE,
 *      revisao=PENDENTE, status=RASCUNHO } + arquivos, e notifica o criador
 *      do acesso.
 *
 * Rota separada de /criativos (que é o GET read-only de aprovação) pra não
 * colidir verbos/escopos. Auth: sessão do cliente + `podeEnviarConteudo`.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { portalCriativoSubmissaoSchema } from "@/lib/schemas";
import { cookies } from "next/headers";

function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeEnviarConteudo) return erro("Sem permissão pra enviar conteúdo", 403);

    const criativos = await prisma.criativo.findMany({
      where: { clienteId: r.cliente.id, origem: "CLIENTE" },
      include: {
        arquivos: {
          orderBy: { ordem: "asc" },
          select: { id: true, tipo: true, url: true, nome: true, legenda: true, ordem: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      criativos.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        plataforma: c.plataforma,
        formato: c.formato,
        textoPrincipal: c.textoPrincipal,
        headline: c.headline,
        revisao: c.revisao,
        revisaoNota: c.revisaoNota,
        arquivos: c.arquivos,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Erro", 401);
  }
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeEnviarConteudo) return erro("Sem permissão pra enviar conteúdo", 403);

    const data = portalCriativoSubmissaoSchema.parse(await req.json());

    const criativo = await prisma.criativo.create({
      data: {
        titulo: data.titulo,
        textoPrincipal: data.textoPrincipal || null,
        headline: data.headline || null,
        plataforma: data.plataforma,
        formato: data.formato,
        clienteId: r.cliente.id,
        origem: "CLIENTE",
        revisao: "PENDENTE",
        status: "RASCUNHO",
        arquivos: {
          create: data.arquivos.map((a, i) => ({
            tipo: a.tipo,
            url: a.url,
            nome: a.nome || null,
            legenda: a.legenda || null,
            ordem: a.ordem || (i + 1) * 10,
          })),
        },
      },
      select: { id: true, titulo: true },
    });

    // Tipo dedicado de evento inbound (não dispara email).
    await prisma.notificacao.create({
      data: {
        userId: r.acesso.criadoPor,
        tipo: "CLIENTE_SUBMETEU_CONTEUDO",
        titulo: `📥 ${r.cliente.nome} enviou um criativo pra revisão`,
        descricao: `"${criativo.titulo}" — aguardando sua revisão`,
        href: `/criativos?criativo=${criativo.id}`,
        entidadeTipo: "CRIATIVO",
        entidadeId: criativo.id,
        chave: `PORTAL_SUBMISSAO_CRIATIVO:${criativo.id}`,
      },
    });

    return NextResponse.json({ ok: true, id: criativo.id });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Validação falhou", issues: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg.includes("Sessão") || msg.includes("login") || msg.includes("desativado") ? 401 : 500;
    return erro(msg, status);
  }
}
