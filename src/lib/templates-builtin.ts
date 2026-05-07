/**
 * Definição dos templates built-in do SAL Hub.
 *
 * `seedTemplates(prisma)` é idempotente: identifica built-ins por
 * `criadoPor: null` + `nome`. Em cada run, faz upsert via
 * `findFirst + create/update` pra não duplicar.
 *
 * Reusado em 3 lugares:
 *   1. `prisma/seed.ts` (seed principal, dev local)
 *   2. `prisma/seed-templates.ts` (CLI standalone — `npm run seed:templates`)
 *   3. `/api/admin/seed-templates` (endpoint pra rodar em prod)
 */
import type { PrismaClient, TemplateTipo } from "@prisma/client";

type BuiltIn = {
  nome: string;
  descricao: string;
  tipo: TemplateTipo;
  categoria: string;
  icone: string;
  cor: string;
  /** Array de PartialBlock do BlockNote — será serializado pra JSON. */
  blocos: unknown[];
};

// ─── Helpers de bloco ─────────────────────────────────────────────
const h1 = (text: string) => ({ type: "heading", props: { level: 1 }, content: text });
const h2 = (text: string) => ({ type: "heading", props: { level: 2 }, content: text });
const h3 = (text: string) => ({ type: "heading", props: { level: 3 }, content: text });
const p = (text: string) => ({ type: "paragraph", content: text });
const empty = () => ({ type: "paragraph", content: "" });
const bullet = (text: string) => ({ type: "bulletListItem", content: text });
const check = (text: string, checked = false) => ({
  type: "checkListItem",
  props: { checked },
  content: text,
});
const quote = (text: string) => ({ type: "paragraph", content: `> ${text}` });
const divider = () => ({ type: "paragraph", content: "———" });

// ─── Templates ────────────────────────────────────────────────────

