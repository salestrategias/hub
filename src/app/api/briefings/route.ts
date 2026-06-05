import { Prisma } from "@prisma/client";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { briefingCriarSchema } from "@/lib/schemas";
import {
  getTemplatePadrao,
  normalizarPerguntas,
  type BriefingPergunta,
} from "@/lib/briefing";

const STATUS_VALIDOS = ["RASCUNHO", "ENVIADO", "RESPONDIDO", "ARQUIVADO"] as const;
type Status = (typeof STATUS_VALIDOS)[number];

/**
 * Lista briefings. Filtros via query:
 *   status     — CSV de BriefingStatus
 *   clienteId  — filtro por cliente
 *   q          — busca em titulo/clienteNome
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

    return prisma.briefing.findMany({
      where: {
        ...(statusList && statusList.length ? { status: { in: statusList } } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(q
          ? {
              OR: [
                { titulo: { contains: q, mode: "insensitive" } },
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

/**
 * Cria um briefing. Body: { clienteId?, templateSlug? | templateId?, titulo? }.
 * As perguntas viram um snapshot editável em Briefing.perguntas:
 *   - templateSlug → copia do template padrão (src/lib/briefing.ts)
 *   - templateId   → copia do BriefingTemplate custom (banco)
 *   - nenhum       → começa vazio (em branco)
 * Status inicial sempre RASCUNHO.
 */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = briefingCriarSchema.parse(await req.json().catch(() => ({})));

    // Resolve as perguntas-snapshot + título/origem conforme a fonte.
    let perguntas: BriefingPergunta[] = [];
    let titulo = data.titulo?.trim() || "";
    let templateOrigem: string | null = null;

    if (data.templateSlug) {
      const tpl = getTemplatePadrao(data.templateSlug);
      if (!tpl) throw new Error("Modelo de briefing não encontrado");
      perguntas = tpl.perguntas;
      templateOrigem = tpl.slug;
      if (!titulo) titulo = tpl.nome;
    } else if (data.templateId) {
      const tpl = await prisma.briefingTemplate.findUnique({ where: { id: data.templateId } });
      if (!tpl) throw new Error("Modelo de briefing não encontrado");
      perguntas = normalizarPerguntas(tpl.perguntas);
      templateOrigem = tpl.id;
      if (!titulo) titulo = tpl.nome;
    }
    if (!titulo) titulo = "Briefing sem título";

    // Snapshot do nome do cliente (sobrevive a SetNull / rename futuro).
    let clienteNome: string | null = null;
    if (data.clienteId) {
      const c = await prisma.cliente.findUnique({
        where: { id: data.clienteId },
        select: { nome: true },
      });
      clienteNome = c?.nome ?? null;
    }

    return prisma.briefing.create({
      data: {
        titulo,
        perguntas: perguntas as unknown as Prisma.InputJsonValue,
        status: "RASCUNHO",
        clienteId: data.clienteId || null,
        clienteNome,
        templateOrigem,
        criadoPor: user.id,
      },
      include: { cliente: { select: { id: true, nome: true } } },
    });
  });
}
