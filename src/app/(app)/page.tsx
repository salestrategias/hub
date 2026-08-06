import { Header } from "@/components/header";
import { prisma } from "@/lib/db";
import { garantirQuadroAgencia } from "@/lib/quadros";
import { QuadroKanban } from "@/components/quadro/quadro-kanban";

export const dynamic = "force-dynamic";

/**
 * Hub 2.0 F1 — a home agora é o quadro de demandas ("Hoje").
 *
 * Decisão Marcelo 06/08/2026: abrir o Hub = cair direto no trabalho.
 * O dashboard antigo vive em /visao-geral (widgets preservados).
 *
 * Server component: garante o quadro Agência (lazy seed + adoção de
 * tarefas órfãs) e entrega o board completo pré-renderizado — o client
 * só hidrata e cuida das interações.
 */
export default async function HojePage() {
  const agencia = await garantirQuadroAgencia();

  const [quadrosRaw, quadroRaw, clientes, projetos, postsProducao, actionsAbertas] = await Promise.all([
    prisma.quadro.findMany({
      orderBy: [{ tipo: "asc" }, { ordem: "asc" }, { createdAt: "asc" }],
      include: {
        projeto: { select: { id: true, nome: true } },
        colunas: {
          orderBy: { ordem: "asc" },
          select: { id: true, _count: { select: { tarefas: true } } },
        },
      },
    }),
    prisma.quadro.findUniqueOrThrow({
      where: { id: agencia.id },
      include: {
        projeto: { select: { id: true, nome: true } },
        colunas: {
          orderBy: { ordem: "asc" },
          include: {
            tarefas: {
              orderBy: { ordemColuna: "asc" },
              include: {
                cliente: { select: { id: true, nome: true } },
                projeto: { select: { id: true, nome: true } },
                checklist: { select: { concluido: true } },
              },
            },
          },
        },
      },
    }),
    prisma.cliente.findMany({
      where: { status: { in: ["ATIVO", "PROSPECT"] } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.projeto.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    // Hub 2.0 F3 — camada "Conteúdo em produção" do quadro Agência:
    // posts que ainda não saíram (fluxo editorial em andamento)
    prisma.post.findMany({
      where: { status: { in: ["RASCUNHO", "COPY_PRONTA", "DESIGN_PRONTO"] } },
      orderBy: { dataPublicacao: "asc" },
      take: 50,
      select: {
        id: true,
        titulo: true,
        status: true,
        formato: true,
        dataPublicacao: true,
        cliente: { select: { id: true, nome: true } },
      },
    }),
    // Camada "Actions de reuniões" — combinados ainda abertos que não
    // viraram tarefa (os que viraram já estão no board como cards reais)
    prisma.reuniaoAction.findMany({
      where: { concluido: false, tarefaId: null },
      orderBy: { ordem: "asc" },
      take: 50,
      select: {
        id: true,
        texto: true,
        responsavel: true,
        prazo: true,
        reuniao: { select: { id: true, titulo: true, data: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col h-screen min-h-0">
      <Header />
      <div className="flex-1 min-h-0">
        <QuadroKanban
          quadroInicial={{
            id: quadroRaw.id,
            nome: quadroRaw.nome,
            icone: quadroRaw.icone,
            tipo: quadroRaw.tipo,
            projeto: quadroRaw.projeto,
            colunas: quadroRaw.colunas.map((c) => ({
              id: c.id,
              nome: c.nome,
              cor: c.cor,
              ordem: c.ordem,
              isConcluido: c.isConcluido,
              tarefas: c.tarefas.map((t) => ({
                id: t.id,
                titulo: t.titulo,
                prioridade: t.prioridade,
                dataEntrega: t.dataEntrega?.toISOString() ?? null,
                concluida: t.concluida,
                tipoDemanda: t.tipoDemanda,
                cliente: t.cliente,
                projeto: t.projeto,
                checklistTotal: t.checklist.length,
                checklistFeitos: t.checklist.filter((i) => i.concluido).length,
              })),
            })),
          }}
          quadros={quadrosRaw.map((q) => ({
            id: q.id,
            nome: q.nome,
            icone: q.icone,
            tipo: q.tipo,
            projetoId: q.projetoId,
            totalCards: q.colunas.reduce((s, c) => s + c._count.tarefas, 0),
          }))}
          clientes={clientes}
          projetos={projetos}
          camadaPosts={postsProducao.map((p) => ({
            id: p.id,
            titulo: p.titulo,
            status: p.status,
            formato: p.formato,
            dataPublicacao: p.dataPublicacao.toISOString(),
            cliente: p.cliente,
          }))}
          camadaActions={actionsAbertas.map((a) => ({
            id: a.id,
            texto: a.texto,
            responsavel: a.responsavel,
            prazo: a.prazo,
            reuniaoId: a.reuniao.id,
            reuniaoTitulo: a.reuniao.titulo,
          }))}
        />
      </div>
    </div>
  );
}