const BRIEFING_NOVO_CLIENTE: BuiltIn = {
  nome: "Briefing — {{cliente.nome}}",
  descricao: "Briefing completo de onboarding para novo cliente. Cobre negócio, persona, concorrência, histórico, objetivos, canais e operação.",
  tipo: "BRIEFING",
  categoria: "Onboarding",
  icone: "📋",
  cor: "#7E30E1",
  blocos: [
    h1("Briefing — {{cliente.nome}}"),
    p("Data: {{data_extenso}} · Responsável: {{user.nome}}"),
    empty(),

    h2("1. Sobre o cliente"),
    h3("Negócio"),
    p("Descrição em 2-3 frases sobre o que a empresa faz, modelo de negócio (B2B/B2C/B2B2C), produtos/serviços principais."),
    empty(),
    h3("Mercado e tamanho"),
    bullet("Setor: "),
    bullet("Mercado-alvo (geografia, segmento): "),
    bullet("Tamanho da empresa (faturamento, funcionários, lojas): "),
    bullet("Tempo de atuação: "),
    empty(),
    h3("Histórico e contexto"),
    p("Quando começaram, marcos importantes, mudanças recentes (rebranding, expansão, novo CEO, fusão)."),
    empty(),

    h2("2. Stakeholders e operação"),
    h3("Decisores"),
    bullet("Decisor principal (quem aprova orçamento): "),
    bullet("Ponto focal do dia a dia: "),
    bullet("Outros envolvidos (jurídico, comercial, atendimento): "),
    empty(),
    h3("Acessos e ferramentas"),
    check("Acesso ao Google Analytics / GA4"),
    check("Acesso ao Meta Business / Ads Manager"),
    check("Acesso ao Google Ads"),
    check("Acesso ao site (CMS/admin)"),
    check("Acesso ao Search Console"),
    check("Acesso aos perfis sociais (Instagram, TikTok, LinkedIn, etc)"),
    check("Logos, manual de marca, fontes"),
    check("Banco de imagens / fotos de produto"),
    empty(),

    h2("3. Objetivos"),
    h3("Curto prazo (próximos 90 dias)"),
    bullet("Objetivo 1: "),
    bullet("Métrica de sucesso: "),
    empty(),
    h3("Médio prazo (3-6 meses)"),
    bullet("Objetivo 1: "),
    bullet("Métrica de sucesso: "),
    empty(),
    h3("Longo prazo (6-12 meses)"),
    bullet("Objetivo 1: "),
    bullet("Métrica de sucesso: "),
    empty(),

    h2("4. Persona / ICP"),
    h3("Persona principal"),
    bullet("Perfil demográfico (idade, gênero, renda, localização): "),
    bullet("Cargo / ocupação: "),
    bullet("Onde está online (canais que consome): "),
    bullet("Dores e desafios principais: "),
    bullet("Objeções típicas pra comprar: "),
    bullet("O que motiva a decisão de compra: "),
    empty(),
    h3("Persona secundária (opcional)"),
    p("Repetir estrutura acima se houver segundo público relevante."),
    empty(),

    h2("5. Marca e tom de voz"),
    h3("Posicionamento"),
    p("Como a marca quer ser percebida em 1 frase. Ex: \"Especialista premium em consultoria fiscal pra pequenas empresas\"."),
    empty(),
    h3("Personalidade"),
    bullet("Adjetivos que descrevem a marca (escolher 3-5): técnica, próxima, divertida, séria, jovem, sofisticada..."),
    bullet("Como NÃO queremos soar: "),
    empty(),
    h3("Tom de voz por canal"),
    bullet("Instagram: "),
    bullet("LinkedIn: "),
    bullet("Email: "),
    bullet("Site: "),
    empty(),
    h3("Mandatórios e proibidos"),
    bullet("Sempre dizer: "),
    bullet("Nunca dizer / palavras vetadas: "),
    bullet("Hashtags oficiais: "),
    empty(),

    h2("6. Concorrência"),
    h3("Direta (3-5 marcas)"),
    bullet("Concorrente 1 — diferencial deles, ponto fraco: "),
    bullet("Concorrente 2 — diferencial deles, ponto fraco: "),
    bullet("Concorrente 3 — diferencial deles, ponto fraco: "),
    empty(),
    h3("Indireta / aspiracional"),
    bullet("Marca que serve de referência (mesmo de outro setor): "),
    empty(),
    h3("Diferenciais do cliente"),
    p("O que SOMENTE este cliente entrega. Trabalhar isso virá comunicação."),
    empty(),

    h2("7. Histórico de marketing"),
    h3("O que já tentaram"),
    bullet("Ações passadas: "),
    bullet("Investimento mensal anterior: "),
    bullet("Agência anterior (se houver) e por que saíram: "),
    empty(),
    h3("O que funcionou"),
    p("Canais, criativos, ofertas que deram resultado."),
    empty(),
    h3("O que não funcionou"),
    p("Aprendizados pra não repetir."),
    empty(),

    h2("8. Estratégia inicial proposta"),
    h3("Canais prioritários"),
    bullet("Canal 1 (ex: Meta Ads — performance): "),
    bullet("Canal 2 (ex: Conteúdo orgânico Instagram): "),
    bullet("Canal 3 (ex: SEO blog): "),
    empty(),
    h3("Frequência de publicação"),
    bullet("Instagram: X posts/semana, Y stories/dia"),
    bullet("LinkedIn: "),
    bullet("Blog/SEO: X artigos/mês"),
    bullet("Email: X disparos/mês"),
    empty(),
    h3("Mídia paga"),
    bullet("Investimento mensal previsto: R$ "),
    bullet("Distribuição entre plataformas: "),
    bullet("CPA-alvo / ROAS-alvo: "),
    empty(),

    h2("9. Comercial e financeiro"),
    bullet("Ticket médio do cliente final: R$ "),
    bullet("Margem aproximada (se conseguirmos): "),
    bullet("LTV estimado: "),
    bullet("Valor do contrato com a SAL: R$ "),
    bullet("Periodicidade do pagamento: "),
    bullet("Vencimento contratual: "),
    empty(),

    h2("10. Operação SAL × Cliente"),
    h3("Cadência de reuniões"),
    bullet("Reunião semanal: dia X às Y"),
    bullet("Mensal de resultados: primeira terça do mês"),
    bullet("Trimestral estratégica: "),
    empty(),
    h3("Aprovações"),
    bullet("Como o cliente aprova posts/criativos: "),
    bullet("Prazo de aprovação combinado: "),
    bullet("Responsável final pela aprovação: "),
    empty(),
    h3("Comunicação"),
    bullet("Canal principal (WhatsApp, email, Slack): "),
    bullet("SLA de resposta: "),
    bullet("Reuniões fora da cadência: "),
    empty(),

    h2("11. Riscos e atenções"),
    p("Pontos sensíveis que toda a equipe SAL precisa saber: assuntos que o cliente não fala, crises recentes, processos jurídicos, sócios em conflito, sazonalidade crítica, lançamento de produto agendado, etc."),
    empty(),
    bullet("⚠️ "),
    bullet("⚠️ "),
    empty(),

    h2("12. Próximos passos imediatos (primeiras 2 semanas)"),
    check("Setup de acessos completos"),
    check("Sessão de imersão com o cliente (2-3h)"),
    check("Auditoria do que existe (site, redes, ads, GA)"),
    check("Plano dos primeiros 30 dias"),
    check("Apresentação do plano + alinhamento final"),
    check("Kickoff oficial"),
    empty(),

    h2("13. Anexos / referências"),
    bullet("Link da pasta no Drive: "),
    bullet("Link do contrato assinado: "),
    bullet("Link do plano de mídia: "),
    bullet("Outros: "),
  ],
};

