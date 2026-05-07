import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { MentionEntity } from "@prisma/client";

export type BacklinkItem = {
  sourceType: MentionEntity;
  sourceId: string;
  /** Label legível do source (ex: título da nota, nome do cliente). */
  label: string;
  /** Subtítulo opcional (data, status, cliente associado). */
  subtitle?: string;
  /** href para navegar até o source. */
  href: string;
  createdAt: string;
};

/**
 * Retorna a lista de documentos que mencionam o target informado.
 *
 * Query params:
 *   type — MentionEntity (obrigatório)
 *   id   — id do target (obrigatório)
 *
 * Faz N queries em paralelo (uma por tipo de source presente). Mentions
 * cujo source foi deletado ficam órfãs e são filtradas (entidade não existe
 * mais no fetch específico do tipo).
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const url = new URL(req.url);
    const type = url.searchParams.get("type") as MentionEntity | null;
    const id = url.searchParams.get("id");
    if (!type || !id) {
      return { items: [] as BacklinkItem[] };
    }

    const mentions = await prisma.mention.findMany({
      where: { targetType: type, targetId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (mentions.length === 0) {
      return { items: [] as BacklinkItem[] };
    }

    // Agrupa por sourceType pra fazer 1 query por tipo
    const bySource = new Map<MentionEntity, string[]>();
    mentions.forEach((m) => {
      const arr = bySource.get(m.sourceType) ?? [];
      arr.push(m.sourceId);
      bySource.set(m.sourceType, arr);
    });

    const items: BacklinkItem[] = [];

    for (const [sourceType, ids] of bySource) {
      const fetched = await fetchSources(sourceType, ids);
      const fetchedMap = new Map(fetched.map((f) => [f.sourceId, f]));

      // Mantém ordem cronológica dos mentions
      mentions
        .filter((m) => m.sourceType === sourceType)
        .forEach((m) => {
          const f = fetchedMap.get(m.sourceId);
          if (!f) return; // orphan — source deletado
          items.push({ ...f, createdAt: m.createdAt.toISOString() });
        });
    }

    // Re-ordena por createdAt desc (poderia ter sido perdido pela iteração por tipo)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { items };
  });
}

async function fetchSources(
  type: MentionEntity,
  ids: string[]
): Promise<Array<Omit<BacklinkItem, "createdAt">>> {
  if (ids.length === 0) return [];
  switch (type) {
    case "CLIENTE": {
      const rows = await prisma.cliente.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, status: true },
      });
      return rows.map((r) => ({
        sourceType: type,
        sourceId: r.id,
        label: r.nome,
        subtitle: r.status,
        href: `/clientes/${r.id}`,
      }));
    }
    case "REUNIAO": {
      const rows = await prisma.reuniao.findMany({
        where: { id: { in: ids } },
        select: { id: true, titulo: true, data: true, cliente: { select: { nome: true } } },
      });
      return rows.map((r) => ({
        sourceType: type,
        sourceId: r.id,
        label: r.titulo,
        subtitle: [r.cliente?.nome, new Date(r.data).toLocaleDateString("pt-BR")].filter(Boolean).join(" · "),
        href: `/reunioes/${r.id}`,
      }));
    }
    case "POST": {
      const rows = await prisma.post.findMany({
        where: { id: { in: ids } },
        select: { id: true, titulo: true, status: true, cliente: { select: { nome: true } } },
      });
      return rows.map((r) => ({
        sourceType: type,
        sourceId: r.id,
        label: r.titulo ?? "(sem título)",
        subtitle: [r.cliente?.nome, r.status].filter(Boolean).join(" · "),
        href: `/editorial?post=${r.id}`,
      }));
    }
    case "PROJETO": {
      const rows = await prisma.projeto.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, status: true, cliente: { select: { nome: true } } },
      });
      return rows.map((r) => ({
        sourceType: type,
        sourceId: r.id,
        label: r.nome,
        subtitle: [r.cliente?.nome, r.status].filter(Boolean).join(" · "),
        href: `/projetos?projeto=${r.id}`,
      }));
    }
    case "TAREFA": {
      const rows = await prisma.tarefa.findMany({
        where: { id: { in: ids } },
        select: { id: true, titulo: true, prioridade: true, cliente: { select: { nome: true } } },
      });
      return rows.map((r) => ({
        sourceType: type,
        sourceId: r.id,
        label: r.titulo,
        subtitle: [r.cliente?.nome, r.prioridade].filter(Boolean).join(" · "),
        href: `/tarefas?tarefa=${r.id}`,
      }));
    }
    case "CONTRATO": {
      const rows = await prisma.contrato.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, cliente: { select: { nome: true } } },
      });
      return rows.map((r) => ({
        sourceType: type,
        sourceId: r.id,
        label: `Contrato ${r.cliente?.nome ?? "(s/ cliente)"}`,
        subtitle: r.status,
        href: `/contratos?contrato=${r.id}`,
      }));
    }
    case "NOTA": {
      const rows = await prisma.nota.findMany({
        where: { id: { in: ids } },
        select: { id: true, titulo: true, pasta: true },
      });
      return rows.map((r) => ({
        sourceType: type,
        sourceId: r.id,
        label: r.titulo,
        subtitle: r.pasta,
        href: `/notas?nota=${r.id}`,
      }));
    }
    default:
      return [];
  }
}
