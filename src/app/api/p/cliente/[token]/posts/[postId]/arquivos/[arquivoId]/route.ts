/**
 * Portal v2 — cliente REMOVE uma arte que ELE MESMO anexou.
 *
 * DELETE /api/p/cliente/[token]/posts/[postId]/arquivos/[arquivoId]
 *   → autentica a sessão + checa `podeEnviarConteudo` (403). Só remove o
 *     PostArquivo se: pertence ao post informado, o post é do cliente do
 *     token, E a arte tem enviadoPorCliente=true (o cliente NÃO pode mexer
 *     nas artes produzidas pela SAL — 404 nesses casos).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { token: string; postId: string; arquivoId: string } }
) {
  try {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeEnviarConteudo) return erro("Sem permissão pra enviar conteúdo", 403);

    // Só deleta se a arte é do cliente (post.clienteId) E foi enviada por ele.
    // O join via post garante posse; enviadoPorCliente protege as artes da SAL.
    const arquivo = await prisma.postArquivo.findFirst({
      where: {
        id: params.arquivoId,
        postId: params.postId,
        enviadoPorCliente: true,
        post: { clienteId: r.cliente.id },
      },
      select: { id: true },
    });
    if (!arquivo) return erro("Arte não encontrada ou não pode ser removida", 404);

    await prisma.postArquivo.delete({ where: { id: arquivo.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg.includes("Sessão") || msg.includes("login") || msg.includes("desativado") ? 401 : 500;
    return erro(msg, status);
  }
}
