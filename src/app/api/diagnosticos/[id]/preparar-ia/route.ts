import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizarSecoes, catalogoDe, type DiagnosticoSecao } from "@/lib/diagnostico-secoes";
import { extrairTextoDeBlocos } from "@/lib/proposta-helpers";

/**
 * Modo Claude Max: monta o prompt completo (system + user) pronto pra
 * Marcelo colar no Claude Desktop/Web. NÃO chama IA — zero custo de API.
 *
 * O insumo central é a TRANSCRIÇÃO da reunião vinculada (não um prompt
 * digitado). A IA recebe as falas reais e devolve um JSON cujas chaves
 * são os `id` das seções a preencher. /aplicar-ia grava de volta.
 *
 * Diferente da proposta:
 *  - sem prompt livre obrigatório (a reunião é o input);
 *  - chaves do JSON = ids das seções (não nomes fixos);
 *  - system prompt = a metodologia SAL de diagnóstico (o ativo central).
 */

// Limite do trecho de transcrição que entra no prompt. Reuniões de ~2h
// podem passar de 100k chars; truncamos com marcador + lista de capítulos
// pra IA manter o arco completo da conversa mesmo sem o texto inteiro.
const MAX_TRANSCRICAO_CHARS = 90000;
const MAX_RESUMO_CHARS = 40000;
const MAX_SECAO_CONTEXTO_CHARS = 1200;

const inputSchema = z.object({
  tom: z.enum(["consultivo", "direto", "estrategico", "caloroso"]).default("consultivo"),
  contextoExtra: z.string().max(2000).optional(),
  /** Se presente, gera só essa seção (por id). Senão, todas as visíveis. */
  secaoFoco: z.string().optional(),
});

const TOM_INSTRUCOES: Record<z.infer<typeof inputSchema>["tom"], string> = {
  consultivo:
    "Consultivo e estratégico — de quem entendeu o negócio a fundo e enxerga o que o dono não viu. Autoridade sem arrogância. Esse é o default do diagnóstico SAL.",
  direto:
    "Direto e objetivo. Frases curtas, zero floreio, foco no que importa. Bom pra quem decide rápido e quer o essencial.",
  estrategico:
    "Estratégico e de visão longa. Conecta os pontos, mostra o tabuleiro inteiro e onde o negócio pode chegar em 12-24 meses.",
  caloroso:
    "Caloroso e próximo, sem perder profundidade. Tom de parceiro que torce pelo negócio e fala humano — bom pra primeiro contato com prospect sensível.",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = inputSchema.parse(await req.json());

    const diagnostico = await prisma.diagnostico.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { nome: true, email: true, endereco: true, notas: true } },
        lead: {
          select: {
            empresa: true,
            segmento: true,
            contatoNome: true,
            origem: true,
            notas: true,
          },
        },
        reuniao: {
          select: {
            titulo: true,
            data: true,
            resumoIA: true,
            blocks: {
              select: { timestamp: true, speaker: true, texto: true },
              orderBy: { ordem: "asc" },
            },
            capitulos: {
              select: { timestamp: true, titulo: true },
              orderBy: { timestamp: "asc" },
            },
          },
        },
      },
    });

    const secoes = normalizarSecoes(diagnostico.secoes);

    // Alvos: foco numa seção (por id) ou todas as visíveis.
    const alvos = body.secaoFoco
      ? secoes.filter((s) => s.id === body.secaoFoco)
      : secoes.filter((s) => s.visivel);

    if (alvos.length === 0) {
      throw new Error(
        body.secaoFoco
          ? "Seção não encontrada. Recarregue a página e tente de novo."
          : "Nenhuma seção visível pra gerar. Ative ao menos uma seção no navegador à esquerda."
      );
    }

    const systemPrompt = montarSystemPrompt(body.tom);
    const userPrompt = montarUserPrompt({
      diagnostico,
      secoesAlvo: alvos,
      todasSecoes: secoes,
      contextoExtra: body.contextoExtra?.trim() || null,
    });

    // Junta system + user num único bloco — o claude.ai/Desktop não tem
    // campo separado de system message na UI, então Marcelo cola tudo.
    const promptCompleto = `${systemPrompt}\n\n${"━".repeat(60)}\n\n${userPrompt}`;

    return { promptCompleto, systemPrompt, userPrompt };
  });
}

