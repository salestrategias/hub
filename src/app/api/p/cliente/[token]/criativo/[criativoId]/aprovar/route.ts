/**
 * POST /api/p/cliente/[token]/criativo/[criativoId]/aprovar
 *
 * Cliente aprova um criativo:
 *  - Valida sessão + permissão `podeAprovarCriativos`
 *  - Valida que o criativo é do cliente do token
 *  - Cria CriativoComentario tipo APROVOU (com comentário opcional)
 *  - Move EM_APROVACAO → APROVADO (outros status: mantém)
 *  - Notifica admins
 *
 * Body (opcional): { texto?: string } — comentário que acompanha a
 * aprovação. Só guardado se o cliente tem permissão `podeComentar`.
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";
import { z } from "zod";

const schema = z.object({
  texto: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { token: string; criativoId: string } }
) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeAprovarCriativos) throw new Error("Sem permissão pra aprovar");

    const body = await req.json().catch(() => ({}));
    const { texto } = schema.parse(body ?? {});
    const comentario = r.acesso.podeComentar && texto ? texto : null;

    const criativo = await prisma.criativo.findFirst({
      where: { id: params.criativoId, clienteId: r.cliente.id },
      select: { id: true, titulo: true, status: true },
    });
    if (!criativo) throw new Error("Criativo não encontrado");

    await prisma.$transaction([
      prisma.criativoComentario.create({
        data: {
          criativoId: criativo.id,
          tipo: "APROVOU",
          texto: comentario,
          clienteNome: r.cliente.nome,
        },
      }),
      ...(criativo.status === "EM_APROVACAO"
        ? [prisma.criativo.update({ where: { id: criativo.id }, data: { status: "APROVADO" } })]
        : []),
    ]);

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    const previewComentario = comentario
      ? ` — "${comentario.length > 80 ? comentario.slice(0, 77) + "..." : comentario}"`
      : "";
    await prisma.notificacao.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        tipo: "PORTAL_APROVOU_POST" as const, // reusa enum existente (sem migration de enum)
        titulo: `✅ ${r.cliente.nome} aprovou um criativo`,
        descricao: `"${criativo.titulo}" — pronto pra subir na plataforma${previewComentario}`,
        href: `/criativos?criativo=${criativo.id}`,
        entidadeTipo: "CRIATIVO",
        entidadeId: criativo.id,
        chave: `PORTAL_APROVOU_CRIATIVO:${criativo.id}:${Date.now()}`,
      })),
      skipDuplicates: true,
    });

    return { ok: true };
  });
}
