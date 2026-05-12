/**
 * POST /api/reunioes/[id]/aplicar-ia
 *
 * Recebe a resposta JSON do Claude Max colada pelo Marcelo no wizard,
 * parseia com tolerância (Claude às vezes wrappa em ```json), valida
 * estrutura e aplica:
 *  - resumo → reuniao.resumoIA (convertido pra BlockNote)
 *  - action_items → ReuniaoAction[] (substitui existentes)
 *  - capitulos → ReuniaoCapitulo[] (substitui existentes)
 *
 * Body: { resposta: string } — texto bruto colado
 *
 * Substituições não são incrementais: re-rodar limpa anteriores. Marcelo
 * pode editar actions/capitulos individualmente na UI depois.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const inputSchema = z.object({
  resposta: z.string().min(10, "Resposta vazia"),
});

const jsonSchema = z.object({
  resumo: z.string().optional().default(""),
  action_items: z
    .array(
      z.object({
        texto: z.string().min(1),
        responsavel: z.string().nullable().optional(),
        prazo: z.string().nullable().optional(),
      })
    )
    .default([]),
  capitulos: z
    .array(
      z.object({
        timestamp: z.string(),
        titulo: z.string().min(1).max(120),
      })
    )
    .default([]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { resposta } = inputSchema.parse(await req.json());

    // Extrai JSON do texto (Claude pode envelopar em ```json...``` ou
    // adicionar prefácio "Aqui está...")
    const json = extrairJson(resposta);
    if (!json) {
      throw new Error(
        "Não consegui encontrar JSON na resposta. Cola só o JSON limpo, sem texto explicativo antes ou depois."
      );
    }

    let parsed: z.infer<typeof jsonSchema>;
    try {
      parsed = jsonSchema.parse(JSON.parse(json));
    } catch (e) {
      throw new Error(
        "JSON inválido: " + (e instanceof Error ? e.message : "estrutura incorreta")
      );
    }

    // Aplica em transação
    await prisma.$transaction(async (tx) => {
      // Limpa actions/capitulos antigos
      await tx.reuniaoAction.deleteMany({ where: { reuniaoId: params.id } });
      await tx.reuniaoCapitulo.deleteMany({ where: { reuniaoId: params.id } });

      // Resumo → BlockNote
      const resumoBlocks = parsed.resumo
        ? JSON.stringify(textoParaBlockNote(parsed.resumo))
        : null;

      await tx.reuniao.update({
        where: { id: params.id },
        data: resumoBlocks ? { resumoIA: resumoBlocks } : {},
      });

      // Insere actions
      if (parsed.action_items.length > 0) {
        await tx.reuniaoAction.createMany({
          data: parsed.action_items.map((a, i) => ({
            reuniaoId: params.id,
            ordem: i,
            texto: a.texto,
            responsavel: a.responsavel ?? null,
            prazo: a.prazo ?? null,
            concluido: false,
          })),
        });
      }

      // Insere capítulos
      if (parsed.capitulos.length > 0) {
        await tx.reuniaoCapitulo.createMany({
          data: parsed.capitulos.map((c, i) => ({
            reuniaoId: params.id,
            ordem: i,
            timestamp: parseTimecode(c.timestamp),
            titulo: c.titulo,
          })),
        });
      }
    });

    return {
      ok: true,
      resumoAtualizado: !!parsed.resumo,
      actions: parsed.action_items.length,
      capitulos: parsed.capitulos.length,
    };
  });
}

/**
 * Extrai bloco JSON de texto bruto. Tolerante a:
 *  - JSON puro (caso ideal)
 *  - ```json {...} ``` (markdown wrapped)
 *  - "Aqui está o JSON: {...}" (prefácio)
 */
function extrairJson(texto: string): string | null {
  const t = texto.trim();

  // Caso 1: já é JSON puro
  if (t.startsWith("{") && t.endsWith("}")) return t;

  // Caso 2: markdown wrapped
  const md = t.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (md) return md[1].trim();

  // Caso 3: encontra primeiro { e último } balanceados
  const inicio = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (inicio >= 0 && fim > inicio) return t.slice(inicio, fim + 1);

  return null;
}

function parseTimecode(tc: string): number {
  const partes = tc.split(":").map((s) => parseInt(s, 10));
  if (partes.length === 3) return partes[0] * 3600 + partes[1] * 60 + partes[2];
  if (partes.length === 2) return partes[0] * 60 + partes[1];
  return 0;
}

function textoParaBlockNote(texto: string): unknown[] {
  const blocos: unknown[] = [];
  const linhas = texto.split("\n");
  for (const raw of linhas) {
    const linha = raw.trim();
    if (!linha) continue;

    // Detect heading "## X" do markdown
    const h2 = linha.match(/^##\s+(.+)$/);
    if (h2) {
      blocos.push({
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: h2[1], styles: {} }],
      });
      continue;
    }

    if (linha.startsWith("- ") || linha.startsWith("• ") || linha.startsWith("* ")) {
      blocos.push({
        type: "bulletListItem",
        content: [{ type: "text", text: linha.replace(/^[-•*]\s*/, ""), styles: {} }],
      });
    } else {
      blocos.push({
        type: "paragraph",
        content: [{ type: "text", text: linha, styles: {} }],
      });
    }
  }
  return blocos;
}
