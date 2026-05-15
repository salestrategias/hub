/**
 * POST /api/p/cliente/[token]/criativo/[criativoId]/comentar
 *
 * Cliente pede ajuste num criativo. Body: { texto: string }
 *  - Cria CriativoComentario tipo PEDIU_AJUSTE com texto
 *  - NÃO muda status do criativo
 *  - Notifica admins com preview
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";
import { z } from "zod";

const schema = z.object({
  texto: z.string().min(3, "Comentário muito curto").max(2000),
});

export async function POST(
  req: Request,
  { params }: { params: { token: string; criativoId: string } }
) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.podeComentar) throw new Error("Sem permissão pra comentar");

    const { texto } = schema.parse(await req.json());

    const criativo = await prisma.criativo.findFirst({
      where: { id: params.criativoId, clienteId: r.cliente.id },
      select: { id: true, titulo: true },
    });
    if (!criativo) throw new Error("Criativo não encontrado");

    await prisma.criativoComentario.create({
      data: {
        criativoId: criativo.id,
        tipo: "PEDIU_AJUSTE",
        texto,
        clienteNome: r.cliente.nome,
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    const preview = texto.length > 100 ? texto.slice(0, 97) + "..." : texto;
    await prisma.notificacao.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        tipo: "PORTAL_PEDIU_AJUSTE" as const,
        titulo: `💬 ${r.cliente.nome} pediu ajuste em criativo`,
        descricao: `"${criativo.titulo}" — ${preview}`,
        href: `/criativos?criativo=${criativo.id}`,
        entidadeTipo: "CRIATIVO",
        entidadeId: criativo.id,
        chave: `PORTAL_AJUSTE_CRIATIVO:${criativo.id}:${Date.now()}`,
      })),
      skipDuplicates: true,
    });

    return { ok: true };
  });
}