// ─── System prompt — metodologia SAL de diagnóstico ───────────────────

function montarSystemPrompt(tom: z.infer<typeof inputSchema>["tom"]): string {
  return `Você é o estrategista sênior de diagnóstico da SAL Estratégias de Marketing — uma agência brasileira (sede em Porto Alegre, atende o Brasil todo). Sua tarefa é redigir, em português do Brasil, as seções de um DIAGNÓSTICO ESTRATÉGICO de marketing pra um negócio. O diagnóstico é uma entrega de valor independente: é apresentado ANTES e separado da proposta comercial — ele tem que impressionar sozinho.

Tom de voz: ${TOM_INSTRUCOES[tom]}

## A metodologia SAL de diagnóstico (siga à risca)

1. ANCORE EM FALAS REAIS. O insumo central é a transcrição da reunião. Cite a dor nas PALAVRAS do próprio cliente ("como você mesmo disse, ..."). Nada de genérico — tudo tem que soar como se fosse escrito só pra esse negócio. Se a transcrição traz um número, um nome, um caso concreto, use.

2. ACHE A OPORTUNIDADE NÃO-ÓBVIA. Qualquer um aponta "poste mais no Instagram". Seu diferencial é enxergar o que ninguém apontou pra ele — o ângulo de posicionamento, o público mal-atendido, a categoria não-disputada, o ativo que ele subestima.

3. RESPEITE A NUANCE DO SETOR. Cada segmento tem suas regras. Saúde/odontologia tem limites éticos de publicidade (CFO/CFM — nada de promessa de resultado, "antes e depois" tem restrição). Advocacia idem (OAB). Ticket alto e decisão longa mudam a jornada. Mostre que você conhece o terreno.

4. VIRE O HISTÓRICO RUIM COM AGÊNCIAS. Muitos prospects já se queimaram com agência que sumiu, prometeu e não entregou, ou só "fez post". Não ataque os outros — mostre, pelo método, por que com a SAL é diferente (estratégia antes de execução, transparência, plataforma própria).

5. POSICIONAMENTO SAL (regras permanentes):
   - IA é FACILITADOR de produtividade e execução — a ESTRATÉGIA é decisão humana. Nunca diga que "a IA vai cuidar do marketing". Diga que a IA acelera, e a inteligência estratégica é da SAL.
   - SEO inclui GEO: aparecer não só no Google, mas em LLMs / respostas de IA / AI Overview. Quando falar de busca, lembre disso.
   - A SAL tem PLATAFORMA PRÓPRIA (portal do cliente: aprovação de criativos, calendário editorial, relatórios). É um diferencial concreto — use quando couber.
   - NUNCA use o termo "PMEs". A audiência são lojistas, negócios locais, e-commerces e marcas. Fale com gente, não com sigla.

## Formato da resposta

Cada seção é redigida em MARKDOWN simples: parágrafos, ## subtítulos quando ajudar, listas com "- ", **negrito** pra destaque. NÃO use tabelas nem ### h3 aninhado. Texto pronto pra colar — denso de conteúdo, sem encher linguiça.

Você vai receber, no contexto abaixo: o negócio, a transcrição da reunião e a lista exata de seções a preencher (cada uma com um identificador e um checklist de perguntas que ela precisa responder).

IMPORTANTE — responda APENAS com um objeto JSON válido. As CHAVES são EXATAMENTE os identificadores das seções fornecidos (copie-os ao pé da letra, são ids tipo "sec-..."). Os VALORES são o markdown de cada seção. Exemplo de forma:
{
  "sec-capa-xxxx": "markdown da seção...",
  "sec-sumarioExecutivo-xxxx": "markdown da seção..."
}
Sem texto fora do JSON. Sem comentários. Só preencha as chaves que eu listar — nada além delas.`;
}

