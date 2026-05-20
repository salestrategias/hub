/**
 * POST /api/propostas/[id]/preparar-analise-ia
 *
 * Peer review da proposta atual via Claude Max copy-paste.
 *
 * IA atua como senior reviewer comercial: olha o conteudo da proposta
 * (seções + extras + valores + cliente) e devolve análise estruturada
 * com pontos fortes/fracos, gaps de informação, sugestões de melhoria
 * e risco de objeção do cliente.
 *
 * Usa o mesmo padrão Claude Max — zero custo de API.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { extrairTextoDeBlocos } from "@/lib/proposta-helpers";
import { normalizarExtras } from "@/lib/proposta-blocos";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const proposta = await prisma.proposta.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: {
          select: {
            nome: true,
            valorContratoMensal: true,
            notas: true,
            status: true,
          },
        },
      },
    });

    const extras = normalizarExtras(proposta.extras);
    const formatBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

    // Helpers pra mostrar só texto limpo das seções (BlockNote → plain)
    const secaoTexto = (raw: string | null) => {
      if (!raw) return "(vazia)";
      const t = extrairTextoDeBlocos(raw).trim();
      return t || "(vazia)";
    };

    const systemPrompt = `Você é um senior de vendas B2B (consultor comercial sênior) revisando uma proposta comercial de uma agência de marketing brasileira (SAL Estratégias de Marketing) ANTES dela ser enviada pro cliente. Seu papel é ser um peer reviewer crítico mas construtivo.

Tom: direto, especialista, focado em conversão. Não passe a mão na cabeça — aponte problemas reais. Mas também reconheça o que tá bom.

Critérios de avaliação (use todos):
1. Clareza da promessa de valor — o cliente entende em 30s o que vai receber e por que vale o investimento?
2. Especificidade — tem números, prazos, metas SMART, ou é vago/genérico?
3. Adequação ao perfil do cliente — o que sabemos do cliente (notas, ticket) bate com o que oferecemos?
4. Gap de informação — o que tá faltando que o cliente provavelmente vai perguntar?
5. Risco de objeção — quais perguntas/objeções esperar (preço, prazo, escopo, garantias)?
6. Estrutura comercial — proposta tem pacotes/cases/garantias/timeline pra reforçar percepção de valor?

Responda APENAS com JSON válido neste shape:
{
  "notaGeral": 0-10 (numero inteiro ou .5),
  "vereditoCurto": "1 frase (max 200 chars) que resume sua opinião — 'pronto pra enviar' / 'precisa ajustes antes' / 'reestruturar antes de enviar'",
  "pontosFortes": [
    "3 strings (max 150 chars cada). O que tá bem feito e ajuda a fechar."
  ],
  "pontosFracos": [
    "3-5 strings (max 150 chars cada). O que tá ruim/genérico/raso e atrapalha o fechamento."
  ],
  "gapsInformacao": [
    "2-4 strings. O que tá faltando que cliente provavelmente vai perguntar. Ex: 'Não menciona quem vai ser o gerente da conta', 'Sem detalhar prazo de kickoff'."
  ],
  "sugestoesMelhoria": [
    "3-5 strings ACIONÁVEIS. Cada uma = ajuste específico, com seção alvo. Ex: 'No Diagnóstico, citar dados concretos do setor X em vez de afirmações genéricas', 'Adicionar pacote intermediário entre R$ 2.5k e R$ 9.5k — gap muito grande'."
  ],
  "riscoObjecoes": [
    "2-4 strings. Cada uma = objeção provável + sugestão de como preparar resposta. Ex: 'PREÇO: cliente pode achar R$ 9.5k caro vs concorrência local — reforçar ROI esperado', 'PRAZO: 4 meses pra SEO pode parecer longo — explicar fases'."
  ]
}

Sem texto fora do JSON. Sem markdown wrapping. Sem comentários.`;

    const ticketCliente = Number(proposta.cliente?.valorContratoMensal ?? 0);

    const userPrompt = `# Proposta pra revisar: ${proposta.numero} — "${proposta.titulo}"

## Cliente
- Nome: ${proposta.clienteNome}
- Status no CRM: ${proposta.cliente?.status ?? "não cadastrado"}
- Ticket atual do cliente: ${ticketCliente > 0 ? formatBRL(ticketCliente) + "/mês" : "(cliente novo ou sem contrato ativo)"}
- Notas internas: ${proposta.cliente?.notas ? extrairTextoDeBlocos(proposta.cliente.notas).slice(0, 1500) : "(nenhuma)"}

## Valores propostos
- Mensal: ${proposta.valorMensal ? formatBRL(Number(proposta.valorMensal)) : "(não definido)"}
- Total: ${proposta.valorTotal ? formatBRL(Number(proposta.valorTotal)) : "(não definido)"}
- Duração: ${proposta.duracaoMeses ? `${proposta.duracaoMeses} meses` : "(não definida)"}
- Validade do envio: ${proposta.validadeDias} dias

## Seções de texto da proposta

### Capa / apresentação
${secaoTexto(proposta.capa).slice(0, 1500)}

### Diagnóstico
${secaoTexto(proposta.diagnostico).slice(0, 1500)}

### Objetivo
${secaoTexto(proposta.objetivo).slice(0, 1500)}

### Estratégia & escopo
${secaoTexto(proposta.escopo).slice(0, 2500)}

### Cronograma
${secaoTexto(proposta.cronograma).slice(0, 1000)}

### Investimento
${secaoTexto(proposta.investimento).slice(0, 1200)}

### Próximos passos
${secaoTexto(proposta.proximosPassos).slice(0, 800)}

### Termos & condições
${secaoTexto(proposta.termos).slice(0, 1200)}

## Blocos extras (recursos comerciais)
- Pacotes: ${extras.pacotes?.visivel && extras.pacotes.pacotes.length > 0 ? `SIM (${extras.pacotes.pacotes.length} pacotes — ${extras.pacotes.pacotes.map((p) => `${p.nome}: ${p.valor}`).join(", ")})` : "NÃO USA"}
- Cases de sucesso: ${extras.cases?.visivel && extras.cases.cases.length > 0 ? `SIM (${extras.cases.cases.length} cases)` : "NÃO USA"}
- KPIs/metas: ${extras.kpis?.visivel && extras.kpis.kpis.length > 0 ? `SIM (${extras.kpis.kpis.length} KPIs)` : "NÃO USA"}
- Equipe: ${extras.equipe?.visivel && extras.equipe.membros.length > 0 ? `SIM (${extras.equipe.membros.length} membros)` : "NÃO USA"}
- Garantias: ${extras.garantias?.visivel && extras.garantias.garantias.length > 0 ? `SIM (${extras.garantias.garantias.length})` : "NÃO USA"}
- Timeline visual: ${extras.timeline?.visivel && extras.timeline.marcos.length > 0 ? `SIM (${extras.timeline.marcos.length} marcos)` : "NÃO USA"}
- FAQ: ${extras.faq?.visivel && extras.faq.perguntas.length > 0 ? `SIM (${extras.faq.perguntas.length} perguntas)` : "NÃO USA"}

---

Faça a análise crítica no formato JSON especificado.`;

    return {
      systemPrompt,
      userPrompt,
    };
  });
}
