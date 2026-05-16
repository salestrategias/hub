/**
 * Seed do Manual do Hub — documentação completa do sistema.
 *
 * Idempotente: roda só se categoria HUB está vazia. Cria árvore de
 * 9 categorias (parent, sem conteúdo) e ~30 seções filhas com conteúdo
 * Tiptap pronto.
 *
 * Tom: amigável mas direto. Audiência mista (Marcelo + equipe SAL +
 * clientes que usam o portal). Seções específicas do portal têm
 * marcador "PARA O CLIENTE" no início.
 *
 * Pra atualizar o manual depois do seed:
 *   1. Edite via UI em /manual/hub/{slug}
 *   2. Ou rode `npx prisma db execute` com SQL DELETE no tipo=HUB e
 *      deixe o lazy seed recriar (perde edições manuais!)
 */
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/manual-helpers";
import { doc, h1, h2, h3, p, ul, ol, quote, hr, b, c, i, link } from "@/lib/tiptap-doc-builder";

// ─── Tipos auxiliares ─────────────────────────────────────────────────

type SecaoHub = {
  titulo: string;
  icone: string;
  conteudo: string; // Tiptap JSON serializado
  paraCliente?: boolean; // marca seções escritas pro cliente final
};

type CategoriaHub = {
  titulo: string;
  icone: string;
  descricao: string;
  filhas: SecaoHub[];
};

// ─── Conteúdo: 9 categorias × ~30 seções ──────────────────────────────

