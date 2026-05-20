/**
 * POST /api/clientes/[id]/preparar-briefing-ia
 *
 * Modo Claude Max: monta system + user prompts pra Marcelo colar no
 * Claude Desktop/Web. NÃO chama IA — zero custo de API.
 *
 * Coleta TUDO que importa pra contextualizar interação com o cliente:
 *  - identidade + status + tags + tempo de relacionamento
 *  - últimas 5 reuniões (com resumo IA quando existir)
 *  - últimas 10 tarefas (status + prazo)
 *  - propostas (status, valor)
 *  - contratos ativos
 *  - últimos 10 lançamentos financeiros (saúde de pagamento)
 *  - posts publicados últimos 60d (volume de entrega)
 *  - notas livres
 *
 * Retorna { systemPrompt, userPrompt } pro wizard montar e copiar.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { extrairTextoDeBlocos } from "@/lib/proposta-helpers";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const cliente = await prisma.cliente.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        tags: { select: { nome: true } },
        contratos: {
          orderBy: { dataInicio: "desc" },
          take: 5,
          select: {
            valor: true,
            dataInicio: true,
            dataFim: true,
            status: true,
            observacoes: true,
          },
        },
        propostas: {
          where: { versaoAtual: true },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            numero: true,
            titulo: true,
            status: true,
            valorMensal: true,
            valorTotal: true,
            enviadaEm: true,
            aceitaEm: true,
            recusadaEm: true,
            recusaMotivo: true,
          },
        },
      },
    });

    // Janelas de tempo
    const agora = new Date();
    const seSentaDiasAtras = new Date(agora.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Queries paralelas pros dados mais pesados
    const [reunioes, tarefas, lancamentos, posts] = await Promise.all([
      prisma.reuniao.findMany({
        where: { clienteId: params.id },
        orderBy: { data: "desc" },
        take: 5,
        select: {
          titulo: true,
          data: true,
          resumoIA: true,
          notasLivres: true,
          status: true,
        },
      }),
      prisma.tarefa.findMany({
        where: { clienteId: params.id },
        orderBy: [{ concluida: "asc" }, { dataEntrega: "asc" }],
        take: 15,
        select: {
          titulo: true,
          concluida: true,
          prioridade: true,
          dataEntrega: true,
        },
      }),
      prisma.lancamento.findMany({
        where: { clienteId: params.id },
        orderBy: { data: "desc" },
        take: 10,
        select: {
          tipo: true,
          valor: true,
          data: true,
          descricao: true,
          categoria: true,
        },
      }),
      prisma.post.findMany({
        where: {
          clienteId: params.id,
          dataPublicacao: { gte: seSentaDiasAtras },
        },
        orderBy: { dataPublicacao: "desc" },
        select: {
          titulo: true,
          formato: true,
          status: true,
          dataPublicacao: true,
        },
      }),
    ]);

    // Helpers
    const formatData = (d: Date | null) =>
      d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
    const formatBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

    const tempoComoClienteMeses = Math.floor(
      (agora.getTime() - cliente.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)
    );
    const mrrAtual = Number(cliente.valorContratoMensal);
    const tarefasAbertas = tarefas.filter((t) => !t.concluida);
    const tarefasAtrasadas = tarefasAbertas.filter(
      (t) => t.dataEntrega && t.dataEntrega < agora
    );

    // ─── Montagem do prompt ──────────────────────────────────────
    const systemPrompt = `Você é um Chief of Staff de uma agência de marketing brasileira (SAL Estratégias de Marketing). Sua tarefa é gerar um briefing executivo sobre um cliente específico pra que o fundador (Marcelo) possa se contextualizar em 30 segundos antes de qualquer interação (ligação, reunião, email, follow-up).

Tom: direto, executivo, sem floreio. Você é o assistente que separa sinal de ruído.

Use APENAS os dados fornecidos no userPrompt. Não invente fatos. Quando não houver dado pra opinar, deixe claro ("dados insuficientes pra avaliar X").

Estrutura do briefing — responda APENAS com JSON válido no formato:
{
  "resumo": "2 parágrafos (4-6 frases cada). Parágrafo 1: quem é o cliente, há quanto tempo, MRR, tipo de relação (saudável/em risco/oportunidade). Parágrafo 2: o que aconteceu nos últimos 60 dias — entregas, reuniões, propostas, qualquer evento relevante.",
  "pontosAtencao": [
    "3 strings curtas (max 100 chars cada). Cada uma = um sinal que merece atenção AGORA. Exemplos: 'Tarefa X vencida há 12 dias', 'Última reunião há 47 dias', 'Pagamento atrasado de R$ Y', 'Proposta de R$ Z parada há 20 dias sem retorno'. Se não houver nada urgente, retorne array vazio []."
  ],
  "proximasAcoes": [
    "5 strings curtas e ACIONÁVEIS (max 120 chars cada). Verbo no infinitivo, alvo claro, justificativa em 1 linha. Exemplos: 'Marcar call de check-in — última reunião foi há 6 semanas', 'Reenviar proposta 2026-002 — vista mas sem decisão há 3 semanas', 'Cobrar pagamento de novembro — em atraso há 8 dias'. Priorizar por urgência + impacto."
  ],
  "riscoChurn": "1 frase curta (max 150 chars) avaliando risco de perda do cliente nos próximos 90 dias. Categoria + justificativa rápida. Ex: 'BAIXO — relação ativa, contratos em dia, reuniões regulares' / 'MÉDIO — última interação há 45 dias e tarefas acumulando' / 'ALTO — pagamento atrasado + proposta recusada + 0 reuniões em 60 dias'."
}

Sem texto fora do JSON. Sem markdown wrapping. Sem comentários.`;

    const userPrompt = `# Briefing solicitado pra: ${cliente.nome}

## Identidade
- Nome: ${cliente.nome}
- Status: ${cliente.status}
- Tags: ${cliente.tags.map((t) => t.nome).join(", ") || "(nenhuma)"}
- CNPJ: ${cliente.cnpj ?? "—"}
- Email: ${cliente.email ?? "—"}
- Telefone: ${cliente.telefone ?? "—"}

## Relação comercial
- Cliente do Hub há: ${tempoComoClienteMeses} ${tempoComoClienteMeses === 1 ? "mês" : "meses"} (cadastrado em ${formatData(cliente.createdAt)})
- MRR atual (valor contrato mensal): ${formatBRL(mrrAtual)}
- Onboarding feito em: ${formatData(cliente.onboardingFeitoEm)}

## Contratos (${cliente.contratos.length})
${
  cliente.contratos.length === 0
    ? "(nenhum contrato registrado)"
    : cliente.contratos
        .map(
          (c) =>
            `- ${formatBRL(Number(c.valor))} · de ${formatData(c.dataInicio)} até ${formatData(c.dataFim)} · status ${c.status}${c.observacoes ? ` · obs: "${c.observacoes.slice(0, 120)}"` : ""}`
        )
        .join("\n")
}

## Propostas (${cliente.propostas.length} mais recentes)
${
  cliente.propostas.length === 0
    ? "(nenhuma proposta)"
    : cliente.propostas
        .map((p) => {
          const valor = p.valorMensal ? `${formatBRL(Number(p.valorMensal))}/mês` : p.valorTotal ? formatBRL(Number(p.valorTotal)) : "valor não informado";
          const data = p.aceitaEm
            ? `aceita em ${formatData(p.aceitaEm)}`
            : p.recusadaEm
              ? `recusada em ${formatData(p.recusadaEm)}${p.recusaMotivo ? ` ("${p.recusaMotivo.slice(0, 100)}")` : ""}`
              : p.enviadaEm
                ? `enviada em ${formatData(p.enviadaEm)}`
                : "rascunho";
          return `- ${p.numero} — "${p.titulo}" · ${valor} · ${p.status} · ${data}`;
        })
        .join("\n")
}

## Reuniões recentes (${reunioes.length} últimas)
${
  reunioes.length === 0
    ? "(nenhuma reunião registrada)"
    : reunioes
        .map((r) => {
          const resumo = r.resumoIA?.trim() || r.notasLivres?.trim() || "(sem anotações)";
          return `### ${r.titulo} — ${formatData(r.data)} (${r.status})\n${resumo.slice(0, 600)}`;
        })
        .join("\n\n")
}

## Tarefas (${tarefasAbertas.length} abertas, ${tarefasAtrasadas.length} atrasadas)
${
  tarefasAbertas.length === 0
    ? "(nenhuma tarefa aberta)"
    : tarefasAbertas
        .slice(0, 10)
        .map((t) => {
          const prazo = t.dataEntrega
            ? t.dataEntrega < agora
              ? `ATRASADA (vencimento ${formatData(t.dataEntrega)})`
              : `prazo ${formatData(t.dataEntrega)}`
            : "sem prazo";
          return `- [${t.concluida ? "OK" : "ABERTA"}] ${t.prioridade} · ${t.titulo} · ${prazo}`;
        })
        .join("\n")
}

## Financeiro — últimos 10 lançamentos
${
  lancamentos.length === 0
    ? "(nenhum lançamento)"
    : lancamentos
        .map(
          (l) =>
            `- ${formatData(l.data)} · ${l.tipo} ${formatBRL(Number(l.valor))} · ${l.categoria ?? "—"} · ${l.descricao ?? ""}`
        )
        .join("\n")
}

## Entrega de conteúdo — últimos 60 dias
- Total de posts: ${posts.length}
- Publicados: ${posts.filter((p) => p.status === "PUBLICADO").length}
- Agendados: ${posts.filter((p) => p.status === "AGENDADO").length}
- Design pronto: ${posts.filter((p) => p.status === "DESIGN_PRONTO").length}
- Copy pronta: ${posts.filter((p) => p.status === "COPY_PRONTA").length}
- Rascunhos: ${posts.filter((p) => p.status === "RASCUNHO").length}

## Notas internas (livre, escritas pelo Marcelo)
${
  cliente.notas
    ? extrairTextoDeBlocos(cliente.notas).slice(0, 3000)
    : "(sem notas)"
}

---

Gere o briefing executivo no formato JSON especificado.`;

    return {
      systemPrompt,
      userPrompt,
    };
  });
}
