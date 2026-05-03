import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ─── Usuário admin ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("sal@2024", 10);
  await prisma.user.upsert({
    where: { email: "admin@sal.com.br" },
    update: { passwordHash },
    create: {
      email: "admin@sal.com.br",
      name: "Admin SAL",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log("✓ Usuário admin@sal.com.br criado/atualizado (senha: sal@2024)");

  // ─── Tags padrão ───────────────────────────────────────────────
  const tagsPadrao = [
    { nome: "Cliente Ativo", cor: "#10B981" },
    { nome: "Cliente Desativado", cor: "#EF4444" },
    { nome: "Em Onboarding", cor: "#3B82F6" },
    { nome: "Renovação Próxima", cor: "#F59E0B" },
    { nome: "VIP", cor: "#7E30E1" },
    { nome: "Prospect Quente", cor: "#EC4899" },
  ];
  for (const t of tagsPadrao) {
    await prisma.tag.upsert({
      where: { nome: t.nome },
      update: { cor: t.cor },
      create: t,
    });
  }
  console.log(`✓ ${tagsPadrao.length} tags padrão criadas`);

  const tagAtivo = await prisma.tag.findUnique({ where: { nome: "Cliente Ativo" } });

  // ─── Clientes SAL ──────────────────────────────────────────────
  const clientes = [
    { nome: "Galeria Chaves", valor: 2500 },
    { nome: "Lindóia Shopping", valor: 3800 },
    { nome: "Tavi Papelaria", valor: 1800 },
    { nome: "Pipeline Services", valor: 4200, notas: "Redução de contrato prevista para junho." },
    { nome: "Rua da Praia Shopping", valor: 2800 },
    { nome: "Conhecer para Transformar", valor: 1500 },
    { nome: "Canal do Vannucci", valor: 1200 },
  ];

  for (const c of clientes) {
    const id = `seed-${c.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    await prisma.cliente.upsert({
      where: { id },
      update: {
        tags: tagAtivo ? { connect: [{ id: tagAtivo.id }] } : undefined,
      },
      create: {
        id,
        nome: c.nome,
        status: "ATIVO",
        valorContratoMensal: c.valor,
        notas: c.notas,
        tags: tagAtivo ? { connect: [{ id: tagAtivo.id }] } : undefined,
      },
    });
  }
  console.log(`✓ ${clientes.length} clientes seedados (com tag "Cliente Ativo")`);

  // ─── Lançamentos financeiros de exemplo (3 meses anteriores) ─
  const seedClientes = await prisma.cliente.findMany({ where: { status: "ATIVO" } });
  for (let i = 1; i <= 3; i++) {
    const data = new Date(); data.setMonth(data.getMonth() - i); data.setDate(5);
    for (const c of seedClientes) {
      await prisma.lancamento.create({
        data: {
          descricao: `Mensalidade ${c.nome}`,
          valor: c.valorContratoMensal,
          tipo: "RECEITA",
          categoria: "Mensalidade",
          data,
          recorrente: true,
          entidade: "PJ",
          clienteId: c.id,
        },
      });
    }
  }
  console.log("✓ Lançamentos de receita PJ últimos 3 meses criados");

  // ─── Reunião exemplo (estilo Notion) ───────────────────────────
  const pipeline = await prisma.cliente.findUnique({ where: { id: "seed-pipeline-services" } });
  if (pipeline) {
    await prisma.reuniao.deleteMany({ where: { titulo: "Renovação contratual — Pipeline Services" } });
    const reuniao = await prisma.reuniao.create({
      data: {
        titulo: "Renovação contratual — Pipeline Services",
        data: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        duracaoSeg: 5052, // 1h24m
        status: "TRANSCRITA",
        clienteId: pipeline.id,
        participantes: ["Marcelo Salgado", "Ana Pipeline", "Roberto Pipeline"],
        tagsLivres: ["Contrato", "Renovação"],
        resumoIA:
          "Cliente Pipeline Services deseja renovar com escopo reduzido (~20% menor), migrando parte do orçamento de orgânico para tráfego pago Meta Ads. Marcelo apresentará 3 cenários de proposta até quinta-feira. ROAS atual médio de 4.8x; conversão de landing subiu para 3.4%.",
        blocks: {
          create: [
            { ordem: 1, timestamp: 12, speaker: "Marcelo Salgado", speakerCor: "#7E30E1", texto: "Bom dia, Ana e Roberto. Obrigado por separarem esse horário hoje. O foco da nossa conversa é alinhar a renovação do contrato que vence em 15 de maio." },
            { ordem: 2, timestamp: 34, speaker: "Ana Pipeline", speakerCor: "#F59E0B", texto: "Bom dia, Marcelo. Estamos com a expectativa de discutir alguns pontos sobre o escopo. O Roberto trouxe os números da retenção do trimestre." },
            { ordem: 3, timestamp: 62, speaker: "Roberto Pipeline", speakerCor: "#10B981", texto: "Pois é. Os resultados foram bons no geral, mas internamente decidimos reduzir o investimento em conteúdo orgânico para focar mais em performance pago." },
            { ordem: 4, timestamp: 108, speaker: "Marcelo Salgado", speakerCor: "#7E30E1", texto: "Entendi. Posso sugerir uma alternativa? Reduzimos o pacote atual em 20% e migramos parte do orçamento para Meta Ads. Teríamos um ganho médio de ROAS de 4.8x baseado no histórico." },
            { ordem: 5, timestamp: 155, speaker: "Ana Pipeline", speakerCor: "#F59E0B", texto: "Isso me parece interessante. Você consegue me mandar uma proposta formal até sexta com essa nova divisão?" },
            { ordem: 6, timestamp: 171, speaker: "Marcelo Salgado", speakerCor: "#7E30E1", texto: "Claro. Mando até quinta com três cenários: o atual, o reduzido com migração, e um híbrido que mantém o pacote orgânico mas inclui uma campanha de Black Friday separada." },
            { ordem: 7, timestamp: 210, speaker: "Roberto Pipeline", speakerCor: "#10B981", texto: "Perfeito. E sobre o KPI de conversão na landing page, tem novidade?" },
            { ordem: 8, timestamp: 225, speaker: "Marcelo Salgado", speakerCor: "#7E30E1", texto: "Subiu de 2.1% para 3.4% após o redesign. Ainda há espaço — minha recomendação é testar uma versão mais focada em prova social. Posso incluir esse teste A/B no escopo novo." },
          ],
        },
        actionItems: {
          create: [
            { ordem: 1, texto: "Enviar proposta com 3 cenários", responsavel: "Marcelo", prazo: "até quinta" },
            { ordem: 2, texto: "Confirmar redução de 20% no escopo", responsavel: "Ana", prazo: "após receber proposta" },
            { ordem: 3, texto: "Configurar teste A/B na landing", responsavel: "Marcelo", prazo: "semana 3" },
          ],
        },
        capitulos: {
          create: [
            { ordem: 1, timestamp: 0, titulo: "Abertura e contexto" },
            { ordem: 2, timestamp: 108, titulo: "Proposta de migração" },
            { ordem: 3, timestamp: 750, titulo: "Análise de KPIs" },
            { ordem: 4, timestamp: 1694, titulo: "Discussão de orçamento" },
            { ordem: 5, timestamp: 3128, titulo: "Próximos passos" },
            { ordem: 6, timestamp: 4722, titulo: "Encerramento" },
          ],
        },
      },
    });
    console.log(`✓ Reunião exemplo criada (id: ${reuniao.id})`);
  }

  // ─── Notas exemplo ─────────────────────────────────────────────
  const notasExistentes = await prisma.nota.count();
  if (notasExistentes === 0) {
    await prisma.nota.createMany({
      data: [
        {
          titulo: "Estratégia 2026",
          pasta: "Estratégia",
          tags: ["estratégia", "planejamento"],
          conteudo: `# Estratégia 2026

## Norte estratégico
A SAL precisa **deixar de ser uma agência de execução** para se posicionar como [[Parceira Estratégica]] dos clientes. O foco em 2026 é construir cases mensuráveis #cases.

## Pilares do ano
- **Performance auditável** — todo cliente recebe dashboard do [[Looker Studio]] mensal
- **Conteúdo de autoridade** — pelo menos 3 posts de pilar por mês em cada vertical
- **Retenção via valor** — meta de churn anual abaixo de 8%

## Iniciativas Q2
1. Lançamento do produto SAL Insights
2. Reformulação completa do site
3. Captação de 2 novos clientes [[ICP Ideal]]

> "Sem mensuração, é só achismo." — anotação do workshop interno

## Links relacionados
[[Workshop interno: novo posicionamento]] · [[Pipeline Services - estratégia]] · [[Roadmap produto]]`,
          favorita: true,
        },
        {
          titulo: "Pipeline Services - estratégia",
          pasta: "Clientes",
          tags: ["cliente", "renovação"],
          conteudo: `# Pipeline Services

## Contexto
Cliente desde junho/2025. Contrato atual: R$ 4.200/mês.
Vencimento: 15/05/2026.

## Pontos da última reunião
- Sinalizam redução de ~20% no escopo
- Querem migrar parte do orçamento para Meta Ads
- Subida da conversão de landing de 2.1% para 3.4%

## Próximos passos
- [ ] Enviar 3 cenários de proposta até quinta
- [ ] Configurar teste A/B na landing
- [x] Levantar histórico de ROAS por canal

#cliente #renovação`,
        },
        {
          titulo: "Ideias campanha Black Friday",
          pasta: "Inbox",
          tags: ["ideia", "bf"],
          conteudo: `# Brainstorm Black Friday 2026

## Conceitos iniciais
- "Sextou antes" — antecipação semanal de descontos
- Lookalike de compradores Q4 2025
- Reels com unboxing dos top SKUs

## Clientes elegíveis
Galeria Chaves, Lindóia Shopping, Tavi.

#bf #brainstorm`,
        },
        {
          titulo: "ICP Ideal",
          pasta: "Estratégia",
          tags: ["estratégia"],
          conteudo: `# Perfil de Cliente Ideal (ICP)

## Critérios
- Ticket médio mensal > R$ 2.500
- Marketing maduro, valoriza dados
- Time interno de 1+ pessoa em mkt

## Verticais alvo
1. Varejo de shopping
2. Educação privada
3. Serviços B2B locais`,
        },
      ],
    });
    console.log("✓ Notas exemplo criadas");
  }

  // ─── Mapa mental exemplo ───────────────────────────────────────
  const mapasExistentes = await prisma.mindMap.count();
  if (mapasExistentes === 0) {
    await prisma.mindMap.create({
      data: {
        titulo: "Estratégia 2026 — Reposicionamento",
        descricao: "Mapa do norte estratégico da SAL para o ano",
        data: {
          nodes: [
            { id: "n1", x: 480, y: 200, w: 160, h: 80, tipo: "rect", texto: "SAL Estratégia", subtexto: "2026", cor: "#7E30E1" },
            { id: "n2", x: 140, y: 100, w: 140, h: 60, tipo: "rect", texto: "Cases", subtexto: "mensuráveis", cor: "#10B981" },
            { id: "n3", x: 140, y: 200, w: 140, h: 60, tipo: "rect", texto: "Auditoria", subtexto: "de performance", cor: "#10B981" },
            { id: "n4", x: 140, y: 300, w: 140, h: 60, tipo: "rect", texto: "Conteúdo", subtexto: "de autoridade", cor: "#10B981" },
            { id: "n5", x: 820, y: 100, w: 140, h: 60, tipo: "rect", texto: "Retenção", subtexto: "> 92% anual", cor: "#F59E0B" },
            { id: "n6", x: 820, y: 200, w: 140, h: 60, tipo: "rect", texto: "Ticket médio", subtexto: "+R$ 1.500", cor: "#F59E0B" },
            { id: "n7", x: 820, y: 300, w: 140, h: 60, tipo: "rect", texto: "Novos clientes", subtexto: "2 ICP/trimestre", cor: "#F59E0B" },
            { id: "n8", x: 540, y: 50, w: 80, h: 80, tipo: "sticky", texto: "Norte: Parceira Estratégica", cor: "#FBBF24" },
          ],
          edges: [
            { id: "e1", from: "n2", to: "n1", estilo: "solid", cor: "#B794F4" },
            { id: "e2", from: "n3", to: "n1", estilo: "solid", cor: "#B794F4" },
            { id: "e3", from: "n4", to: "n1", estilo: "solid", cor: "#B794F4" },
            { id: "e4", from: "n1", to: "n5", estilo: "solid", cor: "#9696A8" },
            { id: "e5", from: "n1", to: "n6", estilo: "solid", cor: "#9696A8" },
            { id: "e6", from: "n1", to: "n7", estilo: "solid", cor: "#9696A8" },
          ],
        },
      },
    });
    console.log("✓ Mapa mental exemplo criado");
  }

  console.log("\n──────────────────────────────────────");
  console.log("✅ Seed completo");
  console.log("Login:    admin@sal.com.br");
  console.log("Senha:    sal@2024");
  console.log("──────────────────────────────────────");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
