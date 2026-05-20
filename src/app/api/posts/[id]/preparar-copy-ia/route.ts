/**
 * POST /api/posts/[id]/preparar-copy-ia
 *
 * Gera prompt pra Claude criar copy completa do post:
 *   - legenda (texto plain, com quebras de parágrafo)
 *   - hashtags (array)
 *   - cta (1 linha)
 *   - observacoesProducao (refs visuais pra designer)
 *
 * Contexto coletado:
 *   - Brief do post (titulo, formato, pilar, observacoes atuais)
 *   - Cliente (nome, notas — tom de voz)
 *   - Últimos 3 posts publicados do mesmo cliente (referência de estilo)
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { extrairTextoDeBlocos } from "@/lib/proposta-helpers";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const post = await prisma.post.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        cliente: { select: { nome: true, notas: true } },
      },
    });

    // 3 posts mais recentes publicados do mesmo cliente — referência de estilo
    const referencias = await prisma.post.findMany({
      where: {
        clienteId: post.clienteId,
        status: "PUBLICADO",
        id: { not: post.id },
        legenda: { not: null },
      },
      orderBy: { dataPublicacao: "desc" },
      take: 3,
      select: {
        titulo: true,
        formato: true,
        legenda: true,
        hashtags: true,
        cta: true,
      },
    });

    const FORMATO_INSTRUCOES: Record<string, string> = {
      FEED: "Post de feed do Instagram. Copy 80-150 palavras. Pode ter 1 emoji por parágrafo, no máximo. Hook na 1ª linha.",
      STORIES: "Stories — texto curtíssimo, 1-3 frases. Direto ao ponto. Pode ter mais emojis. Geralmente 1 CTA explícito.",
      REELS: "Reels — copy 30-80 palavras complementando o vídeo. Hook + 1 dado + CTA. Hashtags ao final.",
      CARROSSEL: "Carrossel — copy 100-200 palavras explicando o tema do carrossel. Mais educacional/aprofundado. Estimule a swipar.",
    };

    const systemPrompt = `Você é um copywriter sênior de redes sociais de uma agência brasileira de marketing digital (SAL Estratégias de Marketing). Está produzindo copy pra cliente: ${post.cliente?.nome ?? "(prospect)"}.

Formato deste post: ${post.formato} — ${FORMATO_INSTRUCOES[post.formato] ?? ""}

Regras de tom + linguagem:
- Português do Brasil (pt-BR)
- Sem clichês de marketing ("transforme seu negócio", "potencialize", "alavanque")
- Use voz natural, conversacional. Como se fosse o próprio dono escrevendo.
- Respeite o tom de voz do cliente (descrito nas notas internas + visível nos posts anteriores como referência).
- Hashtags: 8-15 relevantes, mistura de nicho + amplo + locais quando faz sentido.
- CTA: curto, ativo, claro. Sem "saiba mais" genérico.
- Observações de produção: notas pro designer (paleta, estilo de arte, refs visuais, música pra reels) — interno, cliente NÃO vê.

Responda APENAS com JSON válido no formato:
{
  "legenda": "string com a copy completa. Use \\n\\n entre parágrafos. Pode usar emoji com moderação.",
  "hashtags": ["array de 8-15 strings sem o #. Ex: 'galeriachaves', 'decoração', 'poa'"],
  "cta": "string curta de 1 linha (max 80 chars). Ex: 'Vem nos visitar — Andradas 1044'",
  "observacoesProducao": "string com refs visuais pro designer. Max 300 chars. Inclua: paleta sugerida, estilo de arte (foto/grafismo/colagem), elementos a evitar, música/áudio se Reels."
}

Sem texto fora do JSON. Sem markdown wrapping. Sem comentários.`;

    const userPrompt = `# Brief do post

## Identificação
- Título interno: ${post.titulo}
- Pilar de conteúdo: ${post.pilar ?? "(não definido)"}
- Formato: ${post.formato}
- Data de publicação prevista: ${post.dataPublicacao.toLocaleDateString("pt-BR")}

## Cliente: ${post.cliente?.nome ?? "(prospect sem cadastro)"}
${
  post.cliente?.notas
    ? `### Notas internas (tom de voz, posicionamento, observações)\n${extrairTextoDeBlocos(post.cliente.notas).slice(0, 2000)}`
    : "(sem notas internas — gere copy baseado só no que está no brief)"
}

## Brief atual deste post (pode estar parcialmente preenchido)
${
  post.legenda?.trim()
    ? `### Copy/legenda já escrita (pode reescrever do zero ou refinar)\n${extrairTextoDeBlocos(post.legenda).slice(0, 1500)}`
    : "(legenda ainda vazia)"
}

${
  post.observacoesProducao?.trim()
    ? `### Notas de produção já anotadas\n${post.observacoesProducao.slice(0, 1000)}`
    : ""
}

${
  post.cta?.trim() ? `### CTA atual\n"${post.cta}"` : ""
}

${
  post.hashtags.length > 0 ? `### Hashtags atuais\n${post.hashtags.join(", ")}` : ""
}

## Referência de estilo — últimos 3 posts publicados deste cliente
${
  referencias.length === 0
    ? "(nenhum post publicado anteriormente — defina o tom baseado nas notas do cliente)"
    : referencias
        .map(
          (r, i) =>
            `### Ref ${i + 1} — "${r.titulo}" (${r.formato})\nCopy: ${extrairTextoDeBlocos(r.legenda).slice(0, 600)}\nHashtags: ${r.hashtags.join(", ") || "(nenhuma)"}\nCTA: ${r.cta || "(nenhum)"}`
        )
        .join("\n\n")
}

---

Gere a copy completa no formato JSON especificado. Mantenha o tom dos posts de referência.`;

    return {
      systemPrompt,
      userPrompt,
    };
  });
}
