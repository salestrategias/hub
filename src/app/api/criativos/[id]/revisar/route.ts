/**
 * POST /api/criativos/[id]/revisar
 *
 * Marcelo revisa um criativo submetido pelo cliente (origem=CLIENTE).
 * Body: { decisao: "APROVADO" | "AJUSTE", nota?: string }
 *  - APROVADO → revisao=APROVADO, revisaoNota limpa. O criativo permanece
 *    no pipeline normal (status RASCUNHO) pra Marcelo trabalhar nele.
 *  - AJUSTE   → revisao=AJUSTE, revisaoNota=nota (obrigatória).
 *
 * O portal do cliente (MinhasSubmissoes) lê revisao/revisaoNota e mostra
 * "Aprovado" ou "Ajuste pedido" + a nota.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { revisaoSchema } from "@/lib/schemas";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { decisao, nota } = revisaoSchema.parse(await req.json());

    return prisma.criativo.update({
      where: { id: params.id },
      data: {
        revisao: decisao,
        revisaoNota: decisao === "AJUSTE" ? (nota ?? null) : null,
      },
      select: { id: true, revisao: true, revisaoNota: true },
    });
  });
}
