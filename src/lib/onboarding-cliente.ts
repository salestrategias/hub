/**
 * Onboarding automático de cliente.
 *
 * Trigger: rodado quando um cliente vira ATIVO pela primeira vez —
 * seja via criação direta (POST /api/clientes), promoção de status
 * (PATCH), ou conversão de lead (POST /api/leads/[id]/converter).
 *
 * O que faz:
 *  1. Cria pasta no Google Drive (se ainda não tem) — apenas se o
 *     usuário tem Google conectado. Falha de Drive não bloqueia o
 *     resto do onboarding.
 *  2. Cria projeto "Onboarding {Cliente}" status=BRIEFING, vinculado
 *     ao cliente, com data de entrega = 30 dias.
 *  3. Cria N tarefas padrão dentro desse projeto (briefing, acessos,
 *     kickoff, etc) com prazos escalonados.
 *  4. Notificação interna celebrativa pro responsável.
 *  5. Marca cliente.onboardingFeitoEm = now (idempotência).
 *
 * Falhas parciais NÃO desfazem o que já foi criado. Marcador é setado
 * SÓ se ao menos o projeto for criado com sucesso. Drive pode falhar
 * (sem auth) e ainda assim onboarding "completa" — Marcelo pode rodar
 * de novo pelo botão manual no sheet pra tentar criar a pasta.
 *
 * Faturamento do mês 1: NÃO duplicamos — o `processarFaturamentoMensal()`
 * lazy roda na próxima vez que /financeiro abrir e pega o novo cliente.
 */
import { prisma } from "@/lib/db";
import { createFolder, resolveOnboardingParentId } from "@/lib/google-drive";

const TAREFAS_PADRAO: Array<{
  titulo: string;
  descricao?: string;
  prioridade: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA";
  /** Dias a partir de hoje pra dataEntrega */
  prazoDias: number;
}> = [
  {
    titulo: "Reunião de kickoff",
    descricao: "Agendar reunião inicial com cliente. Apresentar equipe, alinhar expectativas e cronograma.",
    prioridade: "URGENTE",
    prazoDias: 3,
  },
  {
    titulo: "Briefing completo",
    descricao: "Entender negócio: objetivos do trimestre, público-alvo, concorrência, diferencial, tom de voz, persona.",
    prioridade: "ALTA",
    prazoDias: 7,
  },
  {
    titulo: "Coletar acessos",
    descricao: "Instagram, Facebook, LinkedIn, Google Ads, Meta Business, GA4, Search Console, site. Pedir senhas ou acesso colaborador.",
    prioridade: "ALTA",
    prazoDias: 5,
  },
  {
    titulo: "Definir pilares de conteúdo",
    descricao: "3-5 pilares editoriais que vão guiar publicações. Ex: autoridade, educacional, bastidores, conversão.",
    prioridade: "NORMAL",
    prazoDias: 14,
  },
  {
    titulo: "Setup de relatório mensal",
    descricao: "Configurar integrações de Sheets nos relatórios (Redes/SEO/Tráfego pago) com URLs públicas das planilhas do cliente.",
    prioridade: "NORMAL",
    prazoDias: 14,
  },
  {
    titulo: "Apresentar plano editorial do mês 1",
    descricao: "Calendário de posts, formatos, datas, copy aprovada. Validar com cliente antes de produzir.",
    prioridade: "ALTA",
    prazoDias: 21,
  },
  {
    titulo: "Definir KPIs e metas do mês 1",
    descricao: "Combinar metas de seguidores, engajamento, leads (se tráfego pago). Cadastrar no /relatorios/redes (Meta).",
    prioridade: "NORMAL",
    prazoDias: 7,
  },
];

export type ResultadoOnboarding = {
  ok: boolean;
  jaFeito: boolean;
  projetoCriado: boolean;
  projetoId?: string;
  pastaDriveCriada: boolean;
  pastaDriveUrl?: string;
  pastaDriveErro?: string;
  tarefasCriadas: number;
};

/**
 * Executa onboarding pra um cliente. Idempotente — se já foi feito,
 * retorna sem efeito colateral.
 *
 * @param clienteId cliente alvo
 * @param userId usuário responsável (recebe notificação celebrativa)
 * @param forcar se true, ignora `onboardingFeitoEm` e re-executa (botão "re-executar")
 */
