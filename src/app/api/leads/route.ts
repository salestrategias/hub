import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { leadSchema } from "@/lib/schemas";
import type { LeadStatus } from "@prisma/client";

const STATUS_VALIDOS: LeadStatus[] = [
  "NOVO",
  "QUALIFICACAO",
  "DIAGNOSTICO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
  "GANHO",
  "PERDIDO",
];

/**
 * Lista leads. Filtros via query:
 *   status — CSV
 *   responsavel — userId (default: todos)
 *   q — busca empresa/contatoNome
 *   ativos — "1" filtra fora GANHO+PERDIDO (default: false)
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get("status");
    const statusList = statusRaw
      ? statusRaw.split(",").filter((s): s is LeadStatus => STATUS_VALIDOS.includes(s as LeadStatus))
      : undefined;
    const responsavel = searchParams.get("responsavel") ?? undefined;
    const q = searchParams.get("q")?.trim();
    const ativos = searchParams.get("ativos") === "1";

    return prisma.lead.findMany({
      where: {
        ...(statusList && statusList.length ? { status: { in: statusList } } : {}),
        ...(responsavel ? { responsavel } : {}),
        ...(ativos ? { status: { notIn: ["GANHO", "PERDIDO"] } } : {}),
        ...(q
          ? {
              OR: [
                { empresa: { contains: q, mode: "insensitive" } },
                { contatoNome: { contains: q, mode: "insensitive" } },
                { contatoEmail: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: "asc" }, { prioridade: "asc" }, { updatedAt: "desc" }],
      include: {
        cliente: { select: { id: true, nome: true } },
        _count: { select: { propostas: true } },
      },
      take: 500,
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = leadSchema.parse(await req.json());

    return prisma.lead.create({
      data: { ...data, responsavel: user.id },
    });
  });
}