const ATA_DE_REUNIAO: BuiltIn = {
  nome: "Ata — Reunião com {{cliente.nome}} ({{data}})",
  descricao: "Estrutura padrão de ata para reuniões com cliente: pauta, discussão, decisões e action items.",
  tipo: "REUNIAO",
  categoria: "Operacional",
  icone: "🎙️",
  cor: "#10B981",
  blocos: [
    h1("Reunião com {{cliente.nome}}"),
    p("Data: {{data_extenso}} · Hora: {{hora}} · Conduzida por: {{user.nome}}"),
    empty(),

    h2("Presentes"),
    bullet("Pelo cliente: "),
    bullet("Pela SAL: "),
    empty(),

    h2("Pauta"),
    bullet("Tópico 1: "),
    bullet("Tópico 2: "),
    bullet("Tópico 3: "),
    empty(),

    h2("Discussão"),
    h3("Tópico 1"),
    p("Resumo do que foi discutido, perspectivas trazidas, pontos de divergência."),
    empty(),
    h3("Tópico 2"),
    p(""),
    empty(),
    h3("Tópico 3"),
    p(""),
    empty(),

    h2("Decisões"),
    bullet("Decisão 1: "),
    bullet("Decisão 2: "),
    empty(),

    h2("Action items"),
    check("[ ] [Responsável] — Tarefa — Prazo: DD/MM"),
    check("[ ] "),
    check("[ ] "),
    empty(),

    h2("Próxima reunião"),
    bullet("Data sugerida: "),
    bullet("Pauta inicial: "),
    empty(),

    h2("Observações"),
    p("Anotações livres, contexto, sentimento da conversa."),
  ],
};

const RELATORIO_MENSAL: BuiltIn = {
  nome: "Relatório mensal — {{cliente.nome}} — {{mes_extenso}}/{{ano_atual}}",
  descricao: "Relatório padrão de fechamento mensal: KPIs por canal, insights, aprendizados e plano do próximo mês.",
  tipo: "NOTA",
  categoria: "Resultados",
  icone: "📊",
  cor: "#3B82F6",
  blocos: [
    h1("Relatório mensal — {{cliente.nome}}"),
    p("Período: {{mes_extenso}} de {{ano_atual}} · Apresentado por: {{user.nome}} · Data: {{data}}"),
    empty(),

    h2("Resumo executivo"),
    p("3-5 frases sobre o que aconteceu no mês: principais conquistas, números mais relevantes, sentimento geral."),
    empty(),

    h2("KPIs do mês"),
    h3("Tráfego pago"),
    bullet("Investimento total: R$ "),
    bullet("Impressões: "),
    bullet("Cliques: "),
    bullet("CTR: %"),
    bullet("Conversões: "),
    bullet("CPA: R$ "),
    bullet("ROAS: "),
    bullet("vs mês anterior: ↑/↓ X%"),
    empty(),
    h3("Redes sociais — orgânico"),
    bullet("Seguidores início do mês → fim: "),
    bullet("Crescimento líquido: "),
    bullet("Alcance médio por post: "),
    bullet("Engajamento (curtidas, comentários, salvamentos): "),
    bullet("Taxa de engajamento: %"),
    empty(),
    h3("SEO / blog"),
    bullet("Sessões orgânicas: "),
    bullet("Cliques no Search Console: "),
    bullet("Posições médias do top 10: "),
    bullet("Backlinks ganhos: "),
    empty(),
    h3("Email / CRM (se aplicável)"),
    bullet("Disparos: "),
    bullet("Taxa de abertura: %"),
    bullet("Taxa de clique: %"),
    bullet("Conversões geradas: "),
    empty(),

    h2("Top destaques do mês"),
    bullet("Ação que rendeu mais (criativo, post, anúncio): "),
    bullet("Aprendizado importante: "),
    bullet("Surpresa positiva: "),
    empty(),

    h2("O que não funcionou"),
    bullet("Hipótese testada que falhou: "),
    bullet("Ajuste necessário: "),
    empty(),

    h2("Plano para {{mes_extenso}} + 1"),
    h3("Prioridades"),
    bullet("Prioridade 1: "),
    bullet("Prioridade 2: "),
    bullet("Prioridade 3: "),
    empty(),
    h3("Ações concretas"),
    check("[ ] Ação 1 — Responsável — Prazo"),
    check("[ ] Ação 2"),
    check("[ ] Ação 3"),
    empty(),
    h3("Investimento sugerido"),
    bullet("Mídia paga: R$ "),
    bullet("Produção: R$ "),
    bullet("Total: R$ "),
    empty(),

    h2("Pedidos / pendências do cliente"),
    p("O que precisamos do cliente pra entregar o próximo mês (acessos, briefings, materiais, aprovações)."),
  ],
};

