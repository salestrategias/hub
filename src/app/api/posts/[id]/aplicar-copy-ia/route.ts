/**
 * POST /api/posts/[id]/aplicar-copy-ia
 *
 * Salva legenda + hashtags + cta + observacoesProducao gerados pela IA.
 *
 * NOTA sobre legenda: salva como TEXTO PLAIN (string com \n\n entre
 * parágrafos). O Tiptap (BlockEditor) sabe converter automaticamente
 * pra blocos de parágrafo no carregamento.
 */
import { z } from "zod";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

const copySchema = z.object({
  legenda: z.string().min(10).max(5000),
  hashtags: z.array(z.string().max(50)).max(30),
  cta: z.string().max(200),
  observacoesProducao: z.string().max(800),
});

const inputSchema = z.object({
  resposta: z.string().min(20),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { resposta } = inputSchema.parse(await req.json());

    const json = extrairJson(resposta);
    const copy = copySchema.parse(json);

    // Hashtags: limpa # se vier por engano, trim, lowercase, dedup
    const hashtagsLimpas = Array.from(
      new Set(
        copy.hashtags
          .map((h) => h.replace(/^#+/, "").trim().toLowerCase())
          .filter((h) => h.length > 0)
      )
    );

    const post = await prisma.post.update({
      where: { id: params.id },
      data: {
        legenda: copy.legenda,
        hashtags: hashtagsLimpas,
        cta: copy.cta.trim() || null,
        observacoesProducao: copy.observacoesProducao.trim() || null,
      },
      select: {
        id: true,
        legenda: true,
        hashtags: true,
        cta: true,
        observacoesProducao: true,
      },
    });

    return { ok: true, post };
  });
}

function extrairJson(raw: string): unknown {
  const limpo = raw.trim();
  const matchBloco = limpo.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = matchBloco ? matchBloco[1] : limpo;
  const inicio = candidato.search(/[{[]/);
  const ultimoObj = candidato.lastIndexOf("}");
  const ultimoArr = candidato.lastIndexOf("]");
  const fim = Math.max(ultimoObj, ultimoArr);
  if (inicio < 0 || fim < 0 || fim < inicio) {
    throw new Error("Não encontrei JSON válido. Cola o JSON completo entre chaves.");
  }
  const json = candidato.slice(inicio, fim + 1);
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(
      `JSON inválido: ${e instanceof Error ? e.message : "erro de parsing"}.`
    );
  }
}
