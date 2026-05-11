import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Modo Claude Max: monta o prompt completo (system + user) pronto pra
 * Marcelo colar no Claude Desktop/Web. NÃO chama IA — zero custo de API.
 *
 * Marcelo cola, recebe JSON, e usa o endpoint /aplicar-ia pra gravar.
 */

const inputSchema = z.object({
  prompt: z.string().min(20, "Descreva melhor (mínimo 20 caracteres)").max(4000),
  tom: z.enum(["formal", "consultivo", "direto", "premium"]).default("consultivo"),
});

const TOM_INSTRUCOES: Record<z.infer<typeof inputSchema>["tom"], string> = {
  formal: "Formal e corporativo. Frases bem estruturadas, vocabulário técnico moderado. Bom pra empresas tradicionais (B2B, indústria, jurídico).",
  consultivo: "Consultivo e parceiro. Tom de quem entendeu o problema e propõe solução. Estabelece autoridade sem soar arrogante. Bom pra mid-market.",
  direto: "Direto e moderno. Frases curtas, ZERO floreio. Quase startup. Bom pra negócios digitais, SaaS, e-commerce.",
  premium: "Premium e curado. Como uma agência de luxo. Linguagem refinada, foco em valor (não preço). Bom pra marcas de alto padrão, moda, hospitalidade.",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
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

    // Junta system + user em um único bloco pra Marcelo colar de uma vez
    // no Claude Desktop/Web (que não tem separação de system message na UI).
    const promptCompleto = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    return {
      promptCompleto,
      systemPrompt,
      userPrompt,
    };
  });
}

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
