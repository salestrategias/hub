/**
 * Portal v2 — cliente ANEXA arte(s) num post EXISTENTE da SAL.
 *
 * Diferente de /posts (que cria um post NOVO do cliente pra revisão): aqui
 * o cliente CONTRIBUI com arquivos num post que a SAL já criou no calendário
 * dele — pros casos em que o próprio cliente produz a arte.
 *
 * POST /api/p/cliente/[token]/posts/[postId]/arquivos
 *   → autentica a sessão (cookie + token) + checa `podeEnviarConteudo` (403).
 *     Valida que o post pertence ao cliente do token (404). Cria PostArquivo(s)
 *     com enviadoPorCliente=true, ordem no fim. Notifica o Marcelo.
 *
 * Auth: sessão do cliente (cookie JWT + token), igual aprovar/comentar/posts.
 * As artes anexadas marcam PostArquivo.enviadoPorCliente=true — o Hub mostra
 * um selo "Enviado pelo cliente" nelas.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { portalAnexarArteSchema } from "@/lib/schemas";
import { cookies } from "next/headers";

/** Resposta de erro com status explícito (apiHandler genérico não dá 403/404). */
function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: { token: string; postId: string } }
) {
  try {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeEnviarConteudo) return erro("Sem permissão pra enviar conteúdo", 403);

    // Confirma que o post pertence ao cliente do token (não pode anexar
    // em post de outro cliente). 404 se não existe / não é dele.
    const post = await prisma.post.findFirst({
      where: { id: params.postId, clienteId: r.cliente.id },
      select: { id: true, titulo: true },
    });
    if (!post) return erro("Post não encontrado", 404);

    const data = portalAnexarArteSchema.parse(await req.json());

    // Ordem inicial = depois das artes que já existem no post.
    const max = await prisma.postArquivo.aggregate({
      where: { postId: post.id },
      _max: { ordem: true },
    });
    let ordemBase = max._max.ordem ?? 0;

    const criados = await prisma.$transaction(
      data.arquivos.map((a) => {
        ordemBase += 10;
        return prisma.postArquivo.create({
          data: {
            postId: post.id,
            tipo: a.tipo,
            url: a.url,
            nome: a.nome || null,
            legenda: a.legenda || null,
            ordem: a.ordem || ordemBase,
            // Marca como arte enviada pelo cliente (vs. produzida pela SAL).
            enviadoPorCliente: true,
          },
          select: { id: true, tipo: true, url: true, nome: true, legenda: true, ordem: true, enviadoPorCliente: true },
        });
      })
    );

    // Notifica o criador do acesso (Marcelo). Tipo dedicado de evento inbound
    // (não dispara email — não está em TIPOS_QUE_DISPARAM_EMAIL). Chave com
    // timestamp pra não deduplicar anexos sucessivos no mesmo post.
    const qtd = criados.length;
    await prisma.notificacao.create({
      data: {
        userId: r.acesso.criadoPor,
        tipo: "CLIENTE_SUBMETEU_CONTEUDO",
        titulo: `📎 ${r.cliente.nome} anexou ${qtd === 1 ? "uma arte" : `${qtd} artes`} no post "${post.titulo}"`,
        descricao: "Arte enviada pelo cliente — confira no calendário editorial",
        href: `/editorial?post=${post.id}`,
        entidadeTipo: "POST",
        entidadeId: post.id,
        chave: `PORTAL_ANEXOU_ARTE:${post.id}:${Date.now()}`,
      },
    });

    return NextResponse.json({ ok: true, arquivos: criados });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Validação falhou", issues: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg.includes("Sessão") || msg.includes("login") || msg.includes("desativado") ? 401 : 500;
    return erro(msg, status);
  }
}