export async function executarOnboardingCliente(
  clienteId: string,
  userId: string,
  opts: { forcar?: boolean } = {}
): Promise<ResultadoOnboarding> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nome: true,
      onboardingFeitoEm: true,
      googleDriveFolderId: true,
      googleDriveFolderUrl: true,
    },
  });
  if (!cliente) throw new Error("Cliente não encontrado");

  if (cliente.onboardingFeitoEm && !opts.forcar) {
    return {
      ok: true,
      jaFeito: true,
      projetoCriado: false,
      pastaDriveCriada: false,
      tarefasCriadas: 0,
    };
  }

  const resultado: ResultadoOnboarding = {
    ok: true,
    jaFeito: false,
    projetoCriado: false,
    pastaDriveCriada: false,
    tarefasCriadas: 0,
  };

  // ── 1. Pasta no Drive ────────────────────────────────────────────
  // Falha de Drive (sem auth, sem permissão, etc) é registrada mas
  // não interrompe o resto. Marcelo pode tentar de novo via botão.
  //
  // Parent default: vem de `resolveOnboardingParentId()` que tenta
  // achar o Shared Drive "Clientes SAL" (configurável via env).
  // Fallback null = cria em Meu Drive pessoal.
  if (!cliente.googleDriveFolderId) {
    try {
      const parentId = await resolveOnboardingParentId();
      const pasta = await createFolder(cliente.nome, parentId ?? undefined);
      await prisma.cliente.update({
        where: { id: clienteId },
        data: {
          googleDriveFolderId: pasta.id,
          googleDriveFolderUrl: pasta.webViewLink ?? null,
        },
      });
      resultado.pastaDriveCriada = true;
      resultado.pastaDriveUrl = pasta.webViewLink ?? undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.warn("[onboarding] falha ao criar pasta Drive:", msg);
      resultado.pastaDriveErro = msg;
    }
  } else {
    resultado.pastaDriveUrl = cliente.googleDriveFolderUrl ?? undefined;
  }

  // ── 2. Projeto Onboarding com tarefas ────────────────────────────
  const hoje = new Date();
  const dataEntregaProjeto = new Date(hoje);
  dataEntregaProjeto.setDate(dataEntregaProjeto.getDate() + 30);

  const projeto = await prisma.projeto.create({
    data: {
      nome: `Onboarding · ${cliente.nome}`,
      descricao:
        "Onboarding inicial gerado automaticamente quando o cliente foi ativado. " +
        "Tarefas padrão da SAL — ajuste/remova conforme contexto do cliente.",
      status: "BRIEFING",
      prioridade: "ALTA",
      dataEntrega: dataEntregaProjeto,
      clienteId,
      googleDriveFolderId: resultado.pastaDriveUrl ? cliente.googleDriveFolderId : null,
      googleDriveFolderUrl: resultado.pastaDriveUrl ?? null,
    },
  });
  resultado.projetoCriado = true;
  resultado.projetoId = projeto.id;

  // Tarefas em batch — preserva ordem pelos prazoDias crescentes
  const tarefasParaCriar = TAREFAS_PADRAO.map((t) => {
    const dataEntrega = new Date(hoje);
    dataEntrega.setDate(dataEntrega.getDate() + t.prazoDias);
    return {
      titulo: t.titulo,
      descricao: t.descricao,
      prioridade: t.prioridade,
      dataEntrega,
      clienteId,
      projetoId: projeto.id,
    };
  });

  const criadas = await prisma.tarefa.createMany({
    data: tarefasParaCriar,
  });
  resultado.tarefasCriadas = criadas.count;

  // ── 3. Notificação celebrativa ──────────────────────────────────
  // Não trava se falhar (chave única evita dup se rodar 2x)
  void prisma.notificacao
    .create({
      data: {
        userId,
        tipo: "SISTEMA",
        titulo: `🚀 Onboarding criado · ${cliente.nome}`,
        descricao: `Projeto "Onboarding" + ${resultado.tarefasCriadas} tarefa(s) padrão.${
          resultado.pastaDriveCriada ? " Pasta no Drive criada." : ""
        }`,
        href: `/clientes/${clienteId}`,
        entidadeTipo: "CLIENTE",
        entidadeId: clienteId,
        chave: `ONBOARDING:${clienteId}:${opts.forcar ? Date.now() : "inicial"}`,
      },
    })
    .catch(() => undefined);

  // ── 4. Marcador de idempotência ─────────────────────────────────
  await prisma.cliente.update({
    where: { id: clienteId },
    data: { onboardingFeitoEm: new Date() },
  });

  return resultado;
}

/**
 * Versão fire-and-forget — pra triggers que não devem bloquear o
 * caller (criação de cliente, conversão de lead, etc).
 *
 * Erros são logados mas não propagados. O caller assume sucesso na
 * operação principal mesmo se o onboarding falhar (Marcelo pode
 * re-executar manualmente).
 */
export async function executarOnboardingSilencioso(
  clienteId: string,
  userId: string
): Promise<void> {
  try {
    await executarOnboardingCliente(clienteId, userId);
  } catch (err) {
    console.error("[onboarding] falha silenciosa:", err);
  }
}
