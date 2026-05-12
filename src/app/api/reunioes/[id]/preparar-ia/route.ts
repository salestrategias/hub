/**
 * POST /api/reunioes/[id]/preparar-ia
 *
 * Modo Claude Max — monta o prompt completo (system + user com
 * transcrição embedada) pronto pra Marcelo colar no Claude Desktop/Web.
 * NÃO chama API — zero custo.
 *
 * Marcelo cola → recebe JSON → /aplicar-ia grava no banco.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const reuniao = await prisma.reuniao.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { nome: true } },
        blocks: { orderBy: { ordem: "asc" } },
      },
    });

    if (reuniao.blocks.length === 0) {
      throw new Error(
        "Reunião sem transcrição. Importe primeiro do Meet ou cole a transcrição manualmente."
      );
    }

    // Reconstrói transcrição em texto plano com timecodes
    const transcricao = reuniao.blocks
      .map((b) => `[${fmtTimecode(b.timestamp)}] ${b.speaker}: ${b.texto}`)
      .join("\n");

    const contexto = montarContexto({
      titulo: reuniao.titulo,
      data: reuniao.data,
      clienteNome: reuniao.cliente?.nome ?? null,
      participantes: reuniao.participantes,
      duracaoSeg: reuniao.duracaoSeg,
    });

    const systemPrompt = `Você é um assistente sênior da SAL Estratégias de Marketing, agência brasileira de marketing digital. Sua tarefa é analisar a transcrição de uma reunião e extrair informações estruturadas pra acompanhamento.

Tom: claro, objetivo, em português do Brasil. Sem floreio. Direto ao ponto.

Sua saída DEVE ser um JSON válido (e SÓ JSON, sem comentário antes ou depois) com esta estrutura:

{
  "resumo": "texto em markdown — 1 parágrafo de visão geral + bullets dos pontos principais. Máximo 1500 caracteres.",
  "action_items": [
    {
      "texto": "ação concreta e mensurável",
      "responsavel": "nome do responsável (string) ou null se não claro",
      "prazo": "prazo em texto livre (string, ex: 'sexta', '15/05', 'próxima reunião') ou null"
    }
  ],
  "capitulos": [
    {
      "timestamp": "HH:MM:SS",
      "titulo": "título curto do bloco temático (max 60 chars)"
    }
  ]
}

Regras:
- resumo: comece com 1 parágrafo "O que rolou:" + bullets curtos com decisões e tópicos. NÃO repita action items aqui.
- action_items: SÓ inclua ações realmente combinadas (não sugestões). Cada item deve ser auto-explicativo sem contexto extra. Mínimo 0, máximo 15.
- capitulos: divida a reunião em 3-7 blocos temáticos. Use o timestamp da PRIMEIRA fala do bloco. Bom pra navegação.
- Se a transcrição estiver muito curta (< 5 trocas), foque no resumo e deixe action_items/capitulos vazios.

Importante: responda APENAS com o JSON. Sem prefácio "Aqui está...", sem markdown wrapping (\`\`\`json), sem texto após.`;

    const userPrompt = `Contexto da reunião:
${contexto}

Transcrição completa:
${transcricao}

Gere o JSON estruturado conforme as instruções.`;

    return {
      systemPrompt,
      userPrompt,
      // Tamanho aproximado pra Marcelo saber se vai caber numa janela
      tamanhoEstimado: systemPrompt.length + userPrompt.length,
      blocoCount: reuniao.blocks.length,
    };
  });
}

function fmtTimecode(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function montarContexto(r: {
  titulo: string;
  data: Date;
  clienteNome: string | null;
  participantes: string[];
  duracaoSeg: number | null;
}): string {
  const linhas: string[] = [];
  linhas.push(`- Título: ${r.titulo}`);
  linhas.push(`- Data: ${r.data.toLocaleDateString("pt-BR")}`);
  if (r.clienteNome) linhas.push(`- Cliente: ${r.clienteNome}`);
  if (r.participantes.length > 0) linhas.push(`- Participantes: ${r.participantes.join(", ")}`);
  if (r.duracaoSeg) {
    const min = Math.round(r.duracaoSeg / 60);
    linhas.push(`- Duração: ${min} minutos`);
  }
  return linhas.join("\n");
}