const PAUTA_SEMANAL: BuiltIn = {
  nome: "Pauta semanal — Semana de {{data}}",
  descricao: "Pauta de reunião interna semanal SAL: o que entregamos, o que vamos entregar, bloqueios e riscos.",
  tipo: "REUNIAO",
  categoria: "Operacional",
  icone: "🗓️",
  cor: "#F59E0B",
  blocos: [
    h1("Pauta semanal — SAL"),
    p("Semana iniciando: {{data_extenso}} · Conduzida por: {{user.nome}}"),
    empty(),

    h2("1. Entregues semana passada"),
    p("Por cliente / projeto:"),
    bullet("Cliente A — entregamos: "),
    bullet("Cliente B — entregamos: "),
    bullet("Cliente C — entregamos: "),
    empty(),

    h2("2. Em andamento"),
    bullet("Cliente A — status: "),
    bullet("Cliente B — status: "),
    bullet("Cliente C — status: "),
    empty(),

    h2("3. Esta semana — entregas planejadas"),
    check("[ ] Cliente A — entrega — Prazo"),
    check("[ ] Cliente B — entrega — Prazo"),
    check("[ ] Cliente C — entrega — Prazo"),
    empty(),

    h2("4. Bloqueios e dependências"),
    bullet("Bloqueio 1 (ex: aguardando aprovação do cliente X): "),
    bullet("Bloqueio 2: "),
    empty(),

    h2("5. Riscos / atenções"),
    bullet("Risco 1 (ex: contrato vence dia X, cliente reduzindo investimento): "),
    bullet("Risco 2: "),
    empty(),

    h2("6. Pedidos de ajuda"),
    p("Quem precisa de apoio em quê esta semana."),
    empty(),

    h2("7. Métricas da semana"),
    bullet("Posts publicados: "),
    bullet("Anúncios em rotação: "),
    bullet("Reuniões com clientes: "),
    bullet("Novas oportunidades / leads chegando: "),
    empty(),

    h2("8. Comunicados internos"),
    p("Mudanças de processo, novos clientes, férias, eventos, treinamentos."),
  ],
};

