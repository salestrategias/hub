import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { MentionEntity } from "@prisma/client";

export type MentionSearchItem = {
  type: MentionEntity;
  id: string;
  label: string;
  /** Subtítulo opcional pra desambiguar (ex: nome do cliente em uma reunião) */
  subtitle?: string;
};

const ALL_TYPES: MentionEntity[] = ["CLIENTE", "REUNIAO", "POST", "PROJETO", "TAREFA", "CONTRATO", "NOTA"];

/**
 * Endpoint usado pelo SuggestionMenu do BlockEditor quando usuário digita `@`.
 * Retorna lista achatada (até `limit` por tipo) das entidades que matcham `q`.
 *
 * Query params:
 *   q      — string de busca (vazia = retorna mais recentes)
 *   types  — CSV de MentionEntity (default = todos)
 *   limit  — máximo por tipo (default 5, max 10)
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 5), 1), 10);
    const typesRaw = url.searchParams.get("types");
    const types = typesRaw
      ? (typesRaw.split(",").map((t) => t.trim().toUpperCase()).filter((t): t is MentionEntity => ALL_TYPES.includes(t as MentionEntity)))
      : ALL_TYPES;

    const ins = "insensitive" as const;
    const containsQ = q ? { contains: q, mode: ins } : undefined;

    const queries = await Promise.all(
      types.map<Promise<MentionSearchItem[]>>(async (type) => {
        switch (type) {
          case "CLIENTE": {
            const rows = await prisma.cliente.findMany({
              where: containsQ ? { OR: [{ nome: containsQ }, { email: containsQ }] } : undefined,
              select: { id: true, nome: true, status: true },
              take: limit,
              orderBy: q ? undefined : { updatedAt: "desc" },
            });
            return rows.map((r) => ({ type, id: r.id, label: r.nome, subtitle: r.status }));
          }
          case "REUNIAO": {
            const rows = await prisma.reuniao.findMany({
              where: containsQ ? { titulo: containsQ } : undefined,
              select: { id: true, titulo: true, data: true, cliente: { select: { nome: true } } },
              take: limit,
              orderBy: { data: "desc" },
            });
            return rows.map((r) => ({
              type,
              id: r.id,
              label: r.titulo,
              subtitle: [r.cliente?.nome, new Date(r.data).toLocaleDateString("pt-BR")].filter(Boolean).join(" · "),
            }));
          }
          case "POST": {
            const rows = await prisma.post.findMany({
              where: containsQ ? { OR: [{ titulo: containsQ }, { legenda: containsQ }] } : undefined,
              select: { id: true, titulo: true, status: true, cliente: { select: { nome: true } } },
              take: limit,
              orderBy: q ? undefined : { dataPublicacao: "desc" },
            });
            return rows.map((r) => ({
              type,
              id: r.id,
              label: r.titulo ?? "(sem título)",
              subtitle: [r.cliente?.nome, r.status].filter(Boolean).join(" · "),
            }));
          }
          case "PROJETO": {
            const rows = await prisma.projeto.findMany({
              where: containsQ ? { nome: containsQ } : undefined,
              select: { id: true, nome: true, status: true, cliente: { select: { nome: true } } },
              take: limit,
              orderBy: q ? undefined : { updatedAt: "desc" },
            });
            return rows.map((r) => ({
              type,
              id: r.id,
              label: r.nome,
              subtitle: [r.cliente?.nome, r.status].filter(Boolean).join(" · "),
            }));
          }
          case "TAREFA": {
            const rows = await prisma.tarefa.findMany({
              where: containsQ ? { titulo: containsQ } : undefined,
              select: { id: true, titulo: true, prioridade: true, cliente: { select: { nome: true } } },
              take: limit,
              orderBy: q ? undefined : { updatedAt: "desc" },
            });
            return rows.map((r) => ({
              type,
              id: r.id,
              label: r.titulo,
              subtitle: [r.cliente?.nome, r.prioridade].filter(Boolean).join(" · "),
            }));
          }
          case "CONTRATO": {
            const rows = await prisma.contrato.findMany({
              where: containsQ ? { OR: [{ observacoes: containsQ }, { cliente: { nome: containsQ } }] } : undefined,
              select: { id: true, status: true, cliente: { select: { nome: true } } },
              take: limit,
              orderBy: q ? undefined : { updatedAt: "desc" },
            });
            return rows.map((r) => ({
              type,
              id: r.id,
              label: `Contrato ${r.cliente?.nome ?? "(s/ cliente)"}`,
              subtitle: r.status,
            }));
          }
          case "NOTA": {
            const rows = await prisma.nota.findMany({
              where: containsQ ? { titulo: containsQ } : undefined,
              select: { id: true, titulo: true, pasta: true },
              take: limit,
              orderBy: q ? undefined : { updatedAt: "desc" },
            });
            return rows.map((r) => ({ type, id: r.id, label: r.titulo, subtitle: r.pasta }));
          }
          default:
            return [];
        }
      })
    );

    // Achata + intercala (CLIENTE primeiro, REUNIAO, etc — ordem de `types`)
    return { items: queries.flat() };
  });
}
