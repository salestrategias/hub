import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Gera o conteúdo das seções da proposta usando Claude.
 *
 * Recebe um prompt livre + contexto opcional sobre o cliente (já
 * embutido se a proposta tem clienteId). Devolve JSON com as 8
 * seções preenchidas em formato BlockNote pronto pra renderizar.
 *
 * Requer env `ANTHROPIC_API_KEY`. Sem a key, retorna erro
 * orientando o admin a configurar.
 */

const inputSchema = z.object({
  prompt: z.string().min(20, "Descreva melhor (mínimo 20 caracteres)").max(4000),
  tom: z.enum(["formal", "consultivo", "direto", "premium"]).default("consultivo"),
  /** Sobrescrever campos atuais? Default false (preserva o que já tem). */
  sobrescrever: z.boolean().default(false),
});

type SecaoKey =
  | "capa"
  | "diagnostico"
  | "objetivo"
  | "escopo"
  | "cronograma"
  | "investimento"
  | "proximosPassos"
  | "termos";

// Modelo Claude a usar. claude-sonnet-4-5 = ótimo equilíbrio qualidade/custo.
const MODELO = "claude-sonnet-4-5";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Anthropic API Key não configurada. Defina ANTHROPIC_API_KEY no .env do servidor e reinicie o app. Obtém uma em console.anthropic.com (pagamento por uso, ~$5/mês pra propostas)."
      );
    }

    const body = inputSchema.parse(await req.json());

    const proposta = await prisma.proposta.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: {
          select: {
            nome: true,
            cnpj: true,
            email: true,
            notas: true,
            valorContratoMensal: true,
          },
        },
      },
    });

    const contextoCliente = montarContexto(proposta.cliente, proposta.clienteNome);

    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `Você é um sênior de propostas comerciais da SAL Estratégias de Marketing — uma agência brasileira de marketing digital. Sua tarefa é gerar conteúdo profissional para uma proposta comercial, organizado em 8 seções estruturadas.

Tom: ${TOM_INSTRUCOES[body.tom]}

Regras gerais:
- Português do Brasil. Linguagem clara, sem jargão desnecessário.
- Foco em RESULTADO mensurável. Evite vagueza ("vamos potencializar sua marca" → "vamos gerar X leads qualificados/mês").
- Use 1ª pessoa do plural ("vamos", "entregamos", "nossa equipe").
- Sem inventar números específicos do cliente que você não conhece. Use ranges ou placeholders quando necessário.

Para cada seção, escreva conteúdo PRONTO pra ser colado direto na proposta, em formato MARKDOWN simples (## headings, listas com -, parágrafos). NÃO use ### h3 ou tabelas complexas — só ## e listas.

Seções a gerar (em ordem):
1. capa — apresentação curta (1-2 parágrafos): quem é a SAL, o que entregamos
2. diagnostico — 2-3 parágrafos descrevendo o que entendemos do cliente baseado no prompt + listinha das principais dores percebidas
3. objetivo — 1 parágrafo do norte + lista de 3-5 objetivos SMART
4. escopo — seção mais densa: 3-5 pilares de entrega (ex: ## Tráfego pago, ## Conteúdo orgânico, ## SEO) cada um com 3-6 bullets do que está incluído. Esse é o coração da proposta
5. cronograma — fases por mês ou trimestre. Ex: ## Mês 1 — Setup; ## Mês 2-3 — Aceleração; ## Mês 4+ — Otimização
6. investimento — descrição em texto do que está incluído no valor + condições de pagamento (não invente valores específicos; use placeholder R$ XX/mês ou referencie {{valor.mensal}})
7. proximosPassos — 3-5 passos curtos pra começar (aceite digital → contrato → kickoff → etc)
8. termos — vigência, política de cancelamento (aviso prévio), reajuste anual, propriedade intelectual. Tom conciso, sem advoguês.

IMPORTANTE: responda APENAS com JSON válido no formato:
{
  "capa": "markdown da capa",
  "diagnostico": "markdown do diagnostico",
  "objetivo": "...",
  "escopo": "...",
  "cronograma": "...",
  "investimento": "...",
  "proximosPassos": "...",
  "termos": "..."
}

Sem comentários, sem texto fora do JSON.`;

    const userPrompt = `# Contexto da proposta

## Cliente
${contextoCliente}

## Descrição da oportunidade
${body.prompt}

${
  proposta.valorMensal
    ? `\n## Valor mensal previsto\nR$ ${Number(proposta.valorMensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : ""
}
${proposta.duracaoMeses ? `\n## Duração prevista\n${proposta.duracaoMeses} meses` : ""}