const ESTRATEGIA_CONTEUDO: BuiltIn = {
  nome: "Estratégia de conteúdo — {{cliente.nome}}",
  descricao: "Plano estratégico de conteúdo: objetivos, persona, pilares, calendário macro e KPIs de sucesso.",
  tipo: "NOTA",
  categoria: "Estratégia",
  icone: "🎯",
  cor: "#EC4899",
  blocos: [
    h1("Estratégia de conteúdo — {{cliente.nome}}"),
    p("Período coberto: próximos 3 meses · Definida em {{data_extenso}} por {{user.nome}}"),
    empty(),

    h2("1. Objetivos"),
    h3("Objetivo de negócio"),
    p("O que a empresa precisa que o conteúdo entregue (ex: aumentar leads qualificados em 30%, reduzir CAC, expandir presença em mercado novo)."),
    empty(),
    h3("Objetivo de marca"),
    p("Como queremos que o público perceba a marca após esses 3 meses (ex: \"a referência mais técnica do setor\")."),
    empty(),
    h3("Objetivo de conteúdo (mensurável)"),
    bullet("Alcance mensal alvo: "),
    bullet("Engajamento alvo: "),
    bullet("Crescimento de seguidores: "),
    bullet("Conversões via conteúdo (lead, agendamento, venda): "),
    empty(),

    h2("2. Persona-alvo (para esse trimestre)"),
    p("Persona principal de comunicação. Pode ser diferente da persona comercial — definir qual estamos falando."),
    bullet("Quem é: "),
    bullet("O que ela já consome: "),
    bullet("Que problema do dia a dia ela tem: "),
    bullet("Que tipo de conteúdo a engaja: "),
    bullet("O que ela quer aprender: "),
    empty(),

    h2("3. Pilares de conteúdo"),
    p("3-5 grandes temas que vão estruturar tudo que publicamos."),
    empty(),
    h3("Pilar 1 — [Nome]"),
    bullet("Por que esse pilar: "),
    bullet("Tipo de post: "),
    bullet("Frequência: X% do calendário"),
    bullet("Exemplos de tema: "),
    empty(),
    h3("Pilar 2 — [Nome]"),
    bullet("Por que esse pilar: "),
    bullet("Tipo de post: "),
    bullet("Frequência: X%"),
    bullet("Exemplos de tema: "),
    empty(),
    h3("Pilar 3 — [Nome]"),
    bullet("Por que esse pilar: "),
    bullet("Tipo de post: "),
    bullet("Frequência: X%"),
    bullet("Exemplos de tema: "),
    empty(),

    h2("4. Tom e linguagem"),
    bullet("Voz da marca: "),
    bullet("Nível técnico: leigo / intermediário / técnico"),
    bullet("Uso de gírias / regionalismos: "),
    bullet("Pessoa gramatical: você / vocês / a gente"),
    bullet("Pode usar humor? Sim/não, em que dose"),
    empty(),

    h2("5. Calendário macro"),
    h3("Frequência por canal"),
    bullet("Instagram feed: X posts/semana"),
    bullet("Instagram stories: Y stories/dia"),
    bullet("Reels: Z/semana"),
    bullet("LinkedIn: W posts/semana"),
    bullet("TikTok: "),
    bullet("Blog: X artigos/mês"),
    bullet("Email: X disparos/mês"),
    empty(),
    h3("Datas-chave do trimestre"),
    bullet("Data 1 (ex: lançamento de produto, sazonalidade): "),
    bullet("Data 2: "),
    empty(),

    h2("6. Distribuição e amplificação"),
    bullet("Conteúdo orgânico → vai virar mídia paga? Quais peças?"),
    bullet("Repurposing — 1 conteúdo grande → como vira N peças"),
    bullet("Parcerias / co-marketing previstos: "),
    bullet("Influenciadores ou embaixadores: "),
    empty(),

    h2("7. KPIs de sucesso"),
    h3("Métricas primárias (vão pro relatório mensal)"),
    bullet("Métrica 1: "),
    bullet("Métrica 2: "),
    bullet("Métrica 3: "),
    empty(),
    h3("Métricas secundárias (acompanhar mas não reportar)"),
    bullet("Métrica 1: "),
    bullet("Métrica 2: "),
    empty(),

    h2("8. Riscos da estratégia"),
    bullet("Se X acontecer, plano B: "),
    bullet("O que sabemos que pode dar errado: "),
    empty(),

    h2("9. Aprovações e responsabilidades"),
    bullet("Quem aprova a estratégia (cliente): "),
    bullet("Quem executa (SAL): "),
    bullet("Quem mede e reporta: "),
  ],
};

const TEMPLATES: BuiltIn[] = [
  BRIEFING_NOVO_CLIENTE,
  ATA_DE_REUNIAO,
  RELATORIO_MENSAL,
  PAUTA_SEMANAL,
  ESTRATEGIA_CONTEUDO,
];

/**
 * Seeda os templates built-in. Idempotente.
 * Aceita uma instância de Prisma externa (pra não duplicar conexão quando
 * chamado via seed.ts principal).
 */
export async function seedTemplates(prisma: PrismaClient): Promise<void> {
  console.log("→ Seedando templates built-in...");

  for (const t of TEMPLATES) {
    const conteudo = JSON.stringify(t.blocos);

    // Idempotência: identifica built-in por (criadoPor=null, nome=X).
    const existing = await prisma.template.findFirst({
      where: { criadoPor: null, nome: t.nome },
    });

    if (existing) {
      await prisma.template.update({
        where: { id: existing.id },
        data: {
          descricao: t.descricao,
          tipo: t.tipo,
          categoria: t.categoria,
          icone: t.icone,
          cor: t.cor,
          conteudo,
          compartilhado: true,
        },
      });
      console.log(`  ↻ atualizado: ${t.nome}`);
    } else {
      await prisma.template.create({
        data: {
          nome: t.nome,
          descricao: t.descricao,
          tipo: t.tipo,
          categoria: t.categoria,
          icone: t.icone,
          cor: t.cor,
          conteudo,
          criadoPor: null,
          compartilhado: true,
        },
      });
      console.log(`  + criado: ${t.nome}`);
    }
  }

  console.log("✅ Templates built-in OK");
}
