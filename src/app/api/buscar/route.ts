import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Busca global em todos os módulos relevantes — usada pelo Command Palette (⌘K).
 * Retorna no máximo `limite` itens por categoria. Vazio se query < 2 chars.
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limite = Math.min(Number(searchParams.get("limite") ?? 5), 15);

    if (q.length < 2) {
      return { clientes: [], notas: [], reunioes: [], tarefas: [], posts: [], projetos: [], contratos: [] };
    }

    const ins = "insensitive" as const;

    const [clientes, notas, reunioes, tarefas, posts, projetos, contratos] = await Promise.all([
      prisma.cliente.findMany({
        where: {
          OR: [
            { nome: { contains: q, mode: ins } },
            { email: { contains: q, mode: ins } },
            { cnpj: { contains: q, mode: ins } },
          ],
        },
        select: { id: true, nome: true, status: true, email: true },
        take: limite,
      }),
      prisma.nota.findMany({
        where: {
          OR: [
            { titulo: { contains: q, mode: ins } },
            { conteudo: { contains: q, mode: ins } },
          ],
        },
        select: { id: true, titulo: true, pasta: true },
        take: limite,
      }),
      prisma.reuniao.findMany({
        where: {
          OR: [
            { titulo: { contains: q, mode: ins } },
            { resumoIA: { contains: q, mode: ins } },
            { notasLivres: { contains: q, mode: ins } },
          ],
        },
        select: { id: true, titulo: true, data: true, cliente: { select: { nome: true } } },
        take: limite,
        orderBy: { data: "desc" },
      }),
      prisma.tarefa.findMany({
        where: {
          OR: [
            { titulo: { contains: q, mode: ins } },
            { descricao: { contains: q, mode: ins } },
          ],
        },
        select: { id: true, titulo: true, concluida: true, prioridade: true, cliente: { select: { nome: true } } },
        take: limite,
      }),
      prisma.post.findMany({
        where: {
          OR: [
            { titulo: { contains: q, mode: ins } },
            { legenda: { contains: q, mode: ins } },
            { pilar: { contains: q, mode: ins } },
          ],
        },
        select: { id: true, titulo: true, status: true, cliente: { select: { id: true, nome: true } }, dataPublicacao: true },
        take: limite,
        orderBy: { dataPublicacao: "desc" },
      }),
      prisma.projeto.findMany({
        where: {
          OR: [
            { nome: { contains: q, mode: ins } },
            { descricao: { contains: q, mode: ins } },
          ],
        },
        select: { id: true, nome: true, status: true, cliente: { select: { nome: true } } },
        take: limite,
      }),
      prisma.contrato.findMany({
        where: {
          OR: [
            { observacoes: { contains: q, mode: ins } },
            { cliente: { nome: { contains: q, mode: ins } } },
          ],
        },
        select: { id: true, dataFim: true, status: true, cliente: { select: { id: true, nome: true } } },
        take: limite,
      }),
    ]);

    return {
      clientes,
      notas,
      reunioes,
      tarefas,
      posts,
      projetos,
      contratos,
    };
  });
}