// ─── User prompt — contexto do negócio + transcrição + seções ─────────

type DiagnosticoComRelacoes = {
  titulo: string;
  clienteNome: string;
  clienteEmail: string | null;
  cliente: {
    nome: string;
    email: string | null;
    endereco: string | null;
    notas: string | null;
  } | null;
  lead: {
    empresa: string;
    segmento: string | null;
    contatoNome: string | null;
    origem: string | null;
    notas: string | null;
  } | null;
  reuniao: {
    titulo: string;
    data: Date;
    resumoIA: string | null;
    blocks: Array<{ timestamp: number; speaker: string; texto: string }>;
    capitulos: Array<{ timestamp: number; titulo: string }>;
  } | null;
};

function montarUserPrompt({
  diagnostico,
  secoesAlvo,
  todasSecoes,
  contextoExtra,
}: {
  diagnostico: DiagnosticoComRelacoes;
  secoesAlvo: DiagnosticoSecao[];
  todasSecoes: DiagnosticoSecao[];
  contextoExtra: string | null;
}): string {
  const partes: string[] = [];

  partes.push(`# Diagnóstico estratégico a redigir\n\nTítulo do diagnóstico: ${diagnostico.titulo}`);

  // ── Cliente / prospect ──
  partes.push(`## O negócio\n${montarContextoNegocio(diagnostico)}`);

  // ── Contexto extra do Marcelo ──
  if (contextoExtra) {
    partes.push(
      `## Contexto adicional (insights do estrategista, fora da reunião)\n${contextoExtra}`
    );
  }

  // ── Reunião: capítulos + transcrição ──
  if (diagnostico.reuniao) {
    const r = diagnostico.reuniao;
    const dataFmt = r.data.toLocaleDateString("pt-BR");
    partes.push(`## Reunião de diagnóstico\nTítulo: ${r.titulo} · Data: ${dataFmt}`);

    if (r.capitulos.length > 0) {
      const outline = r.capitulos
        .map((c) => `- [${fmtTimecode(c.timestamp)}] ${c.titulo}`)
        .join("\n");
      partes.push(`### Capítulos da reunião (o arco da conversa)\n${outline}`);
    }

    const transcricao = montarTranscricao(r.blocks);
    if (transcricao) {
      partes.push(
        `### Transcrição da reunião (falas reais — ancore tudo aqui)\n${transcricao}`
      );
    } else if (r.resumoIA) {
      const resumo = extrairTextoDeBlocos(r.resumoIA).slice(0, MAX_RESUMO_CHARS);
      partes.push(
        `### Resumo da reunião (não há transcrição bloco-a-bloco; use este resumo)\n${resumo}`
      );
    } else {
      partes.push(
        `### Transcrição\n(A reunião vinculada ainda não tem transcrição nem resumo. Baseie-se no contexto do negócio e no contexto adicional acima.)`
      );
    }
  } else {
    partes.push(
      `## Reunião de diagnóstico\n(Nenhuma reunião vinculada. Não invente falas — trabalhe com o contexto do negócio e o contexto adicional acima, e seja honesto sobre o que precisaria ser validado.)`
    );
  }

  // ── Conteúdo já existente (seções fora do alvo que já têm texto) ──
  const idsAlvo = new Set(secoesAlvo.map((s) => s.id));
  const jaPreenchidas = todasSecoes
    .filter((s) => !idsAlvo.has(s.id) && temConteudo(s.conteudo))
    .map((s) => {
      const txt = extrairTextoDeBlocos(s.conteudo).slice(0, MAX_SECAO_CONTEXTO_CHARS);
      return `#### ${s.titulo}\n${txt}`;
    });
  if (jaPreenchidas.length > 0) {
    partes.push(
      `## Seções já redigidas (NÃO reescrever — só pra você manter coerência e não repetir)\n${jaPreenchidas.join(
        "\n\n"
      )}`
    );
  }

  // ── As seções a preencher (com id + checklist) ──
  const blocosSecoes = secoesAlvo
    .map((s) => {
      const cat = catalogoDe(s.tipo);
      const guia =
        cat.perguntasGuia.length > 0
          ? cat.perguntasGuia.map((p) => `   - ${p}`).join("\n")
          : "   - (Seção livre — redija o que fizer sentido pra este negócio.)";
      const jaTem = temConteudo(s.conteudo)
        ? "\n   ⚠ Já tem rascunho — reescreva melhor, mantendo o que for bom."
        : "";
      return `### id: ${s.id}\nTítulo: ${s.titulo}\nPropósito: ${cat.placeholder}\nResponda no conteúdo desta seção:\n${guia}${jaTem}`;
    })
    .join("\n\n");

  partes.push(
    `## Seções a preencher (${secoesAlvo.length})\nPreencha CADA uma destas seções. No JSON de resposta, a chave de cada seção é o "id:" indicado (copie exatamente).\n\n${blocosSecoes}`
  );

  // ── Instrução final ──
  const idsLista = secoesAlvo.map((s) => `"${s.id}"`).join(", ");
  partes.push(
    `---\nResponda SÓ com o JSON. As chaves devem ser exatamente: ${idsLista}. Cada valor é o markdown da seção, ancorado nas falas reais da reunião.`
  );

  return partes.join("\n\n");
}

