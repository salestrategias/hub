/**
 * GET /api/p/cliente/[token]/resultados
 *
 * Alimenta a aba RESULTADOS do Portal v5 — o valor da SAL visível sem o
 * cliente pedir:
 *  - metricas: alcance / interações (engajamento) / seguidores do mês
 *    corrente somados entre as redes, com delta % vs mês anterior
 *  - alcancePorMes: últimos 4 meses (gráfico de barras)
 *  - entregasMes: posts publicados no mês (contexto)
 *
 * Fonte: MetricaRede (mensal, por rede — mesma base do relatório PDF).
 * `temDados=false` quando o cliente ainda não tem métricas importadas —
 * o front mostra estado vazio elegante em vez de zeros mentirosos.
 *
 * Permissão: verRelatorios (é a mesma área de "resultados").
 */
import { apiHandler, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Delta % arredondado (null quando não há base de comparação). */
function delta(atual: number, anterior: number | null): number | null {
  if (anterior === null || anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.verRelatorios) throw new ApiError(403, "Sem permissão pra resultados");
    const clienteId = r.cliente.id;

    // Últimos 4 meses (incluindo o corrente), do mais antigo pro mais novo
    const agora = new Date();
    const meses: { ano: number; mes: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      meses.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    }
    // + o mês anterior ao 1º da janela (base do delta do gráfico não precisa,
    //   mas o delta do mês corrente compara com o mês -1, que já está na janela)

    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioProxMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

    const [linhas, postsPublicadosMes] = await Promise.all([
      prisma.metricaRede.findMany({
        where: {
          clienteId,
          OR: meses.map((m) => ({ ano: m.ano, mes: m.mes })),
        },
        select: { ano: true, mes: true, alcance: true, engajamento: true, seguidores: true },
      }),
      prisma.post.count({
        where: {
          clienteId,
          status: "PUBLICADO",
          dataPublicacao: { gte: inicioMesAtual, lt: inicioProxMes },
        },
      }),
    ]);

    // Soma por mês entre as redes
    const porMes = meses.map((m) => {
      const doMes = linhas.filter((l) => l.ano === m.ano && l.mes === m.mes);
      return {
        ano: m.ano,
        mes: m.mes,
        rotulo: MESES_CURTO[m.mes - 1],
        alcance: doMes.reduce((s, l) => s + l.alcance, 0),
        interacoes: doMes.reduce((s, l) => s + l.engajamento, 0),
        seguidores: doMes.reduce((s, l) => s + l.seguidores, 0),
        temDados: doMes.length > 0,
      };
    });

    const atual = porMes[porMes.length - 1];
    const anterior = porMes[porMes.length - 2];
    const baseAnterior = anterior?.temDados ? anterior : null;

    return {
      mes: { ano: atual.ano, mes: atual.mes, rotulo: MESES_CURTO[atual.mes - 1] },
      metricas: {
        temDados: porMes.some((m) => m.temDados),
        alcance: atual.alcance,
        alcanceDelta: delta(atual.alcance, baseAnterior?.alcance ?? null),
        interacoes: atual.interacoes,
        interacoesDelta: delta(atual.interacoes, baseAnterior?.interacoes ?? null),
        seguidores: atual.seguidores,
        seguidoresDelta: delta(atual.seguidores, baseAnterior?.seguidores ?? null),
      },
      alcancePorMes: porMes.map((m) => ({ rotulo: m.rotulo, alcance: m.alcance, temDados: m.temDados })),
      entregasMes: { postsPublicados: postsPublicadosMes },
    };
  });
}
