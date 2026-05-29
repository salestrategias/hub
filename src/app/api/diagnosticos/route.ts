import { Prisma } from "@prisma/client";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { diagnosticoSchema } from "@/lib/schemas";
import { proximoNumeroDiagnostico } from "@/lib/diagnostico-numero";
import { defaultSecoes } from "@/lib/diagnostico-secoes";

const STATUS_VALIDOS = ["RASCUNHO", "PRONTO", "ENVIADO", "VISTO", "ARQUIVADO"] as const;
type Status = (typeof STATUS_VALIDOS)[number];

/**
 * Lista diagnósticos. Filtros via query:
 *   status     — CSV de DiagnosticoStatus
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

    return prisma.diagnostico.findMany({
      where: {
        versaoAtual: true,
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
      include: {
        cliente: { select: { id: true, nome: true } },
        reuniao: { select: { id: true, titulo: true } },
      },
      take: 100,
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = diagnosticoSchema.parse(await req.json());

    // Cliente snapshot — se clienteId vier, busca nome atualizado
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

    const numero = await proximoNumeroDiagnostico();

    return prisma.diagnostico.create({
      data: {
        titulo: data.titulo,
        clienteId: data.clienteId || null,
        clienteNome,
        clienteEmail,
        leadId: data.leadId || null,
        reuniaoId: data.reuniaoId || null,
        // Seções sempre começam do template completo — Marcelo liga/desliga depois.
        secoes: defaultSecoes() as unknown as Prisma.InputJsonValue,
        logoUrl: data.logoUrl || null,
        corPrimaria: data.corPrimaria || null,
        capaImagemUrl: data.capaImagemUrl || null,
        numero,
        criadoPor: user.id,
      },
    });
  });
}