function montarContextoNegocio(d: DiagnosticoComRelacoes): string {
  const linhas: string[] = [];
  const nome = d.cliente?.nome ?? d.clienteNome;
  linhas.push(`Nome: ${nome}`);

  const segmento = d.lead?.segmento;
  if (segmento) linhas.push(`Segmento: ${segmento}`);
  if (d.cliente?.endereco) linhas.push(`Endereço/praça: ${d.cliente.endereco}`);
  if (d.lead?.origem) linhas.push(`Origem do lead: ${d.lead.origem}`);
  if (d.lead?.contatoNome) linhas.push(`Contato: ${d.lead.contatoNome}`);

  if (!d.cliente && !d.lead) {
    linhas.push("(Prospect sem cadastro de cliente nem lead no Hub.)");
  }

  // Notas internas do cliente (BlockNote → texto) e/ou do lead.
  const notasCliente = d.cliente?.notas ? extrairTextoDeBlocos(d.cliente.notas).trim() : "";
  if (notasCliente) {
    linhas.push(`\nNotas internas (cliente):\n${notasCliente.slice(0, 2000)}`);
  }
  const notasLead = d.lead?.notas ? extrairTextoDeBlocos(d.lead.notas).trim() : "";
  if (notasLead) {
    linhas.push(`\nNotas internas (lead):\n${notasLead.slice(0, 2000)}`);
  }

  return linhas.join("\n");
}

function montarTranscricao(
  blocks: Array<{ timestamp: number; speaker: string; texto: string }>
): string {
  if (blocks.length === 0) return "";
  const linhas = blocks.map((b) => `[${fmtTimecode(b.timestamp)}] ${b.speaker}: ${b.texto}`);
  let texto = linhas.join("\n");
  if (texto.length > MAX_TRANSCRICAO_CHARS) {
    texto =
      texto.slice(0, MAX_TRANSCRICAO_CHARS) +
      `\n\n[... transcrição truncada em ${MAX_TRANSCRICAO_CHARS.toLocaleString(
        "pt-BR"
      )} caracteres. Use os capítulos acima pra entender o arco completo da reunião. ...]`;
  }
  return texto;
}

function temConteudo(conteudo: string): boolean {
  const t = (conteudo ?? "").trim();
  if (!t) return false;
  // BlockNote vazio costuma ser "[]" ou um parágrafo sem texto.
  return extrairTextoDeBlocos(t).trim().length > 0;
}

function fmtTimecode(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}