const ESTRUTURA: CategoriaHub[] = [
  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 1. PRIMEIROS PASSOS                                              ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Primeiros passos",
    icone: "🚀",
    descricao: "O básico pra começar a usar o Hub no dia a dia.",
    filhas: [
      {
        titulo: "Visão geral do Hub",
        icone: "👋",
        conteudo: doc(
          h1("Bem-vindo ao SAL Hub"),
          p("O SAL Hub é o sistema central de operação da SAL Estratégias de Marketing. Ele reúne, num único lugar, tudo que a agência precisa pra atender clientes, planejar campanhas, produzir conteúdo, gerenciar projetos e financeiro."),
          h2("O que cabe aqui dentro"),
          ul(
            "CRM de clientes e pipeline de novos negócios (Leads)",
            "Calendário editorial unificado com aprovação direta pelo cliente",
            "Criativos de tráfego pago com workflow de aprovação",
            "Projetos em kanban + tarefas com checklist",
            "Reuniões com transcrição e action items",
            "Notas tipo Notion + Mapas Mentais visuais",
            "Propostas comerciais com aceite digital",
            "Contratos vinculados ao Drive",
            "Financeiro consolidado (PJ + PF)",
            "Relatórios mensais de redes/SEO/tráfego pago",
            "Portal do Cliente com aprovações em tempo real",
            "Integração com Claude (MCP) pra automatizar via chat"
          ),
          h2("Como o sistema é organizado"),
          p("A sidebar à esquerda agrupa tudo por área:"),
          ul(
            b("Visão Geral") + " — Dashboard e Calendário unificado",
            b("Clientes") + " — CRM",
            b("Produção") + " — Editorial, Criativos Ads, Projetos, Tarefas",
            b("Workspace") + " — Reuniões, Notas, Mapas mentais, Templates",
            b("Marketing SAL") + " — Conteúdo SAL, Manual SAL",
            b("Comercial") + " — Pipeline, Propostas, Contratos, Financeiro",
            b("Google") + " — Drive, Agenda",
            b("Relatórios") + " — Redes Sociais, SEO, Tráfego Pago",
            b("Administração") + " — Configurações, MCP, Backups"
          ),
          h2("Como esse manual funciona"),
          p("Cada módulo do Hub tem uma seção aqui. Procura na barra lateral à esquerda ou usa o botão de ajuda ", c("?"), " no header pra abrir o índice rápido em qualquer página.")
        ),
      },
      {
        titulo: "Atalhos globais",
        icone: "⌨️",
        conteudo: doc(
          h1("Atalhos de teclado"),
          p("O Hub tem alguns atalhos espalhados que economizam tempo significativo no uso diário."),
          h2("Globais (qualquer página)"),
          ul(
            c("Ctrl + K") + " ou " + c("Cmd + K") + " — abre a busca global (busca clientes, posts, projetos, notas, reuniões, leads)",
            c("C") + " — abre a Captura Rápida pra registrar uma ideia/decisão/anotação que cai no Inbox de Notas",
            c("?") + " ou " + c("F1") + " — abre o índice deste manual em qualquer página"
          ),
          h2("Editor de texto rico"),
          ul(
            c("/") + " — abre o menu de blocos (Heading, lista, citação, código, divisor, imagem, tabela)",
            c("@") + " — abre menção a cliente/post/projeto/reunião/etc",
            c("Ctrl + B") + " — negrito",
            c("Ctrl + I") + " — itálico",
            c("Ctrl + U") + " — sublinhado",
            "Texto selecionado mostra um toolbar flutuante com B / I / U / S / Code / Highlight / Link",
            "Hover num bloco mostra alça " + c("⋮⋮") + " à esquerda — arraste pra reordenar"
          ),
          h3("Atalhos Markdown ao digitar"),
          ul(
            c("# ") + " vira Heading 1, " + c("## ") + " vira H2, " + c("### ") + " vira H3",
            c("- ") + " ou " + c("* ") + " vira lista com bullets",
            c("1. ") + " vira lista numerada",
            c("> ") + " vira citação",
            c("```") + " vira bloco de código",
            c("---") + " vira divisor horizontal"
          ),
          h2("Mapas mentais"),
          ul(
            c("V") + " — Selecionar  ·  " + c("H") + " — Mover canvas",
            c("R") + " — Retângulo  ·  " + c("C") + " — Círculo",
            c("T") + " — Texto  ·  " + c("A") + " — Conectar  ·  " + c("S") + " — Sticky",
            c("Del") + " — exclui nó  ·  " + c("Ctrl + D") + " — duplica",
            "Duplo-click em um nó edita o texto inline",
            "Scroll do mouse = zoom  ·  " + c("Shift") + " + arrastar = move canvas",
            c("Alt") + " ao arrastar desliga o snap-to-grid"
          )
        ),
      },
      {
        titulo: "Tema, perfil e conta",
        icone: "👤",
        conteudo: doc(
          h1("Sua conta e preferências"),
          h2("Trocar entre tema claro e escuro"),
          p("No header (canto superior direito) tem um ícone de lua/sol — click alterna entre dark e light. O Hub respeita também a preferência do sistema na primeira visita."),
          h2("Editar perfil"),
          p("Click no seu avatar (canto superior direito) > Perfil. Lá você pode:"),
          ul(
            "Mudar foto, nome de exibição",
            "Mudar senha (precisa da senha antiga pra confirmar)",
            "Conectar conta Google (pra Drive + Agenda)",
            "Ver o histórico das suas atividades na conta"
          ),
          h2("Esconder valores sensíveis"),
          p("No header tem o ícone de " + c("olho") + " — clica e os valores monetários ficam mascarados (R$ ••••). Útil quando você compartilha a tela em reunião com cliente."),
          h2("Notificações"),
          p("O sininho no header mostra notificações: contratos vencendo, tarefas atrasadas, reuniões hoje, posts pra publicar, clientes aprovando/pedindo ajuste pelo portal, propostas vistas/aceitas. Click em uma notificação te leva direto pra entidade.")
        ),
      },
      {
        titulo: "Captura Rápida",
        icone: "⚡",
        conteudo: doc(
          h1("Captura Rápida (Inbox)"),
          p("Atalho ", c("C"), " em qualquer lugar do Hub abre o modal de Captura Rápida — pra você jogar uma ideia, decisão, anotação que veio na cabeça sem precisar abrir o módulo de Notas."),
          h2("Como funciona"),
          ol(
            "Aperta " + c("C") + " em qualquer página",
            "Modal abre — digite o conteúdo da nota",
            "Escolhe a categoria: Inbox (default), Ideias, Briefings, Estratégia ou Operacional",
            "Adiciona tags opcionais separadas por vírgula",
            "Aperta " + c("Ctrl + Enter") + " (ou clica Salvar) — fecha o modal e a nota cai no Inbox"
          ),
          p("Depois você triagem o Inbox em " + c("/notas") + " e move pra pasta certa."),
          h2("Quando usar"),
          ul(
            "Ideia surgiu numa reunião e não dá pra parar pra abrir o Hub",
            "Decisão estratégica de cliente — registra rápido pra não esquecer",
            "Lembrete de algo pra fazer depois (e a tarefa formal você cria com calma)",
            "Briefing parcial — captura agora, formaliza depois"
          )
        ),
      },
    ],
  },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 2. CLIENTES E COMERCIAL                                          ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Clientes e Comercial",
    icone: "💼",
    descricao: "Do lead frio ao contrato assinado.",
    filhas: [
      {
        titulo: "CRM (Clientes)",
        icone: "👥",
        conteudo: doc(
          h1("Gerenciar clientes"),
          p("O CRM em " + c("/clientes") + " é a tabela mestre da SAL — todo cliente passa por aqui."),
          h2("Cadastrar novo cliente"),
          ol(
            "Click em " + b("Novo cliente") + " no topo direito",
            "Preenche nome (obrigatório), CNPJ, contato, valor mensal",
            "Status: ATIVO / INATIVO / PROSPECT / CHURNED",
            "Tags opcionais (Cliente VIP, Em Onboarding, etc — gerencia em " + c("/clientes/tags") + ")",
            "Salva — o cliente já fica disponível em todos os outros módulos"
          ),
          h2("Onboarding automático"),
          p("Quando você marca um cliente como ATIVO pela primeira vez, o Hub:"),
          ul(
            "Cria automaticamente uma pasta no Google Drive (se você conectou conta Google)",
            "Cria um Projeto inicial de Onboarding com tarefas padrão",
            "Marca a data de onboarding pra não repetir"
          ),
          p("A configuração de onde criar a pasta tá em " + c("/admin/configuracoes") + " — pode ser no Meu Drive, num Shared Drive específico, ou dentro de uma pasta-mãe."),
          h2("Ficha do cliente"),
          p("Click no nome do cliente abre o sheet lateral com:"),
          ul(
            "Dados (nome, CNPJ, contato, endereço)",
            "Tags + Status",
            "Notas livres com editor rico (use " + c("@") + " pra mencionar posts/reuniões)",
            "Lista de projetos, contratos, posts, reuniões vinculados",
            "Card de " + b("Acesso do Cliente") + " — onde você configura o portal pra esse cliente",
            "Links pro Drive do cliente"
          )
        ),
      },
      {
        titulo: "Pipeline (Leads)",
        icone: "🎯",
        conteudo: doc(
          h1("Pipeline comercial"),
          p("Em " + c("/leads") + " — kanban de novos negócios. Cada coluna é um estágio:"),
          ol(
            b("NOVO") + " — Lead acabou de entrar, sem qualificação",
            b("QUALIFICAÇÃO") + " — Reunião marcada, descobrindo a necessidade",
            b("DIAGNÓSTICO") + " — Levantando dados pra montar proposta",
            b("PROPOSTA ENVIADA") + " — Proposta enviada, aguardando retorno",
            b("NEGOCIAÇÃO") + " — Ajustes finais, fechamento",
            b("GANHO") + " — Fechou! Converte em Cliente.",
            b("PERDIDO") + " — Não rolou (com motivo registrado pra aprender)"
          ),
          h2("Adicionar lead"),
          ul(
            "Manual via botão " + b("Novo lead"),
            "Importar em batch via CSV (Meta Lead Ads exporta CSV direto)"
          ),
          h2("Converter em cliente"),
          p("Quando um lead vai pra GANHO, abre o sheet > Converter:"),
          ul(
            b("Cliente novo") + " — Hub cria um Cliente novo usando os dados do lead",
            b("Cliente existente") + " — Vincula o lead a um cliente já cadastrado (caso seja um upsell)"
          ),
          h2("Lead score"),
          p("Cada lead tem um score automático (0-100) calculado a partir de: porte da empresa, valor estimado, segmento, completude dos dados. Você pode sobrescrever manualmente — útil quando você sente que um lead é hotter que o algoritmo acha.")
        ),
      },
      {
        titulo: "Propostas",
        icone: "📝",
        conteudo: doc(
          h1("Propostas comerciais"),
          p("Em " + c("/propostas") + " — propostas com aceite digital, geradas em PDF, com share link pro cliente sem precisar logar."),
          h2("Criar proposta"),
          ol(
            "Click em " + b("Nova proposta"),
            "Vincula a um Lead ou cliente novo (preenche nome/email no snapshot)",
            "Edita as 8 seções no editor rico: Capa, Diagnóstico, Objetivo, Escopo, Cronograma, Investimento, Próximos passos, Termos",
            "Customiza logo + cor primária se quiser branding",
            "Define valor mensal, total, duração",
            "Salva — fica como RASCUNHO até você enviar"
          ),
          h2("Enviar pro cliente"),
          p("Botão " + b("Enviar") + " gera um shareToken e o link público fica disponível em " + c("hub.salestrategias.com.br/p/proposta/{token}") + "."),
          ul(
            "Você pode definir validade (default 30 dias)",
            "Senha opcional pra proteger o link",
            "Cliente pode visualizar a proposta no browser ou baixar PDF",
            "Cliente pode " + b("Aceitar") + " ou " + b("Recusar") + " com motivo, direto no link"
          ),
          h2("Status"),
          ul(
            b("RASCUNHO") + " — Em edição",
            b("ENVIADA") + " — Link gerado mas cliente não viu ainda",
            b("VISTA") + " — Cliente abriu o link (você é notificado)",
            b("ACEITA") + " — Cliente aceitou (você é notificado, com IP/UA registrados)",
            b("RECUSADA") + " — Cliente recusou (motivo opcional registrado)",
            b("EXPIRADA") + " — Validade venceu sem resposta"
          ),
          h2("IA pra preencher seções"),
          p("Em cada seção tem um botão de IA — descreve o que você quer (ex: 'objetivo de aumentar conversões em 30%') e a IA gera o conteúdo inicial. Você refina manualmente.")
        ),
      },
      {
        titulo: "Contratos",
        icone: "📄",
        conteudo: doc(
          h1("Contratos"),
          p("Em " + c("/contratos") + " — registro de contratos vigentes, com vínculo ao arquivo no Drive e aviso automático de vencimento."),
          h2("Cadastrar contrato"),
          ol(
            "Click em " + b("Novo contrato"),
            "Vincula a um cliente",
            "Define valor, data início, data fim, multa rescisória, índice de reajuste",
            "Opcional: faz upload do PDF do contrato no Drive direto pelo Hub",
            "Salva"
          ),
          h2("Aviso de vencimento"),
          p("90 dias antes do " + b("dataFim") + ", o sistema cria automaticamente um evento na Agenda + uma notificação no Hub. Boa pra negociar renovação com folga."),
          h2("Status"),
          ul(
            b("ATIVO") + " — Em vigência",
            b("ENCERRADO") + " — Acabou (cliente saiu)",
            b("EM RENOVAÇÃO") + " — Em processo de renovar",
            b("CANCELADO") + " — Foi cancelado antes do fim"
          )
        ),
      },
      {
        titulo: "Financeiro",
        icone: "💰",
        conteudo: doc(
          h1("Financeiro consolidado"),
          p("Em " + c("/financeiro") + " — lançamentos de receita e despesa, separados por entidade (PJ = empresa SAL, PF = Marcelo pessoa física)."),
          h2("Lançar receita ou despesa"),
          ol(
            "Click em " + b("Novo lançamento"),
            "Descrição, valor, tipo (RECEITA/DESPESA), categoria",
            "Data do lançamento",
            "Entidade (PJ ou PF)",
            "Vincula a um cliente se for receita de cliente",
            "Marque " + b("Recorrente") + " se for mensal — o Hub repete automaticamente"
          ),
          h2("Métricas que aparecem"),
          ul(
            "MRR (receita mensal recorrente)",
            "LTV médio por cliente",
            "Receita do mês vs mês anterior",
            "Despesa por categoria",
            "Resultado líquido (PJ + PF)"
          ),
          p("Os números são fonte da verdade pro Dashboard executivo e pros relatórios mensais.")
        ),
      },
    ],
  },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 3. PRODUÇÃO                                                      ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Produção",
    icone: "🎨",
    descricao: "Calendário editorial, criativos pagos, projetos e tarefas.",
    filhas: [
      {
        titulo: "Calendário Editorial",
        icone: "📅",
        conteudo: doc(
          h1("Calendário Editorial"),
          p("Em " + c("/editorial") + " — calendário de posts orgânicos por cliente. Cliente vê e aprova pelo portal."),
          h2("Criar post"),
          ol(
            "Click em " + b("Novo post"),
            "Título, cliente, formato (FEED / STORIES / REELS / CARROSSEL)",
            "Data de publicação",
            "Status inicial: " + b("RASCUNHO"),
            "Salva — agora pode preencher as 4 abas do post"
          ),
          h2("As 4 abas do post"),
          ol(
            b("Copy / Legenda") + " — texto rico com editor Tiptap (negrito, listas, mentions, links)",
            b("Artes / Anexos") + " — sobe imagens, vídeos, PDFs ou cola URL externa (Drive/Figma/Canva). Drag-drop reordena.",
            b("Hashtags + CTA") + " — chips de hashtag (sem #, sistema adiciona) + chamada pra ação curta",
            b("Notas de produção") + " — interno, cliente NÃO vê (música de fundo, ref de design, instruções pro designer)"
          ),
          h2("Workflow de status"),
          ol(
            b("RASCUNHO") + " — Em construção, cliente não vê",
            b("COPY_PRONTA") + " — Texto OK, esperando aprovação do cliente",
            b("DESIGN_PRONTO") + " — Aprovado, arte sendo produzida (ou pronta)",
            b("AGENDADO") + " — Vai publicar na data — Hub cria evento na Agenda automaticamente",
            b("PUBLICADO") + " — Já tá no ar"
          ),
          h2("Aprovação pelo cliente"),
          p("Quando o post está em " + b("COPY_PRONTA") + " ou superior, ele aparece no portal do cliente. Cliente pode:"),
          ul(
            "Ver a copy, hashtags, CTA e o carrossel de artes",
            b("Aprovar") + " — gera notificação pra você + move pra DESIGN_PRONTO",
            b("Pedir ajuste") + " — cliente comenta o que mudar, você é notificado, post continua em COPY_PRONTA"
          ),
          p("Os comentários aparecem na aba " + b("Comentários do cliente") + " do post.")
        ),
      },
      {
        titulo: "Criativos Ads",
        icone: "📣",
        conteudo: doc(
          h1("Criativos de Anúncio"),
          p("Em " + c("/criativos") + " — kanban de criativos de tráfego pago (Meta/Google/TikTok/etc), com aprovação direta pelo cliente."),
          h2("Diferença pra Editorial"),
          ul(
            b("Editorial") + " = posts orgânicos, gratuito, calendário diário",
            b("Criativos Ads") + " = anúncios pagos, com público-alvo, orçamento, plataforma específica, CTA do botão"
          ),
          h2("Workflow"),
          ol(
            b("RASCUNHO") + " — Equipe ainda montando, cliente não vê",
            b("EM_APROVACAO") + " — Cliente vê no portal e aprova/pede ajuste",
            b("APROVADO") + " — Pronto pra subir na plataforma",
            b("RECUSADO") + " — Cliente recusou (revisar)",
            b("NO_AR") + " — Equipe subiu na plataforma, está rodando",
            b("PAUSADO") + " — Temporariamente parado",
            b("ENCERRADO") + " — Campanha acabou"
          ),
          h2("Campos do criativo"),
          ul(
            b("Texto principal") + " — corpo do anúncio (Meta: Primary Text)",
            b("Headline") + " — título curto",
            b("Descrição") + " — sub-título",
            b("CTA do botão") + " — texto livre (Saiba mais, Compre agora, etc)",
            b("URL de destino") + " — landing page",
            b("Público-alvo") + " — descrição livre da segmentação",
            b("Orçamento") + " (interno, cliente não vê)",
            b("Datas início/fim") + " — opcional",
            b("Notas internas") + " — pra equipe, cliente não vê"
          ),
          h2("Vincular a campanha existente"),
          p("Cada criativo pode ser vinculado a uma " + b("CampanhaPaga") + " (cadastrada em " + c("/relatorios/trafego-pago") + ") usando o botão " + b("Vincular campanha") + " — permite ver depois 'que criativos rodaram nessa campanha'.")
        ),
      },
      {
        titulo: "Projetos",
        icone: "📁",
        conteudo: doc(
          h1("Projetos"),
          p("Em " + c("/projetos") + " — kanban de entregas maiores. Cada projeto pode ter várias tarefas vinculadas."),
          h2("5 colunas do kanban"),
          ol(
            b("BRIEFING") + " — Coletando informações iniciais",
            b("PRODUÇÃO") + " — Equipe trabalhando",
            b("REVISÃO") + " — Em revisão interna",
            b("APROVAÇÃO") + " — Cliente revisando",
            b("ENTREGUE") + " — Finalizado"
          ),
          h2("Criar projeto"),
          ol(
            "Nome, descrição (editor rico)",
            "Prioridade (URGENTE/ALTA/NORMAL/BAIXA)",
            "Data de entrega",
            "Vincula a um cliente (opcional pra projetos internos da SAL)",
            "Marque " + b("Criar pasta no Drive") + " — sistema cria pasta dedicada e linka"
          ),
          h2("Drag entre colunas"),
          p("Arraste o card pra outra coluna — status muda na hora. Hub atualiza eventos na Agenda se a data de entrega mudar.")
        ),
      },
      {
        titulo: "Tarefas",
        icone: "✅",
        conteudo: doc(
          h1("Tarefas"),
          p("Em " + c("/tarefas") + " — lista plana de tarefas, com filtros por cliente, projeto, prioridade e status."),
          h2("Criar tarefa"),
          ol(
            "Título + descrição",
            "Prioridade + data de entrega",
            "Vincula a um cliente E/OU projeto",
            "Adiciona checklist interno (subtarefas) se a entrega tem múltiplos passos"
          ),
          h2("Conclusão"),
          p("Marque a tarefa como concluída no checkbox. Se ela tinha evento na Agenda, sistema remove. Tarefas concluídas filtram pra fora da view default (filtra explicitamente pra ver)."),
          h2("Atrasadas"),
          p("Tarefas com " + b("dataEntrega") + " no passado e não concluídas viram " + b("atrasadas") + ". Aparecem destacadas em vermelho no dashboard e geram notificação diária até serem resolvidas.")
        ),
      },
    ],
  },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 4. WORKSPACE                                                     ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Workspace",
    icone: "🧠",
    descricao: "Reuniões, notas, mapas mentais e templates.",
    filhas: [
      {
        titulo: "Reuniões",
        icone: "🎙️",
        conteudo: doc(
          h1("Reuniões"),
          p("Em " + c("/reunioes") + " — registro de reuniões com transcrição opcional, blocos por speaker, e action items que viram tarefas."),
          h2("Criar reunião"),
          ol(
            "Click " + b("Nova reunião"),
            "Título + data + duração",
            "Vincula a um cliente (opcional)",
            "Adiciona participantes (texto livre)",
            "Tags opcionais"
          ),
          h2("Conteúdo da reunião"),
          ul(
            b("Resumo IA") + " — texto rico com o resumo executivo",
            b("Notas livres") + " — anotações suas durante a reunião",
            b("Blocos de transcrição") + " — speakers + timestamp + texto (se gravou áudio)",
            b("Action items") + " — checklist de coisas pra fazer, com responsável e prazo"
          ),
          h2("Action items viram visíveis no portal"),
          p("Se você marcar essa reunião com um cliente que tem " + b("verReunioes") + " no portal, o cliente vê o resumo e as ações combinadas — útil pra alinhamento sem precisar enviar email depois.")
        ),
      },
      {
        titulo: "Notas",
        icone: "📝",
        conteudo: doc(
          h1("Notas"),
          p("Em " + c("/notas") + " — sistema de notas estilo Obsidian/Notion com pastas, tags e editor rico."),
          h2("Estrutura"),
          ul(
            "Sidebar esquerda: lista de pastas",
            "Coluna central: lista de notas da pasta",
            "Coluna direita: editor da nota selecionada (Tiptap completo)"
          ),
          h2("Mobile"),
          p("Em telas pequenas, alterna entre as 3 views: " + b("Pastas") + " → " + b("Lista") + " → " + b("Editor") + " com setas de voltar."),
          h2("Editor"),
          p("Editor Tiptap completo — headings, listas, checklist, citação, código, imagens (paste/drop), tabelas, links, menções " + c("@") + " a outras entidades. Mais detalhes na seção " + b("Editor rico") + " deste manual."),
          h2("Captura Rápida"),
          p("Atalho global " + c("C") + " abre modal pra criar nota direto na pasta Inbox — sem sair da página atual.")
        ),
      },
      {
        titulo: "Mapas Mentais",
        icone: "🗺️",
        conteudo: doc(
          h1("Mapas Mentais"),
          p("Em " + c("/mapas") + " — canvas visual estilo Excalidraw/Miro pra brainstorming, fluxos, FOFA, jornada do cliente, fishbone."),
          h2("Templates prontos"),
          p("Ao clicar " + b("Novo mapa") + ", escolha um dos 7 modelos:"),
          ul(
            "✨ Em branco",
            "💡 Brainstorm livre",
            "📊 FOFA / SWOT",
            "🛒 Jornada do Cliente",
            "🐟 Fishbone (Ishikawa)",
            "🎯 Funil de Marketing",
            "📚 Pilares de Conteúdo"
          ),
          h2("Ferramentas"),
          p("Toolbar à esquerda do canvas com 7 ferramentas (ver seção " + b("Atalhos globais") + ")."),
          h2("Operações"),
          ul(
            "Click no canvas com ferramenta de criação = cria nó nova posição (snapping em 20px)",
            "Drag no nó = move (segura " + c("Alt") + " pra desligar snap)",
            "Duplo-click no nó = edita texto inline",
            "Click + select com ferramenta " + b("Conectar") + " (A) = liga 2 nós",
            "Painel direito (quando há seleção) = cor, texto, subtexto, conectar, duplicar, excluir",
            "Scroll do mouse = zoom  ·  " + c("Shift") + " + drag = pan",
            "No mobile: pinch zoom com 2 dedos + drag pra mover"
          ),
          h2("Export"),
          ul(
            b("PNG") + " — 1920×1080, pra colar em deck ou apresentação",
            b("SVG") + " — vetor escalonável"
          ),
          p("Thumbnail real do canvas é gerada automaticamente em cada save e aparece na listagem.")
        ),
      },
      {
        titulo: "Templates",
        icone: "✨",
        conteudo: doc(
          h1("Templates reutilizáveis"),
          p("Em " + c("/templates") + " — esqueletos pré-prontos pra Notas, Reuniões, Briefings, Tarefas, Projetos."),
          h2("Templates built-in"),
          p("O Hub vem com vários templates de fábrica (ex: ata de reunião de kickoff, briefing de redes sociais, checklist de onboarding). São identificados como " + b("templates do sistema") + " e não podem ser editados."),
          h2("Criar seu próprio template"),
          ol(
            "Click em " + b("Novo template"),
            "Nome, descrição, ícone, cor",
            "Tipo: NOTA / REUNIAO / BRIEFING / TAREFA / PROJETO",
            "Categoria livre (Onboarding, Operacional, Estratégia, etc)",
            "Conteúdo: editor rico — use " + c("{{cliente}}") + " ou " + c("{{data}}") + " que vão ser expandidos quando o template for instanciado"
          ),
          h2("Instanciar template"),
          p("Quando vai criar uma Nota, Reunião, Briefing etc, tem um botão " + b("Usar template") + " — escolhe o template, opcionalmente vincula a um cliente (pra expandir variáveis), e o conteúdo aparece pré-preenchido pra você refinar.")
        ),
      },
      {
        titulo: "Editor rico (Tiptap)",
        icone: "✏️",
        conteudo: doc(
          h1("Editor rico"),
          p("Onde tem editor de texto no Hub (legenda do post, copy do conteúdo SAL, notas de cliente, observações, descrições de tarefa, propostas, manual, mapas, etc), é o mesmo editor: Tiptap (ProseMirror) configurado estilo Notion."),
          h2("Funcionalidades"),
          ul(
            "Headings H1 / H2 / H3 (ou via atalho " + c("# ") + ", " + c("## ") + ", " + c("### ") + ")",
            "Negrito, itálico, sublinhado, riscado, código inline, highlight amarelo",
            "Listas bullet / numerada / checklist (com checkbox clicável)",
            "Citação, código em bloco, linha horizontal",
            "Links clicáveis (paste URL ou Ctrl+K em texto selecionado)",
            "Imagens (paste do clipboard ou drag-drop de arquivo)",
            "Tabelas 3×3 redimensionáveis",
            "Typography (aspas curvas, em-dash, ellipsis automáticos)"
          ),
          h2("Slash menu (/)"),
          p("Digite " + c("/") + " em qualquer lugar pra abrir paleta de blocos: Texto, Heading 1/2/3, listas, citação, código, divisor, tabela, imagem por URL."),
          h2("Mentions (@)"),
          p("Digite " + c("@") + " e busca por: clientes, posts, projetos, tarefas, reuniões, contratos, notas. Insere uma pílula colorida no texto que linka pra entidade. O sistema registra essa relação como " + b("backlink") + " — depois você consegue ver 'o que menciona o cliente X' na ficha dele."),
          h2("Bubble menu (texto selecionado)"),
          p("Selecione qualquer texto — aparece um toolbar flutuante com 7 botões: B / I / U / S / Code / Highlight / Link."),
          h2("Drag handle (⋮⋮)"),
          p("Hover em qualquer bloco (parágrafo, heading, lista, citação, tabela) — aparece uma alça de 6 pontos à esquerda. Arraste pra reordenar o bloco inteiro."),
          h2("Salvamento"),
          p("Os campos com editor rico salvam automaticamente após 1s parado de digitar — você vê 'Edição salva automaticamente' no rodapé.")
        ),
      },
    ],
  },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 5. MARKETING SAL                                                 ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Marketing SAL",
    icone: "🌟",
    descricao: "Conteúdo da própria agência e brand book.",
    filhas: [
      {
        titulo: "Conteúdo SAL",
        icone: "📣",
        conteudo: doc(
          h1("Conteúdo SAL"),
          p("Em " + c("/conteudo-sal") + " — planejamento do conteúdo da própria agência (não confunda com o calendário editorial dos clientes em " + c("/editorial") + ")."),
          h2("Por que separado"),
          p("O marketing da SAL não polui o calendário dos clientes. Tem sua própria área, próprio workflow, próprios formatos."),
          h2("9 formatos"),
          ul(
            "Instagram Feed / Stories / Reels",
            "LinkedIn",
            "TikTok",
            "YouTube",
            "Newsletter",
            "Blog Post",
            "Ad Creative (anúncio da SAL pra captar clientes)"
          ),
          h2("Workflow"),
          p("Mesmo status do Editorial (RASCUNHO → COPY_PRONTA → DESIGN_PRONTO → AGENDADO → PUBLICADO). Tem campo de " + b("pilar") + " livre (Autoridade, Educacional, Bastidores, Conversão, etc) e " + b("briefing") + " pra contexto.")
        ),
      },
      {
        titulo: "Manual SAL (Playbook + Marca)",
        icone: "📚",
        conteudo: doc(
          h1("Manual SAL"),
          p("Em " + c("/manual") + " — wiki interno da SAL com 3 áreas:"),
          ul(
            b("Playbook") + " — Como a SAL opera (atendimento, onboarding, workflow editorial, tráfego pago, SEO, comercial)",
            b("Marca") + " — Brand book (logo, paleta, tipografia, tom de voz, manifesto, personas, pilares)",
            b("Hub") + " — Manual de uso deste sistema (você está lendo agora)"
          ),
          h2("Estrutura"),
          p("Cada área tem seções com hierarquia (1 nível: categoria → filhas). Sidebar mostra a árvore, click em uma seção abre o editor rico com o conteúdo."),
          h2("Editar"),
          p("Click em " + b("Editar") + " no header da seção. Quando termina, salva automaticamente. Seções podem ser " + b("publicadas") + " (default) ou rascunho (não aparece na sidebar pública)."),
          h2("Reordenar"),
          p("Drag-drop das seções na sidebar reordena. Sistema salva a nova ordem.")
        ),
      },
    ],
  },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 6. PORTAL DO CLIENTE                                             ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Portal do Cliente",
    icone: "🪟",
    descricao: "Área pública por cliente — aprovação, comentários, transparência.",
    filhas: [
      {
        titulo: "Configurar acesso (admin)",
        icone: "🔐",
        conteudo: doc(
          h1("Configurar Portal do Cliente"),
          p("Cada cliente pode ter um portal próprio. Pra ativar:"),
          ol(
            "Vai em " + c("/clientes") + " > Click no cliente",
            "Procure o card " + b("Acesso do Cliente") + " no sheet lateral",
            "Click em " + b("Gerar acesso") + " — sistema cria um token único e mostra a URL"
          ),
          h2("URL"),
          p("Formato: ", c("hub.salestrategias.com.br/p/cliente/{token}")),
          h2("Senha (opcional)"),
          p("Você pode adicionar senha — mais seguro, mas cliente tem que digitar pra entrar. Sem senha, qualquer um com o link entra."),
          h2("Toggles de permissão"),
          p("8 toggles controlam o que o cliente vê:"),
          ul(
            b("Calendário editorial") + " — Posts em COPY_PRONTA+ aparecem",
            b("Criativos de anúncio") + " — Criativos em EM_APROVACAO+ aparecem",
            b("Relatórios mensais") + " — Lista dos últimos 6 meses",
            b("Tarefas em andamento") + " — Lista read-only",
            b("Reuniões + actions") + " — Resumo + action items",
            b("Aprovar posts") + " — Cliente pode aprovar/recusar posts",
            b("Aprovar criativos") + " — Cliente pode aprovar/recusar criativos",
            b("Pedir ajustes") + " — Cliente pode comentar em posts/criativos"
          ),
          h2("Quando cliente aciona algo"),
          ul(
            "Aprova um post → Hub move post pra DESIGN_PRONTO + notifica admins SAL",
            "Pede ajuste em um post → Hub guarda o comentário + notifica admins (post fica como tá)",
            "Aprova criativo → Move pra APROVADO + notifica",
            "Pede ajuste em criativo → Comentário registrado + notifica"
          ),
          h2("Auditoria"),
          p("Cada vez que o cliente acessa, o Hub registra: data/hora do último acesso + contador de acessos totais. Aparece no card de acesso.")
        ),
        paraCliente: false,
      },
      {
        titulo: "Como usar o portal (para o cliente)",
        icone: "👋",
        paraCliente: true,
        conteudo: doc(
          h1("Bem-vindo ao seu portal"),
          quote(
            b("Esta seção é escrita pra você, cliente da SAL.")
          ),
          p("O portal é seu acesso direto ao que estamos produzindo pra sua marca. Aqui você vê o calendário editorial, os criativos de anúncio, relatórios mensais, e pode aprovar ou pedir ajustes sem precisar mandar email ou WhatsApp."),
          h2("Como entrar"),
          p("Você recebeu da SAL um link no formato " + c("hub.salestrategias.com.br/p/cliente/...") + ". Salva esse link nos favoritos do navegador (ou na tela inicial do celular)."),
          p("Se a SAL configurou senha, ela foi enviada junto. Senão, o link já abre direto."),
          h2("O que tem dentro"),
          ul(
            b("Calendário") + " — Posts que vão pra suas redes sociais. Você aprova ou pede ajuste em cada um.",
            b("Criativos") + " — Anúncios pagos (Meta/Google/TikTok) — mesma lógica de aprovação.",
            b("Tarefas") + " — O que a SAL está fazendo pra você no momento.",
            b("Reuniões") + " — Resumo das reuniões + ações combinadas.",
            b("Relatórios") + " — PDF mensal consolidado de cada mês."
          ),
          h3("Aprovar um post"),
          ol(
            "Abra a aba " + b("Calendário"),
            "Veja o post com a arte, copy, hashtags, CTA",
            "Click " + b("Aprovar") + " (verde) se tudo OK — a SAL é notificada na hora",
            "Click " + b("Pedir ajuste") + " (cinza) se quer mudar algo — descreva o que precisa ajustar e mande"
          ),
          h3("Mobile"),
          p("O portal foi feito pra funcionar bem no celular. Pode aprovar enquanto tá no Uber. Arraste pra ver as variações da arte. O modal de 'Pedir ajuste' sobe de baixo como o WhatsApp."),
          h2("Dúvidas?"),
          p("Entre em contato direto com seu contato na SAL pelo canal que vocês já usam (WhatsApp, email).")
        ),
      },
    ],
  },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 7. INTEGRAÇÕES                                                   ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Integrações",
    icone: "🔗",
    descricao: "Drive, Agenda, Sheets, Claude (MCP).",
    filhas: [
      {
        titulo: "Google Drive",
        icone: "📂",
        conteudo: doc(
          h1("Google Drive"),
          p("O Hub se integra com Google Drive pra organizar pastas de cliente, contratos, e arquivos de projeto."),
          h2("Conectar conta Google"),
          ol(
            "Vai em " + c("/perfil"),
            "Click " + b("Conectar Google"),
            "Autoriza Drive + Calendar nos escopos pedidos",
            "Hub salva refresh token pra acessar quando precisar"
          ),
          h2("Onboarding automático"),
          p("Quando você marca um cliente como ATIVO pela primeira vez, o Hub:"),
          ul(
            "Cria pasta no destino configurado (Meu Drive, Shared Drive específico, ou subpasta)",
            "Salva " + b("googleDriveFolderId") + " no cliente",
            "Pasta vira clicável na ficha do cliente"
          ),
          p("Configurar onde criar em " + c("/admin/configuracoes") + "."),
          h2("Contratos"),
          p("Ao cadastrar contrato, você pode anexar PDF — o arquivo é salvo na pasta do cliente no Drive e o link fica no contrato."),
          h2("Drive standalone"),
          p("Em " + c("/drive") + " — navegador de Drive integrado, vê arquivos da sua conta, abre direto no browser.")
        ),
      },
      {
        titulo: "Google Agenda",
        icone: "📆",
        conteudo: doc(
          h1("Google Agenda"),
          p("Hub sincroniza com sua Agenda Google pra você ver compromissos + posts + reuniões em um lugar só."),
          h2("O que vai pra Agenda automaticamente"),
          ul(
            "Posts editoriais com status AGENDADO (cria evento no horário de publicação)",
            "Aviso de vencimento de contrato (90 dias antes do fim)",
            "Reuniões agendadas com hora futura",
            "Tarefas com prazo (opcional via toggle)"
          ),
          h2("Calendário unificado"),
          p("Em " + c("/calendario") + " — vê tudo da sua Agenda + posts/contratos/reuniões/propostas/tarefas em uma view só. Arrasta evento pra reagendar (sistema atualiza Drive/Agenda)."),
          h2("Filtros"),
          p("Toggles no topo do calendário pra esconder tipos específicos (só posts, só reuniões, etc).")
        ),
      },
      {
        titulo: "Google Sheets (importar relatórios)",
        icone: "📊",
        conteudo: doc(
          h1("Importar de Google Sheets"),
          p("Pra trazer métricas de redes/SEO/tráfego pago pra dentro do Hub, você usa Sheets como intermediário (sem precisar de OAuth de cada plataforma)."),
          h2("Workflow"),
          ol(
            "Cliente compartilha planilha de métricas (do Meta, Google Ads, Analytics, etc) com você",
            "Você torna a planilha pública (qualquer pessoa com link → leitor)",
            "Vai em " + c("/relatorios/{redes|seo|trafego}") + " > Adicionar integração",
            "Cola a URL pública da planilha + escolhe a fonte (REDES / SEO / TRAFEGO)",
            "Hub puxa via " + c("/export?format=csv") + " e mapeia as colunas pra tabelas internas",
            "Click " + b("Sincronizar agora") + " — importa as linhas (upsert por chave natural ou append)"
          ),
          h2("Mapeamento"),
          p("Cada fonte tem mapeador próprio em " + c("src/lib/relatorio-mapeadores.ts") + ". Headers comuns reconhecidos automaticamente. Se a planilha de um cliente tem header diferente, ajusta o mapeador.")
        ),
      },
      {
        titulo: "Claude / MCP",
        icone: "🤖",
        conteudo: doc(
          h1("Claude (MCP)"),
          p("O Hub expõe um servidor MCP (Model Context Protocol) que permite ao Claude Desktop / Claude Code interagir com seus dados — listar clientes, criar tarefas, registrar lançamentos, buscar reuniões, etc — direto do chat."),
          h2("Configurar Claude Desktop"),
          ol(
            "Vai em " + c("/admin/mcp"),
            "Click " + b("Novo token MCP") + " — dá um nome (ex: 'Claude Desktop - Marcelo')",
            "Copia o token (formato " + c("salhub_...") + ")",
            "No Claude Desktop, adiciona o servidor MCP via Settings > Connectors com a URL " + c("https://hub.salestrategias.com.br/api/mcp") + " e o token como Bearer"
          ),
          h2("OAuth flow alternativo"),
          p("Claude Desktop mais recente faz OAuth automático: abre Connectors > Add > cola URL do Hub > Hub abre browser pedindo seu login > aprova > Claude já tem token. Sem mexer em config manual."),
          h2("Tools disponíveis"),
          p("O servidor MCP expõe ~30 tools:"),
          ul(
            "Clientes: criar, atualizar, listar, buscar, excluir",
            "Posts: criar, atualizar, listar",
            "Tarefas: criar, atualizar, listar, excluir",
            "Projetos: criar, listar, mover (mudar status)",
            "Reuniões: criar, atualizar, buscar, listar, adicionar bloco/action",
            "Notas: criar, atualizar, buscar, listar, anexar, excluir",
            "Lançamentos financeiros: criar, listar, métricas",
            "Contratos: criar, listar",
            "Eventos/agenda: próximos eventos",
            "Busca: buscar_tudo (full-text em todas entidades)"
          ),
          h2("Auditoria"),
          p("Toda chamada do Claude é registrada em " + c("McpToken.totalChamadas") + " e " + c("McpToken.ultimoUso") + ". Você vê em " + c("/admin/mcp") + " quantas chamadas cada token fez e quando foi a última.")
        ),
      },
    ],
  },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 8. RELATÓRIOS                                                    ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Relatórios",
    icone: "📊",
    descricao: "Métricas de redes, SEO e tráfego pago.",
    filhas: [
      {
        titulo: "Redes Sociais",
        icone: "📱",
        conteudo: doc(
          h1("Relatório de Redes Sociais"),
          p("Em " + c("/relatorios/redes-sociais") + " — métricas mensais por cliente por rede social."),
          h2("Redes suportadas"),
          ul("Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube"),
          h2("Métricas"),
          ul(
            "Seguidores (total + crescimento mês a mês)",
            "Alcance, impressões, engajamento",
            "Quantidade de posts, stories, reels",
            "Comparação vs meta do cliente"
          ),
          h2("Entrada de dados"),
          ul(
            "Manual (formulário pra digitar)",
            "Importar planilha do cliente via integração Sheets",
            "Via Claude/MCP (assistente importa em batch)"
          ),
          h2("Gráficos"),
          p("Linha do tempo de crescimento de seguidores, comparativos entre redes, evolução de engajamento. Aparecem no Dashboard executivo se você definir esse cliente como featured.")
        ),
      },
      {
        titulo: "SEO",
        icone: "🔍",
        conteudo: doc(
          h1("Relatório de SEO"),
          p("Em " + c("/relatorios/seo") + " — métricas SEO + tracking de keywords ranqueadas."),
          h2("Métricas mensais por cliente"),
          ul(
            "Posição média no Google",
            "Cliques orgânicos",
            "Impressões",
            "CTR",
            "Quantidade de keywords ranqueadas (entre top 10)"
          ),
          h2("Tracking de keywords"),
          p("Adicione keywords-alvo do cliente em " + b("/relatorios/seo/keywords") + " — registra posição atual, posição anterior, volume estimado, URL que ranqueia. Histórico permite ver evolução."),
          h2("Importação"),
          p("Mesmo workflow: planilha pública do Google Search Console / Semrush / Ahrefs → URL pública → importa.")
        ),
      },
      {
        titulo: "Tráfego Pago",
        icone: "💸",
        conteudo: doc(
          h1("Relatório de Tráfego Pago"),
          p("Em " + c("/relatorios/trafego-pago") + " — campanhas pagas (Meta/Google/TikTok/YouTube/LinkedIn) com performance."),
          h2("Métricas por campanha"),
          ul(
            "Investimento (R$)",
            "Impressões, cliques, conversões",
            "CPA, CPM, CPC médio, ROAS",
            "Insights (texto livre)"
          ),
          h2("Vínculo com criativos"),
          p("Cada campanha pode ter vários criativos vinculados (módulo " + b("Criativos Ads") + "). Permite drill-down 'que criativos rodaram nessa campanha' e 'como esse criativo performou'."),
          h2("Relatório mensal consolidado"),
          p("Hub gera PDF mensal por cliente em " + c("/api/clientes/{id}/relatorio-mensal?ano=&mes=") + " — agrega redes, SEO, tráfego pago, posts publicados, tarefas entregues. Aparece no portal do cliente (aba Relatórios).")
        ),
      },
    ],
  },

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ 9. ADMINISTRAÇÃO                                                 ║
  // ╚══════════════════════════════════════════════════════════════════╝
  {
    titulo: "Administração",
    icone: "⚙️",
    descricao: "Configurações, backups e tokens.",
    filhas: [
      {
        titulo: "Configurações",
        icone: "🛠️",
        conteudo: doc(
          h1("Configurações do sistema"),
          p("Em " + c("/admin/configuracoes") + " — ajustes globais que persistem entre deploys."),
          h2("Onboarding de cliente"),
          p("Onde o Hub cria as pastas Drive dos novos clientes:"),
          ul(
            b("Meu Drive") + " — Cria no seu Drive pessoal (admin que tá logado)",
            b("Shared Drive") + " — Cria em um Shared Drive específico (escolha o ID)",
            b("Pasta específica") + " — Cria dentro de uma pasta-mãe (escolhe o folder ID)"
          ),
          p("Cada cliente novo que marcar ATIVO vai criar pasta nesse destino, com nome do cliente, e linka o " + b("googleDriveFolderId") + " no DB.")
        ),
      },
      {
        titulo: "Backups",
        icone: "💾",
        conteudo: doc(
          h1("Backups do banco"),
          p("Em " + c("/admin/backups") + " — gerencia backups do PostgreSQL."),
          h2("Backup manual"),
          ol(
            "SSH no VPS",
            "Roda " + c("./scripts/backup.sh"),
            "Arquivo " + c("salhub-YYYYMMDD-HHMMSS.sql.gz") + " é criado em " + c("/opt/sal-hub/backups/"),
            "Mantém os últimos 30 backups, mais antigos são deletados"
          ),
          h2("Restaurar backup"),
          quote(
            b("Atenção:") + " restaurar SUBSTITUI todo o banco atual."
          ),
          p("Em " + c("/admin/backups") + " você vê a lista de backups disponíveis. Pra restaurar:"),
          ol(
            "SSH no VPS",
            "Roda " + c("./scripts/restore.sh backups/salhub-YYYYMMDD-HHMMSS.sql.gz"),
            "Confirma — banco é dropado e recriado do backup"
          ),
          h2("Backup automático"),
          p("Recomendado: configurar cron no VPS pra rodar " + c("./scripts/backup.sh") + " diariamente às 3am. Detalhes em " + c("DEPLOY-HOSTINGER.md") + " no repo.")
        ),
      },
      {
        titulo: "Tokens MCP",
        icone: "🔑",
        conteudo: doc(
          h1("Tokens MCP / Claude"),
          p("Em " + c("/admin/mcp") + " — gerencia tokens que dão acesso ao servidor MCP do Hub."),
          h2("Criar token"),
          ol(
            "Click " + b("Novo token"),
            "Dá um nome descritivo (ex: 'Claude Desktop - Marcelo')",
            "Define escopos (futuro — agora todos têm acesso total)",
            "Click " + b("Gerar"),
            "Copia o token exibido — ele só aparece UMA VEZ"
          ),
          h2("Auditoria"),
          p("Cada token mostra:"),
          ul(
            "Prefixo visível (primeiros 16 chars)",
            "Quantas chamadas fez no total",
            "Quando foi o último uso",
            "Quando foi criado"
          ),
          h2("Revogar"),
          p("Click no ícone de lixeira → token é revogado (não deletado, fica em audit). Claude que estava usando perde acesso imediatamente."),
          h2("Segurança"),
          p("O token nunca é guardado em texto puro — só o SHA-256 dele. Se você perdeu o token, gera um novo. Não tem 'lembrar' essa senha.")
        ),
      },
    ],
  },
];

