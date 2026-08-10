/**
 * Hub 2.0 F1 — helpers de quadros kanban.
 *
 * Concentra o lazy seed do quadro "Agência", a adoção de tarefas órfãs
 * (colunaId null) e as colunas-semente usadas em todo quadro novo.
 *
 * Regras:
 *  - O fluxo semente é só ponto de partida — colunas são 100% editáveis.
 *  - Tarefa órfã com projeto que TEM quadro próprio → adota no quadro do
 *    projeto. Senão → quadro Agência.
 *  - Órfã concluída cai na coluna isConcluido; aberta cai na 1ª coluna.
 */
import { prisma } from "@/lib/db";

export const COLUNAS_SEMENTE = [
  { nome: "Entrada", cor: "#8B8B9D", isConcluido: false },
  { nome: "Em produção", cor: "#3B82F6", isConcluido: false },
  { nome: "Revisão", cor: "#F59E0B", isConcluido: false },
  { nome: "Aguardando cliente", cor: "#EC4899", isConcluido: false },
  { nome: "Concluído", cor: "#10B981", isConcluido: true },
] as const;

/** Cria um quadro já com as colunas-semente. */
export async function criarQuadroComSemente(dados: {
  nome: string;
  icone?: string | null;
  tipo: "AGENCIA" | "PROJETO";
  projetoId?: string | null;
}) {
  return prisma.quadro.create({
    data: {
      nome: dados.nome,
      icone: dados.icone ?? null,
      tipo: dados.tipo,
      projetoId: dados.projetoId ?? null,
      colunas: {
        create: COLUNAS_SEMENTE.map((c, i) => ({
          nome: c.nome,
          cor: c.cor,
          ordem: i,
          isConcluido: c.isConcluido,
        })),
      },
    },
    include: { colunas: { orderBy: { ordem: "asc" } } },
  });
}

/**
 * Garante que existe o quadro Agência (cria na 1ª chamada) e adota
 * todas as tarefas órfãs. Idempotente — seguro chamar a cada GET.
 */
export async function garantirQuadroAgencia() {
  let agencia = await prisma.quadro.findFirst({
    where: { tipo: "AGENCIA" },
    orderBy: { ordem: "asc" },
    include: { colunas: { orderBy: { ordem: "asc" } } },
  });

  if (!agencia) {
    agencia = await criarQuadroComSemente({ nome: "Agência", icone: "⚡", tipo: "AGENCIA" });
  }

  await adotarTarefasOrfas(agencia.id);
  return agencia;
}

/**
 * Distribui tarefas com colunaId=null:
 *  - projeto com quadro próprio → colunas do quadro do projeto
 *  - resto → quadro informado (Agência)
 * Concluídas caem na coluna isConcluido (ou última); abertas na 1ª.
 */
export async function adotarTarefasOrfas(quadroAgenciaId: string) {
  const orfas = await prisma.tarefa.findMany({
    where: { colunaId: null, arquivadaEm: null },
    select: { id: true, concluida: true, projetoId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (orfas.length === 0) return;

  // Cache de colunas por quadro (evita N queries)
  const colunasPorQuadro = new Map<
    string,
    { primeira: string; concluida: string; proximaOrdem: number }
  >();

  async function infoQuadro(quadroId: string) {
    const cached = colunasPorQuadro.get(quadroId);
    if (cached) return cached;
    const colunas = await prisma.coluna.findMany({
      where: { quadroId },
      orderBy: { ordem: "asc" },
      select: { id: true, isConcluido: true },
    });
    if (colunas.length === 0) return null;
    const concluida = colunas.find((c) => c.isConcluido) ?? colunas[colunas.length - 1];
    const maxOrdem = await prisma.tarefa.aggregate({
      where: { colunaId: { in: colunas.map((c) => c.id) } },
      _max: { ordemColuna: true },
    });
    const info = {
      primeira: colunas[0].id,
      concluida: concluida.id,
      proximaOrdem: (maxOrdem._max.ordemColuna ?? 0) + 1,
    };
    colunasPorQuadro.set(quadroId, info);
    return info;
  }

  // Projetos com quadro próprio
  const projetosIds = Array.from(
    new Set(orfas.map((o) => o.projetoId).filter((x): x is string => Boolean(x)))
  );
  const quadrosDeProjetos = projetosIds.length
    ? await prisma.quadro.findMany({
        where: { projetoId: { in: projetosIds } },
        select: { id: true, projetoId: true },
      })
    : [];
  const quadroDoProjeto = new Map(quadrosDeProjetos.map((q) => [q.projetoId as string, q.id]));

  for (const t of orfas) {
    const quadroAlvo = (t.projetoId && quadroDoProjeto.get(t.projetoId)) || quadroAgenciaId;
    const info = await infoQuadro(quadroAlvo);
    if (!info) continue;
    await prisma.tarefa.update({
      where: { id: t.id },
      data: {
        colunaId: t.concluida ? info.concluida : info.primeira,
        ordemColuna: info.proximaOrdem,
      },
    });
    info.proximaOrdem += 1;
  }
}

/**
 * Sincroniza Tarefa.concluida ↔ Coluna.isConcluido quando um card muda
 * de coluna. Retorna o valor de `concluida` que a tarefa deve assumir.
 */
export async function concluidaDaColuna(colunaId: string): Promise<boolean> {
  const col = await prisma.coluna.findUnique({
    where: { id: colunaId },
    select: { isConcluido: true },
  });
  return col?.isConcluido ?? false;
}
