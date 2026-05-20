/**
 * POST /api/leads/[id]/preparar-enrichment-ia
 *
 * Pede à IA pra qualificar lead: nota 0-100, ICP fit, segmento sugerido
 * (caso esteja vazio), abordagem sugerida pra outreach, justificativa.
 *
 * Usa Claude Max copy-paste — zero custo de API.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { extrairTextoDeBlocos } from "@/lib/proposta-helpers";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        propostas: {
          where: { versaoAtual: true },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            numero: true,
            titulo: true,
            status: true,
            valorMensal: true,
            enviadaEm: true,
            aceitaEm: true,
            recusadaEm: true,
          },
        },
      },
    });

    const formatBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
    const formatData = (d: Date | null) =>
      d ? d.toLocaleDateString("pt-BR") : "—";

    const systemPrompt = `Você é um SDR sênior (sales development) de uma agência brasileira de marketing digital (SAL Estratégias de Marketing). Sua tarefa é qualificar um lead que entrou no funil.

ICP da SAL (perfil ideal de cliente):
- Empresas brasileiras de médio porte (10-200 funcionários OU MRR R$ 50k-2M)
- Indústrias-foco: e-commerce, varejo físico+digital, serviços profissionais (advocacia, contabilidade, saúde), restaurantes premium, marcas de moda/decoração
- Empresas que JÁ investem em marketing (>R$ 3k/mês) ou estão prontas pra começar com seriedade
- Que valorizam estratégia + execução juntas (não só "freela barato pra fazer post")
- Decisor acessível (sócio/diretor) e disposto a investir em SEO/Tráfego pago

ANTI-ICP (lead que NÃO é ideal):
- Empresas muito pequenas (faturamento <R$ 20k/mês) — não suporta investimento mínimo
- Buscando só "Instagram bonito" sem foco em resultado
- Quer pagar comissão / variável only / barganha
- Setor sensível (jogos de azar, MMN, infoproduto barato, política)
- Concorrente de clientes atuais da SAL

Critérios de avaliação:
1. Empresa: porte + setor + maturidade digital — bate com ICP?
2. Necessidade: o lead deixou pista do que precisa? Mais explícita = mais qualificado
3. Orçamento: valor estimado vs ticket mínimo (R$ 2.5k/mês)
4. Decisor: contato é decisor ou intermediário?
5. Tempo: o lead tá pronto pra avançar ou só pesquisando?
6. Origem: como veio? Origens quentes (indicação, busca direta) > frias (lista, prospecção massa)

Responda APENAS com JSON válido no formato:
{
  "qualidade": 0-100 (numero inteiro),
  "categoria": "QUENTE" | "MORNO" | "FRIO" | "DESQUALIFICADO",
  "icpFit": "1 frase (max 250 chars) avaliando fit com ICP. Cite o aspecto mais relevante.",
  "segmentoSugerido": "1-3 palavras sugerindo segmento (use sempre, mesmo se já tiver — pode confirmar ou refinar). Ex: 'E-commerce moda', 'Restaurante premium', 'SaaS B2B'.",
  "abordagemSugerida": "Como o Marcelo deve abordar este lead. 2-4 frases. Inclua: canal sugerido (call/whatsapp/email), tom (formal/consultivo), gancho de valor (o que destacar). Max 600 chars.",
  "perguntasQualificacao": ["3-5 perguntas curtas pra confirmar fit antes de mandar proposta. Max 100 chars cada."],
  "justificativa": "2-4 frases explicando o score. Cite os pontos fortes E os pontos fracos. Max 500 chars."
}

Sem texto fora do JSON. Sem markdown wrapping.`;

    const userPrompt = `# Lead pra qualificar

## Empresa
- Nome: ${lead.empresa}
- Segmento atual: ${lead.segmento ?? "(não informado)"}
- Porte: ${lead.porte ?? "(não informado)"}
- Origem: ${lead.origem ?? "(não informado)"}

## Contato
- Nome: ${lead.contatoNome ?? "(não informado)"}
- Email: ${lead.contatoEmail ?? "(não informado)"}
- Telefone: ${lead.contatoTelefone ?? "(não informado)"}

## Comercial
- Status atual no pipeline: ${lead.status}
- Prioridade atual: ${lead.prioridade}
- Valor estimado mensal: ${lead.valorEstimadoMensal ? formatBRL(Number(lead.valorEstimadoMensal)) : "(não estimado)"}
- Duração estimada: ${lead.duracaoEstimadaMeses ? `${lead.duracaoEstimadaMeses} meses` : "(não estimada)"}
- Score atual no Hub: ${lead.score}/100 (calculado por regras, pode estar desatualizado)
- Tags livres: ${lead.tags.length > 0 ? lead.tags.join(", ") : "(nenhuma)"}

## Próxima ação programada
- Ação: ${lead.proximaAcao ?? "(nenhuma)"}
- Quando: ${formatData(lead.proximaAcaoEm)}

## Notas internas (escritas pelo Marcelo ou equipe)
${lead.notas ? extrairTextoDeBlocos(lead.notas).slice(0, 3000) : "(sem notas)"}

## Histórico — Propostas já enviadas pra este lead
${
  lead.propostas.length === 0
    ? "(nenhuma proposta enviada ainda)"
    : lead.propostas
        .map((p) => {
          const status = p.aceitaEm
            ? `ACEITA em ${formatData(p.aceitaEm)}`
            : p.recusadaEm
              ? `RECUSADA em ${formatData(p.recusadaEm)}`
              : p.enviadaEm
                ? `enviada em ${formatData(p.enviadaEm)}`
                : "rascunho";
          return `- ${p.numero} "${p.titulo}" · ${p.valorMensal ? formatBRL(Number(p.valorMensal)) + "/mês" : "sem valor"} · ${status}`;
        })
        .join("\n")
}

## Tempo no funil
- Cadastrado em: ${formatData(lead.createdAt)}
- Última atualização: ${formatData(lead.updatedAt)}
- Já convertido? ${lead.convertidoEm ? `Sim — em ${formatData(lead.convertidoEm)}` : "Não"}
${lead.motivoPerdido ? `- Motivo perdido (se aplicável): ${lead.motivoPerdido.slice(0, 500)}` : ""}

---

Faça a qualificação no formato JSON especificado.`;

    return {
      systemPrompt,
      userPrompt,
    };
  });
}
