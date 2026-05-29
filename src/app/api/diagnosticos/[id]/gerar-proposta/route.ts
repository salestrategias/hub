import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { diagnosticoGerarPropostaSchema } from "@/lib/schemas";
import { proximoNumeroProposta } from "@/lib/proposta-numero";
import { extrairTextoDeBlocos } from "@/lib/proposta-helpers";
import { textToBlocks } from "@/components/editor/text-to-blocks";
import { normalizarSecoes, type DiagnosticoSecao, type SecaoTipo } from "@/lib/diagnostico-secoes";

/**
 * Ponte Diagnóstico → Proposta.
 *
 * Cria UMA proposta a partir do diagnóstico, levando as seções relevantes
 * pras colunas da proposta (que tem seções FIXAS, não modulares):
 *
 *   proposta.diagnostico    ← narrativa (sumário, contexto, presença, marca,
 *                             público, concorrência, gargalos, oportunidades + custom)
 *   proposta.objetivo       ← metasKpis
 *   proposta.escopo         ← recomendacoesPlano
 *   proposta.proximosPassos ← proximosPassos
 *
 * A `capa` do diagnóstico é ignorada (proposta tem capa própria). Colunas
 * comerciais (cronograma, investimento, termos) ficam vazias pro Marcelo.
 *
 * Idempotente: se o diagnóstico já tem `propostaId`, devolve a existente sem
 * criar outra (o editor então só navega pra ela). Diagnóstico não vira
 * proposta automaticamente — é um clique consciente.
 */

type ColunaProposta = "diagnostico" | "objetivo" | "escopo" | "proximosPassos";

/** Pra qual coluna da proposta cada tipo de seção do diagnóstico vai. */
const TIPO_PARA_COLUNA: Partial<Record<SecaoTipo, ColunaProposta>> = {
  sumarioExecutivo: "diagnostico",
  contextoNegocio: "diagnostico",
  presencaDigital: "diagnostico",
  marcaPosicionamento: "diagnostico",
  publicoJornada: "diagnostico",
  concorrenciaMercado: "diagnostico",
  gargalos: "diagnostico",
  oportunidades: "diagnostico",
  custom: "diagnostico", // insights próprios do Marcelo entram na narrativa
  metasKpis: "objetivo",
  recomendacoesPlano: "escopo",
  proximosPassos: "proximosPassos",
  // capa: ignorada de propósito (proposta tem capa própria)
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = diagnosticoGerarPropostaSchema.parse(await req.json().catch(() => ({})));

    const diagnostico = await prisma.diagnostico.findUniqueOrThrow({
      where: { id: params.id },
    });

    // Idempotência: já gerou? devolve a existente. `propostaId` vira null se a
    // proposta for deletada (onDelete: SetNull) — então não-null = viva.
    if (diagnostico.propostaId) {
      return { id: diagnostico.propostaId, propostaId: diagnostico.propostaId, jaExistia: true };
    }

    // Agrupa as seções elegíveis (visíveis + com conteúdo) por coluna da
    // proposta, preservando a ordem que o Marcelo arranjou no diagnóstico.
    const secoes = normalizarSecoes(diagnostico.secoes);
    const grupos: Record<ColunaProposta, DiagnosticoSecao[]> = {
      diagnostico: [],
      objetivo: [],
      escopo: [],
      proximosPassos: [],
    };
    for (const s of secoes) {
      const coluna = TIPO_PARA_COLUNA[s.tipo];
      if (!coluna || !s.visivel || !temConteudo(s.conteudo)) continue;
      grupos[coluna].push(s);
    }

    const numero = await proximoNumeroProposta();
    const titulo = body.titulo?.trim() || `Proposta — ${diagnostico.titulo}`;

    // Cria a proposta + vincula no diagnóstico atomicamente, pra não deixar
    // proposta órfã se o vínculo falhar (senão a próxima chamada duplicaria).
    const proposta = await prisma.$transaction(async (tx) => {
      const criada = await tx.proposta.create({
        data: {
          numero,
          titulo,
          clienteId: diagnostico.clienteId,
          clienteNome: diagnostico.clienteNome,
          clienteEmail: diagnostico.clienteEmail,
          leadId: diagnostico.leadId,
          logoUrl: diagnostico.logoUrl,
          corPrimaria: diagnostico.corPrimaria,
          capaImagemUrl: diagnostico.capaImagemUrl,
          diagnostico: montarColuna(grupos.diagnostico),
          objetivo: montarColuna(grupos.objetivo),
          escopo: montarColuna(grupos.escopo),
          proximosPassos: montarColuna(grupos.proximosPassos),
          criadoPor: user.id,
        },
      });
      await tx.diagnostico.update({
        where: { id: diagnostico.id },
        data: { propostaId: criada.id },
      });
      return criada;
    });

    return { id: proposta.id, propostaId: proposta.id, numero: proposta.numero };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Tem texto renderizável? (mesma intenção do `temTexto` da pública). */
function temConteudo(conteudo: string): boolean {
  return extrairTextoDeBlocos(conteudo).trim().length > 0;
}

/** conteudo (JSON BlockNote ou texto legado) → array de blocos BlockNote. */
function parseBlocks(conteudo: string): unknown[] {
  const t = (conteudo ?? "").trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // não-parseável → trata como texto legado abaixo
    }
  }
  return textToBlocks(t) as unknown[];
}

/** Bloco heading nível 2 com o título da seção. */
function headingBlock(titulo: string): unknown {
  return { type: "heading", props: { level: 2 }, content: titulo };
}

/**
 * Concatena os blocos das seções de uma coluna num único JSON BlockNote.
 * Com >1 seção, prefixa cada uma com um heading (título) pra dar estrutura;
 * com 1 só, vai o conteúdo cru (o título da própria coluna da proposta basta).
 * Sem seções → null (coluna fica vazia pro Marcelo preencher).
 */
function montarColuna(grupo: DiagnosticoSecao[]): string | null {
  if (grupo.length === 0) return null;
  const comTitulos = grupo.length > 1;
  const blocks: unknown[] = [];
  for (const s of grupo) {
    if (comTitulos) blocks.push(headingBlock(s.titulo));
    blocks.push(...parseBlocks(s.conteudo));
  }
  return blocks.length > 0 ? JSON.stringify(blocks) : null;
}