Gere as 8 seções no formato JSON especificado.`;

    const response = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const conteudo = response.content[0];
    if (conteudo.type !== "text") {
      throw new Error("Resposta inesperada da IA");
    }

    // Extrai JSON. Claude às vezes embala em ```json...```
    const jsonStr = extrairJson(conteudo.text);
    let secoes: Record<SecaoKey, string>;
    try {
      secoes = JSON.parse(jsonStr);
    } catch {
      throw new Error("IA retornou formato inválido. Tente novamente ou reformule o prompt.");
    }

    // Converte cada markdown em JSON BlockNote (reaproveita textToBlocks)
    const { textToBlocks } = await import("@/components/editor/text-to-blocks");
    const updates: Partial<Record<SecaoKey, string>> = {};
    for (const [key, markdown] of Object.entries(secoes)) {
      if (!markdown || typeof markdown !== "string") continue;
      const blocks = textToBlocks(markdown);
      updates[key as SecaoKey] = JSON.stringify(blocks);
    }

    // Aplica: se sobrescrever, troca tudo. Senão, só preenche seções vazias.
    const data: Record<string, string> = {};
    for (const [key, json] of Object.entries(updates)) {
      const atual = proposta[key as SecaoKey];
      if (body.sobrescrever || isVazio(atual)) {
        data[key] = json!;
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.proposta.update({
        where: { id: params.id },
        data,
      });
    }

    return {
      ok: true,
      secoesAtualizadas: Object.keys(data),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────

const TOM_INSTRUCOES: Record<z.infer<typeof inputSchema>["tom"], string> = {
  formal: "Formal e corporativo. Frases bem estruturadas, vocabulário técnico moderado. Bom pra empresas tradicionais (B2B, indústria, jurídico).",
  consultivo: "Consultivo e parceiro. Tom de quem entendeu o problema e propõe solução. Estabelece autoridade sem soar arrogante. Bom pra mid-market.",
  direto: "Direto e moderno. Frases curtas, ZERO floreio. Quase startup. Bom pra negócios digitais, SaaS, e-commerce.",
  premium: "Premium e curado. Como uma agência de luxo. Linguagem refinada, foco em valor (não preço). Bom pra marcas de alto padrão, moda, hospitalidade.",
};

function montarContexto(
  cliente: {
    nome: string;
    cnpj: string | null;
    email: string | null;
    notas: string | null;
    valorContratoMensal: { toString: () => string };
  } | null,
  fallbackNome: string
): string {
  if (!cliente) {
    return `Nome: ${fallbackNome} (prospect sem cadastro no Hub)`;
  }
  const linhas = [`Nome: ${cliente.nome}`];
  if (cliente.cnpj) linhas.push(`CNPJ: ${cliente.cnpj}`);
  if (cliente.email) linhas.push(`Email: ${cliente.email}`);
  if (cliente.notas && cliente.notas.trim()) {
    linhas.push(`\nNotas internas sobre o cliente:\n${cliente.notas.slice(0, 2000)}`);
  }
  return linhas.join("\n");
}

function extrairJson(texto: string): string {
  // Remove cercas markdown se houver
  const fenced = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return texto.trim();
}

function isVazio(valor: unknown): boolean {
  if (!valor || typeof valor !== "string") return true;
  const trimmed = valor.trim();
  if (!trimmed) return true;
  // Tenta parsear JSON BlockNote vazio
  if (trimmed.startsWith("[")) {
    try {
      const blocks = JSON.parse(trimmed) as Array<{ content?: unknown }>;
      return !blocks.some((b) => {
        const c = b.content;
        if (typeof c === "string") return c.trim().length > 0;
        if (Array.isArray(c) && c.length > 0) return true;
        return false;
      });
    } catch {
      return false;
    }
  }
  return false;
}
