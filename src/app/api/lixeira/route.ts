/**
 * GET    /api/lixeira — lista itens da lixeira (purge lazy de +30d antes)
 *                       + itens ARQUIVADOS (tarefas e páginas) na mesma
 *                       resposta, pra tela /lixeira ter as duas abas.
 * DELETE /api/lixeira — esvazia a lixeira inteira (irreversível).
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { purgarLixeiraAntiga, labelDoTipo, LIXEIRA_RETENCAO_DIAS } from "@/lib/lixeira";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    await purgarLixeiraAntiga();

    const [itens, tarefasArquivadas, paginasArquivadas] = await Promise.all([
      prisma.lixeiraItem.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, tipo: true, titulo: true, createdAt: true },
      }),
      prisma.tarefa.findMany({
        where: { arquivadaEm: { not: null } },
        orderBy: { arquivadaEm: "desc" },
        take: 200,
        select: { id: true, titulo: true, arquivadaEm: true, cliente: { select: { nome: true } } },
      }),
      prisma.page.findMany({
        where: { arquivadaEm: { not: null } },
        orderBy: { arquivadaEm: "desc" },
        take: 200,
        select: { id: true, titulo: true, icone: true, arquivadaEm: true },
      }),
    ]);

    return {
      retencaoDias: LIXEIRA_RETENCAO_DIAS,
      lixeira: itens.map((i) => ({
        id: i.id,
        tipo: i.tipo,
        tipoLabel: labelDoTipo(i.tipo),
        titulo: i.titulo,
        apagadoEm: i.createdAt.toISOString(),
      })),
      arquivados: [
        ...tarefasArquivadas.map((t) => ({
          id: t.id,
          tipo: "TAREFA" as const,
          tipoLabel: "Tarefa",
          titulo: t.titulo,
          detalhe: t.cliente?.nome ?? null,
          arquivadoEm: t.arquivadaEm!.toISOString(),
        })),
        ...paginasArquivadas.map((p) => ({
          id: p.id,
          tipo: "PAGE" as const,
          tipoLabel: "Página",
          titulo: `${p.icone ? p.icone + " " : ""}${p.titulo}`,
          detalhe: null,
          arquivadoEm: p.arquivadaEm!.toISOString(),
        })),
      ].sort((a, b) => b.arquivadoEm.localeCompare(a.arquivadoEm)),
    };
  });
}

export async function DELETE() {
  return apiHandler(async () => {
    await requireAuth();
    const r = await prisma.lixeiraItem.deleteMany({});
    return { ok: true, removidos: r.count };
  });
}
