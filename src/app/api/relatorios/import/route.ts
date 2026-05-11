/**
 * POST /api/relatorios/import
 *
 * Recebe rows JÁ PARSEADAS pelo client (front cola CSV → parseCsv → manda
 * aqui só os objects). Server faz mapeamento (alias matching) + upsert.
 *
 * Por que parsear no client? CSV pode ser pesado (50KB+), e o parser é
 * puro JS sem deps externas — economiza round-trip e mantém o server
 * focado em validação + DB. Server faz re-validação shape via zod.
 *
 * Idempotência: upsert por chave natural (ver mapeadores). Re-importar
 * a mesma planilha simplesmente atualiza os valores existentes.
 *
 * Resposta:
 *   {
 *     ok: true,
 *     fonte: "REDES" | "SEO" | "TRAFEGO",
 *     totalLinhas, criadas, atualizadas, ignoradas,
 *     erros: [{ linha, erro, raw }]
 *   }
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { importarRelatorioSchema } from "@/lib/schemas";
import { mapearRedes, mapearSeo, mapearTrafego } from "@/lib/relatorio-mapeadores";

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const { clienteId, fonte, rows, integracaoId } = importarRelatorioSchema.parse(body);

    // Confirma que cliente existe (evita FK constraint após processamento todo)
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true } });
    if (!cliente) throw new Error("Cliente não encontrado");

    // Normaliza rows pra string-only (zod aceita number|null mas mapeadores
    // esperam strings — convertemos aqui pra simplificar o contrato)
    const rowsStr: Record<string, string>[] = rows.map((r) => {
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        o[k] = v === null || v === undefined ? "" : String(v);
      }
      return o;
    });

    let criadas = 0;
    let atualizadas = 0;
    let errosTotal: { linha: number; erro: string; raw: Record<string, string> }[] = [];
    let totalLinhas = rowsStr.length;

    if (fonte === "REDES") {
      const resultado = mapearRedes(rowsStr);
      errosTotal = resultado.erros;
      for (const item of resultado.sucessos) {
        const existe = await prisma.metricaRede.findUnique({
          where: {
            clienteId_rede_ano_mes: {
              clienteId,
              rede: item.dados.rede,
              ano: item.dados.ano,
              mes: item.dados.mes,
            },
          },
          select: { id: true },
        });
        await prisma.metricaRede.upsert({
          where: {
            clienteId_rede_ano_mes: {
              clienteId,
              rede: item.dados.rede,
              ano: item.dados.ano,
              mes: item.dados.mes,
            },
          },
          create: { clienteId, ...item.dados },
          update: { ...item.dados },
        });
        if (existe) atualizadas++; else criadas++;
      }
    } else if (fonte === "SEO") {
      const resultado = mapearSeo(rowsStr);
      errosTotal = resultado.erros;
      for (const item of resultado.sucessos) {
        const existe = await prisma.metricaSeo.findUnique({
          where: { clienteId_ano_mes: { clienteId, ano: item.dados.ano, mes: item.dados.mes } },
          select: { id: true },
        });
        await prisma.metricaSeo.upsert({
          where: { clienteId_ano_mes: { clienteId, ano: item.dados.ano, mes: item.dados.mes } },
          create: { clienteId, ...item.dados },
          update: { ...item.dados },
        });
        if (existe) atualizadas++; else criadas++;
      }
    } else if (fonte === "TRAFEGO") {
      const resultado = mapearTrafego(rowsStr);
      errosTotal = resultado.erros;
      // CampanhaPaga não tem unique composta — usamos heurística:
      // mesmo cliente+ano+mes+plataforma+nome → update, senão create.
      for (const item of resultado.sucessos) {
        const existe = await prisma.campanhaPaga.findFirst({
          where: {
            clienteId,
            ano: item.dados.ano,
            mes: item.dados.mes,
            plataforma: item.dados.plataforma,
            nome: item.dados.nome,
          },
          select: { id: true },
        });
        if (existe) {
          await prisma.campanhaPaga.update({
            where: { id: existe.id },
            data: { ...item.dados },
          });
          atualizadas++;
        } else {
          await prisma.campanhaPaga.create({ data: { clienteId, ...item.dados } });
          criadas++;
        }
      }
    }

    // Se vier vinculada a uma integração, atualiza ultimaSync + totalLinhas
    if (integracaoId) {
      await prisma.integracaoSheets
        .update({
          where: { id: integracaoId },
          data: {
            ultimaSync: new Date(),
            totalLinhas: criadas + atualizadas,
            ultimoErro: errosTotal.length > 0 ? `${errosTotal.length} linha(s) com erro` : null,
          },
        })
        .catch(() => {/* integração pode ter sido deletada — ignora */});
    }

    return {
      ok: true,
      fonte,
      cliente: cliente.nome,
      totalLinhas,
      criadas,
      atualizadas,
      ignoradas: errosTotal.length,
      erros: errosTotal.slice(0, 20), // limita pra não explodir payload
      erroTotal: errosTotal.length,
    };
  });
}
