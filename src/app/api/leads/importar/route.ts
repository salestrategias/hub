/**
 * POST /api/leads/importar
 *
 * Recebe rows já parseadas do front (CSV/Sheets) e cria leads no
 * pipeline. Cada linha vira 1 Lead com status NOVO + responsável =
 * usuário logado.
 *
 * Dedup por email (case-insensitive, trimmed):
 *   - modo "pular" (default): se email já existe, conta como ignorado
 *   - modo "atualizar": faz merge — só preenche campos null/empty no
 *     lead existente, nunca sobrescreve dado já qualificado
 *   - modo "criar_sempre": ignora dup e cria sempre (usar com cuidado)
 *
 * Score automático é calculado no PATCH/POST normal de Lead. Aqui
 * passamos `score: 0` e deixamos o próprio modelo recalcular na
 * primeira edição via lib/lead-score (chamada implícita no PATCH).
 * Pra evitar 100 leads zerados, calculamos inline aqui também.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { importarLeadsSchema } from "@/lib/schemas";
import { mapearLeads } from "@/lib/lead-mapeador";
import { calcularLeadScore } from "@/lib/lead-score";

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = await req.json();
    const { rows, origemOverride, modo } = importarLeadsSchema.parse(body);

    // Normaliza rows → strings (mapeador espera string puro)
    const rowsStr: Record<string, string>[] = rows.map((r) => {
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) {
        o[k] = v === null || v === undefined ? "" : String(v);
      }
      return o;
    });

    const resultado = mapearLeads(rowsStr);
    let criados = 0;
    let atualizados = 0;
    let pulados = 0;
    const errosFinais: { linha: number; erro: string; raw: Record<string, string> }[] = [...resultado.erros];

    for (let i = 0; i < resultado.sucessos.length; i++) {
      const { dados, raw } = resultado.sucessos[i];
      const linha = i + 2;

      try {
        // Dedup por email — só se email não estiver vazio
        const existente = dados.contatoEmail
          ? await prisma.lead.findFirst({
              where: { contatoEmail: dados.contatoEmail },
              select: { id: true, contatoNome: true, contatoTelefone: true, segmento: true, notas: true, origem: true, status: true },
            })
          : null;

        if (existente && modo === "pular") {
          pulados++;
          continue;
        }

        if (existente && modo === "atualizar") {
          // Merge não-destrutivo: só preenche campos vazios
          const score = calcularLeadScore({
            contatoEmail: dados.contatoEmail,
            contatoTelefone: dados.contatoTelefone ?? existente.contatoTelefone,
            valorEstimadoMensal: null,
            notas: dados.notas ?? existente.notas,
            proximaAcaoEm: null,
            origem: dados.origem ?? existente.origem,
            status: existente.status,
            updatedAt: new Date(),
          });
          await prisma.lead.update({
            where: { id: existente.id },
            data: {
              contatoNome: existente.contatoNome || dados.contatoNome,
              contatoTelefone: existente.contatoTelefone || dados.contatoTelefone,
              notas: existente.notas || dados.notas,
              origem: existente.origem || origemOverride || dados.origem,
              score: score.total,
            },
          });
          atualizados++;
          continue;
        }

        // Cria novo (modo "criar_sempre" ou primeira vez)
        const score = calcularLeadScore({
          contatoEmail: dados.contatoEmail,
          contatoTelefone: dados.contatoTelefone,
          valorEstimadoMensal: null,
          notas: dados.notas,
          proximaAcaoEm: null,
          origem: dados.origem,
          status: "NOVO",
          updatedAt: new Date(),
        });
        await prisma.lead.create({
          data: {
            empresa: dados.empresa,
            contatoNome: dados.contatoNome,
            contatoEmail: dados.contatoEmail,
            contatoTelefone: dados.contatoTelefone,
            origem: origemOverride || dados.origem,
            notas: dados.notas,
            status: "NOVO",
            prioridade: "NORMAL",
            tags: [],
            score: score.total,
            responsavel: user.id,
          },
        });
        criados++;
      } catch (err) {
        errosFinais.push({
          linha,
          erro: err instanceof Error ? err.message : "Erro desconhecido",
          raw,
        });
      }
    }

    return {
      ok: true,
      totalLinhas: rowsStr.length,
      criados,
      atualizados,
      pulados,
      ignorados: errosFinais.length,
      erros: errosFinais.slice(0, 20),
      erroTotal: errosFinais.length,
    };
  });
}
