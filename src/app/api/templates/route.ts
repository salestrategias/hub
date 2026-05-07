import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { templateSchema } from "@/lib/schemas";
import type { TemplateTipo } from "@prisma/client";

const VALID_TIPOS = ["NOTA", "REUNIAO", "BRIEFING", "TAREFA", "PROJETO"] as const;

/**
 * Lista templates. Filtros via query params:
 *   tipo       — TemplateTipo (CSV ou único)
 *   categoria  — string exata
 *   q          — busca em nome/descricao
 *   meus       — "1" mostra apenas criados pelo user logado (default: false)
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);

    const tiposRaw = searchParams.get("tipo");
    const tipos = tiposRaw
      ? tiposRaw.split(",").filter((t): t is TemplateTipo => VALID_TIPOS.includes(t as TemplateTipo))
      : undefined;
    const categoria = searchParams.get("categoria") ?? undefined;
    const q = searchParams.get("q")?.trim();
    const meus = searchParams.get("meus") === "1";

    return prisma.template.findMany({
      where: {
        ...(tipos && tipos.length ? { tipo: { in: tipos } } : {}),
        ...(categoria ? { categoria } : {}),
        ...(meus ? { criadoPor: user.id } : {}),
        ...(q
          ? {
              OR: [
                { nome: { contains: q, mode: "insensitive" } },
                { descricao: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ ultimoUso: "desc" }, { quantidadeUsos: "desc" }, { nome: "asc" }],
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = templateSchema.parse(await req.json());
    return prisma.template.create({
      data: { ...data, criadoPor: user.id },
    });
  });
}