// ─── Função de seed (idempotente) ─────────────────────────────────────

export async function seedManualHubSeNecessario(): Promise<void> {
  const count = await prisma.docSecao.count({ where: { tipo: "HUB" } });
  if (count > 0) return;

  let ordemPai = 0;
  for (const categoria of ESTRUTURA) {
    ordemPai += 10;
    // Cria categoria (parent) — sem conteúdo, só agrupador
    const pai = await prisma.docSecao
      .create({
        data: {
          tipo: "HUB",
          titulo: categoria.titulo,
          slug: slugify(categoria.titulo),
          icone: categoria.icone,
          ordem: ordemPai,
          conteudo: doc(
            h1(categoria.titulo),
            p(categoria.descricao),
            p("Veja as sub-seções no menu lateral.")
          ),
          publicada: true,
        },
      })
      .catch(() => null);

    if (!pai) continue;

    let ordemFilha = 0;
    for (const filha of categoria.filhas) {
      ordemFilha += 10;
      await prisma.docSecao
        .create({
          data: {
            tipo: "HUB",
            titulo: filha.titulo,
            slug: slugify(filha.titulo),
            icone: filha.icone,
            ordem: ordemFilha,
            parentId: pai.id,
            conteudo: filha.conteudo,
            publicada: true,
          },
        })
        .catch(() => undefined);
    }
  }
}
