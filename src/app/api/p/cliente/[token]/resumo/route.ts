/**
 * GET /api/p/cliente/[token]/resumo?mes=YYYY-MM
 *
 * Resumo de ENTREGAS de um mês do cliente — alimenta a home "Início" do
 * portal (primeira tela que o cliente vê). Foco em VALOR: o que a SAL
 * entregou naquele mês.
 *
 * Não depende de permissão específica (Início aparece sempre); só exige
 * sessão válida do cliente. Read-only.
 *
 * Param `mes` (opcional, "YYYY-MM"): mês a resumir. Default = mês atual.
 * Inválido → cai no mês atual (não quebra). Permite à home navegar pelo
 * histórico de entregas de meses anteriores.
 *
 * Contagens do MÊS pedido (filtradas por clienteId):
 *  - postsPublicados:   Post status=PUBLICADO, dataPublicacao no mês
 *  - criativosProduzidos: Criativo createdAt no mês (rascunho não conta)
 *  - reunioesRealizadas: Reuniao data no mês e já ocorrida (<= agora)
 *  - tarefasConcluidas: Tarefa concluida=true, updatedAt no mês
 *
 * pendencias: nº de itens AGUARDANDO A APROVAÇÃO DESTE cliente, agora
 * (independe do mês — pendência é estado atual, não histórico):
 *  - posts:     Post status=COPY_PRONTA  (só conta se podeAprovarPosts)
 *  - criativos: Criativo status=EM_APROVACAO (só se podeAprovarCriativos)
 * "Aguardando aprovação" = o post/criativo está no status inicial de
 * revisão do cliente e ainda não foi movido adiante pela aprovação.
 *
 * ultimasEntregas: ~6 entregas mais recentes do mês pedido (posts
 * publicados + criativos prontos), ordenadas por data desc.
 *
 * totais (desde sempre, opcional): postsPublicados acumulado.
 * mes: "YYYY-MM" efetivamente resumido (eco do default/saneado).
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

/** Status de criativo que representam "entrega" (saiu do rascunho interno). */
const CRIATIVO_ENTREGUE = ["EM_APROVACAO", "APROVADO", "NO_AR", "PAUSADO", "ENCERRADO"] as const;

/**
 * Resolve o mês a resumir a partir do param "YYYY-MM". Inválido/ausente →
 * mês atual. Retorna as bordas [início, próximoInício) em horário local do
 * servidor e o rótulo "YYYY-MM" saneado (pra ecoar pro front).
 */
function resolverMes(mesRaw: string | null): { inicio: Date; fim: Date; rotulo: string } {
  const agora = new Date();
  let ano = agora.getFullYear();
  let mes0 = agora.getMonth(); // 0-based
  const m = mesRaw?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const a = Number(m[1]);
    const mm = Number(m[2]);
    if (a >= 2000 && a <= 2100 && mm >= 1 && mm <= 12) {
      ano = a;
      mes0 = mm - 1;
    }
  }
  const inicio = new Date(ano, mes0, 1, 0, 0, 0, 0);
  const fim = new Date(ano, mes0 + 1, 1, 0, 0, 0, 0);
  const rotulo = `${ano}-${String(mes0 + 1).padStart(2, "0")}`;
  return { inicio, fim, rotulo };
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    const clienteId = r.cliente.id;

    const { searchParams } = new URL(req.url);
    const { inicio: inicioMes, fim: inicioProxMes, rotulo } = resolverMes(searchParams.get("mes"));

    const agora = new Date();
    // Reuniões só contam as que já aconteceram. Se o mês resumido for futuro,
    // o teto é o fim do mês; se for o atual/passado, é "agora" pro mês atual.
    const tetoReunioes = inicioProxMes < agora ? inicioProxMes : agora;

    // Pendências de aprovação só fazem sentido se o cliente PODE aprovar.
    const podePosts = r.acesso.podeAprovarPosts;
    const podeCriativos = r.acesso.podeAprovarCriativos;

    const [
      postsPublicados,
      criativosProduzidos,
      reunioesRealizadas,
      tarefasConcluidas,
      totalPostsPublicados,
      postsRecentes,
      criativosRecentes,
      pendenciaPosts,
      pendenciaCriativos,
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
          data: { gte: inicioMes, lt: inicioProxMes, lte: tetoReunioes },
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
      // Últimas entregas — posts publicados do mês (busca 6, mescla depois)
      prisma.post.findMany({
        where: {
          clienteId,
          status: "PUBLICADO",
          dataPublicacao: { gte: inicioMes, lt: inicioProxMes },
        },
        orderBy: { dataPublicacao: "desc" },
        take: 6,
        select: { id: true, titulo: true, dataPublicacao: true },
      }),
      // Últimas entregas — criativos prontos do mês
      prisma.criativo.findMany({
        where: {
          clienteId,
          status: { in: [...CRIATIVO_ENTREGUE] },
          createdAt: { gte: inicioMes, lt: inicioProxMes },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, titulo: true, createdAt: true },
      }),
      // Pendências de aprovação — estado ATUAL (não filtra por mês).
      // 0 quando o cliente não tem permissão de aprovar aquele tipo.
      podePosts
        ? prisma.post.count({ where: { clienteId, status: "COPY_PRONTA" } })
        : Promise.resolve(0),
      podeCriativos
        ? prisma.criativo.count({ where: { clienteId, status: "EM_APROVACAO" } })
        : Promise.resolve(0),
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
      mes: rotulo,
      entregasMes: {
        postsPublicados,
        criativosProduzidos,
        reunioesRealizadas,
        tarefasConcluidas,
      },
      pendencias: {
        posts: pendenciaPosts,
        criativos: pendenciaCriativos,
      },
      ultimasEntregas,
      totais: {
        postsPublicados: totalPostsPublicados,
      },
    };
  });
}
