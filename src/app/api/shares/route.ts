import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { publicShareSchema } from "@/lib/schemas";

/**
 * Cria ou lista shares públicos.
 *
 * POST: cria novo share. Idempotente NÃO — chamar duas vezes pra mesma
 * entidade gera 2 tokens. Mas se o user quer revogar e gerar um novo,
 * usa DELETE primeiro.
 *
 * GET: lista shares do user logado, opcionalmente filtrado por entidade.
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const entidadeTipo = searchParams.get("entidadeTipo");
    const entidadeId = searchParams.get("entidadeId");

    return prisma.publicShare.findMany({
      where: {
        criadoPor: user.id,
        ...(entidadeTipo && entidadeId ? { entidadeTipo: entidadeTipo as never, entidadeId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = publicShareSchema.parse(await req.json());

    const token = randomBytes(16).toString("hex");
    const senha = data.senha ? await bcrypt.hash(data.senha, 10) : null;

    return prisma.publicShare.create({
      data: {
        token,
        entidadeTipo: data.entidadeTipo,
        entidadeId: data.entidadeId,
        expiraEm: data.expiraEm ?? null,
        senha,
        podeBaixarPdf: data.podeBaixarPdf,
        criadoPor: user.id,
      },
    });
  });
}
