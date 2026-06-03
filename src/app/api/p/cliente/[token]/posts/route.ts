/**
 * Portal v2 — submissão de POSTS pelo cliente (caminho inverso).
 *
 * GET  /api/p/cliente/[token]/posts   → lista as submissões DO PRÓPRIO
 *      cliente (origem=CLIENTE), com revisao + revisaoNota, pra ele
 *      acompanhar o status ("Em revisão" / "Aprovado" / "Ajuste pedido").
 *
 * POST /api/p/cliente/[token]/posts   → cliente envia um post novo pra
 *      Marcelo revisar. Cria Post { origem=CLIENTE, revisao=PENDENTE,
 *      status=RASCUNHO } + arquivos, e notifica o criador do acesso.
 *
 * Auth: sessão do cliente (cookie JWT + token), igual aprovar/comentar.
 * Requer permissão `podeEnviarConteudo` (403 se off).
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { portalPostSubmissaoSchema } from "@/lib/schemas";
import { cookies } from "next/headers";

/** Resposta de erro com status explícito (apiHandler genérico não dá 403). */
function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeEnviarConteudo) return erro("Sem permissão pra enviar conteúdo", 403);

    const posts = await prisma.post.findMany({
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
      posts.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        legenda: p.legenda,
        formato: p.formato,
        dataPublicacao: p.dataPublicacao.toISOString(),
        hashtags: p.hashtags,
        revisao: p.revisao,
        revisaoNota: p.revisaoNota,
        arquivos: p.arquivos,
        createdAt: p.createdAt.toISOString(),
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

    const data = portalPostSubmissaoSchema.parse(await req.json());

    const post = await prisma.post.create({
      data: {
        titulo: data.titulo,
        legenda: data.legenda || null,
        formato: data.formato,
        dataPublicacao: data.dataPublicacao,
        hashtags: data.hashtags,
        clienteId: r.cliente.id,
        // Caminho inverso: submetido pelo cliente, aguardando revisão do Marcelo
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

    // Notifica o criador do acesso (Marcelo). Reusa tipo PORTAL_PEDIU_AJUSTE
    // (evento inbound do portal; sem nova enum). Título disambígua.
    await prisma.notificacao.create({
      data: {
        userId: r.acesso.criadoPor,
        tipo: "PORTAL_PEDIU_AJUSTE",
        titulo: `📥 ${r.cliente.nome} enviou um post pra revisão`,
        descricao: `"${post.titulo}" — aguardando sua revisão`,
        href: `/editorial?post=${post.id}`,
        entidadeTipo: "POST",
        entidadeId: post.id,
        chave: `PORTAL_SUBMISSAO_POST:${post.id}`,
      },
    });

    return NextResponse.json({ ok: true, id: post.id });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Validação falhou", issues: e.issues }, { status: 400 });
    }
    // Erros de sessão → 401; resto → 500
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg.includes("Sessão") || msg.includes("login") || msg.includes("desativado") ? 401 : 500;
    return erro(msg, status);
  }
}
