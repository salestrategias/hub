/**
 * GET /api/p/cliente/[token]/resumo
 *
 * Resumo de ENTREGAS do mês corrente do cliente — alimenta a home
 * "Início" do portal (primeira tela que o cliente vê). Foco em VALOR:
 * o que a SAL entregou neste mês.
 *
 * Não depende de permissão específica (Início aparece sempre); só exige
 * sessão válida do cliente. Read-only.
 *
 * Contagens do MÊS CORRENTE (filtradas por clienteId):
 *  - postsPublicados:   Post status=PUBLICADO, dataPublicacao no mês
 *  - criativosProduzidos: Criativo createdAt no mês (rascunho não conta)
 *  - reunioesRealizadas: Reuniao data no mês e já ocorrida (<= agora)
 *  - tarefasConcluidas: Tarefa concluida=true, updatedAt no mês
 *
 * ultimasEntregas: ~6 entregas mais recentes (posts publicados +
 * criativos prontos), ordenadas por data desc — timeline curtinha.
 *
 * totais (desde sempre, opcional): postsPublicados acumulado.
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

/** Status de criativo que representam "entrega" (saiu do rascunho interno). */
const CRIATIVO_ENTREGUE = ["EM_APROVACAO", "APROVADO", "NO_AR", "PAUSADO", "ENCERRADO"] as const;

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    const clienteId = r.cliente.id;

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    const inicioProxMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1, 0, 0, 0, 0);

    const [
      postsPublicados,
      criativosProduzidos,
      reunioesRealizadas,
      tarefasConcluidas,
      totalPostsPublicados,
      postsRecentes,
      criativosRecentes,
    ] = await Promise.all([
      // Entregas do mês — contagens
      prisma.post.count({
        where: {
          clienteId,
          status: "PUBLICADO",
          dataPublicacao: { gte: inicioMes, lt: inicioProxMes },
        },
      }),
      prisma.criativo.count({
        where: {
          clienteId,
          status: { in: [...CRIATIVO_ENTREGUE] },
          createdAt: { gte: inicioMes, lt: inicioProxMes },
        },
      }),
      prisma.reuniao.count({
        where: {
          clienteId,
          data: { gte: inicioMes, lt: inicioProxMes, lte: agora },
        },
      }),
      prisma.tarefa.count({
        where: {
          clienteId,
          concluida: true,
          updatedAt: { gte: inicioMes, lt: inicioProxMes },
        },
      }),
      // Total acumulado (desde sempre) — opcional, barato
      prisma.post.count({
        where: { clienteId, status: "PUBLICADO" },
      }),
      // Últimas entregas — posts publicados (busca 6, mescla depois)
      prisma.post.findMany({
        where: { clienteId, status: "PUBLICADO" },
        orderBy: { dataPublicacao: "desc" },
        take: 6,
        select: { id: true, titulo: true, dataPublicacao: true },
      }),
      // Últimas entregas — criativos prontos
      prisma.criativo.findMany({
        where: { clienteId, status: { in: [...CRIATIVO_ENTREGUE] } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, titulo: true, createdAt: true },
      }),
    ]);

    type Entrega = { id: string; tipo: "post" | "criativo"; titulo: string; data: string };

    const ultimasEntregas: Entrega[] = [
      ...postsRecentes.map((p) => ({
        id: p.id,
        tipo: "post" as const,
        titulo: p.titulo,
        data: p.dataPublicacao.toISOString(),
      })),
      ...criativosRecentes.map((c) => ({
        id: c.id,
        tipo: "criativo" as const,
        titulo: c.titulo,
        data: c.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 6);

    return {
      entregasMes: {
        postsPublicados,
        criativosProduzidos,
        reunioesRealizadas,
        tarefasConcluidas,
      },
      ultimasEntregas,
      totais: {
        postsPublicados: totalPostsPublicados,
      },
    };
  });
}
