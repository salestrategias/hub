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

    // Janela da "Sua semana" (dom..sáb da semana atual, horário local do servidor)
    const inicioSemana = new Date(agora);
    inicioSemana.setHours(0, 0, 0, 0);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    const fimSemana = new Date(inicioSemana.getTime() + 7 * 24 * 3600_000);

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
      itensPendentesPosts,
      itensPendentesCriativos,
      postsDaSemana,
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
      // Pendências de aprovação — estado ATUAL (não filtra por mês), mas
      // usando a MESMA janela de datas que o /calendario mostra (-30/+60d).
      // Sem isso o badge contava posts que o cliente não conseguia achar
      // na lista (ex.: agendados pra daqui a 90 dias).
      // 0 quando o cliente não tem permissão de aprovar aquele tipo.
      podePosts
        ? prisma.post.count({
            where: {
              clienteId,
              status: "COPY_PRONTA",
              dataPublicacao: {
                gte: new Date(agora.getTime() - 30 * 24 * 3600_000),
                lte: new Date(agora.getTime() + 60 * 24 * 3600_000),
              },
            },
          })
        : Promise.resolve(0),
      podeCriativos
        ? prisma.criativo.count({ where: { clienteId, status: "EM_APROVACAO" } })
        : Promise.resolve(0),
      // Itens pendentes LEVES (sem artes/base64) — alimentam o carrossel
      // "Para aprovar" e o herói do Início v5. Máx 6 de cada.
      podePosts
        ? prisma.post.findMany({
            where: {
              clienteId,
              status: "COPY_PRONTA",
              dataPublicacao: {
                gte: new Date(agora.getTime() - 30 * 24 * 3600_000),
                lte: new Date(agora.getTime() + 60 * 24 * 3600_000),
              },
            },
            orderBy: { dataPublicacao: "asc" },
            take: 6,
            select: { id: true, titulo: true, dataPublicacao: true },
          })
        : Promise.resolve([]),
      podeCriativos
        ? prisma.criativo.findMany({
            where: { clienteId, status: "EM_APROVACAO" },
            orderBy: { updatedAt: "desc" },
            take: 6,
            select: { id: true, titulo: true },
          })
        : Promise.resolve([]),
      // Posts da semana atual (strip "Sua semana" do Início v5)
      prisma.post.findMany({
        where: {
          clienteId,
          status: { in: ["COPY_PRONTA", "DESIGN_PRONTO", "AGENDADO", "PUBLICADO"] },
          dataPublicacao: { gte: inicioSemana, lt: fimSemana },
        },
        select: { dataPublicacao: true, status: true },
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

    // Carrossel "Para aprovar" (leve): posts por data + criativos por recência
    type ItemPendente = { id: string; kind: "post" | "criativo"; titulo: string; quando: string | null };
    const itensPendentes: ItemPendente[] = [
      ...itensPendentesPosts.map((p) => ({
        id: p.id,
        kind: "post" as const,
        titulo: p.titulo,
        quando: p.dataPublicacao.toISOString(),
      })),
      ...itensPendentesCriativos.map((c) => ({
        id: c.id,
        kind: "criativo" as const,
        titulo: c.titulo,
        quando: null,
      })),
    ].slice(0, 6);

    // "Sua semana": 7 dias (dom..sáb) com contagem de posts e se há pendência
    const semana = Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(inicioSemana.getTime() + i * 24 * 3600_000);
      const doDia = postsDaSemana.filter(
        (p) => p.dataPublicacao >= dia && p.dataPublicacao < new Date(dia.getTime() + 24 * 3600_000)
      );
      return {
        data: dia.toISOString(),
        posts: doDia.length,
        pendentes: doDia.filter((p) => p.status === "COPY_PRONTA").length,
      };
    });

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
        itens: itensPendentes,
      },
      semana,
      ultimasEntregas,
      totais: {
        postsPublicados: totalPostsPublicados,
      },
    };
  });
}
