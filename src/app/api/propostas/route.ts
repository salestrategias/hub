import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { propostaSchema } from "@/lib/schemas";
import { proximoNumeroProposta } from "@/lib/proposta-numero";

const STATUS_VALIDOS = ["RASCUNHO", "ENVIADA", "VISTA", "ACEITA", "RECUSADA", "EXPIRADA"] as const;
type Status = (typeof STATUS_VALIDOS)[number];

/**
 * Lista propostas. Filtros via query:
 *   status     — CSV de PropostaStatus
 *   clienteId  — filtro por cliente
 *   q          — busca em titulo/numero/clienteNome
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get("status");
    const statusList = statusRaw
      ? statusRaw.split(",").filter((s): s is Status => STATUS_VALIDOS.includes(s as Status))
      : undefined;
    const clienteId = searchParams.get("clienteId");
    const q = searchParams.get("q")?.trim();

    return prisma.proposta.findMany({
      where: {
        ...(statusList && statusList.length ? { status: { in: statusList } } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(q
          ? {
              OR: [
                { titulo: { contains: q, mode: "insensitive" } },
                { numero: { contains: q, mode: "insensitive" } },
                { clienteNome: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: { cliente: { select: { id: true, nome: true } } },
      take: 100,
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = propostaSchema.parse(await req.json());

    // Cliente snapshot — se clienteId vier, busca o nome atualizado
    let clienteNome = data.clienteNome;
    let clienteEmail = data.clienteEmail || null;
    if (data.clienteId) {
      const c = await prisma.cliente.findUnique({
        where: { id: data.clienteId },
        select: { nome: true, email: true },
      });
      if (c) {
        clienteNome = c.nome;
        clienteEmail = clienteEmail ?? c.email;
      }
    }

    const numero = await proximoNumeroProposta();

    return prisma.proposta.create({
      data: {
        ...data,
        clienteNome,
        clienteEmail,
        numero,
        criadoPor: user.id,
      },
    });
  });
}
