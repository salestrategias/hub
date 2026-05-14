/**
 * POST /api/p/cliente/[token]/post/[postId]/aprovar
 *
 * Cliente aprova um post:
 *  - Valida sessão + permissão `podeAprovarPosts`
 *  - Valida que o post é do cliente do token (não pode aprovar de outro)
 *  - Cria PostComentario tipo APROVOU
 *  - Move post: COPY_PRONTA → DESIGN_PRONTO (outros status: mantém)
 *  - Cria Notificacao pra todos os ADMIN do SAL
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

export async function POST(
  _req: Request,
  { params }: { params: { token: string; postId: string } }
) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeAprovarPosts) throw new Error("Sem permissão pra aprovar");

    // Confirma que o post pertence ao cliente
    const post = await prisma.post.findFirst({
      where: { id: params.postId, clienteId: r.cliente.id },
      select: { id: true, titulo: true, status: true },
    });
    if (!post) throw new Error("Post não encontrado");

    // Cria registro de aprovação + atualiza status (transação)
    await prisma.$transaction([
      prisma.postComentario.create({
        data: {
          postId: post.id,
          tipo: "APROVOU",
          texto: null,
          clienteNome: r.cliente.nome,
        },
      }),
      ...(post.status === "COPY_PRONTA"
        ? [prisma.post.update({ where: { id: post.id }, data: { status: "DESIGN_PRONTO" } })]
        : []),
    ]);

    // Notifica todos os admins do Hub
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    await prisma.notificacao.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        tipo: "PORTAL_APROVOU_POST" as const,
        titulo: `✅ ${r.cliente.nome} aprovou um post`,
        descricao: `"${post.titulo}" — pronto pra produção`,
        href: `/editorial?post=${post.id}`,
        entidadeTipo: "POST",
        entidadeId: post.id,
        chave: `PORTAL_APROVOU:${post.id}:${Date.now()}`,
      })),
      skipDuplicates: true,
    });

    return { ok: true };
  });
}
