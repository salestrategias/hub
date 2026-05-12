/**
 * POST /api/reunioes/[id]/importar-meet
 *
 * Importa transcrição (+ resumo + actions se disponíveis) de um Google
 * Doc gerado pelo Meet. Body:
 *   { docId } ou { docUrl }  — um dos dois
 *
 * Comportamento:
 *  - Apaga blocos/actions/capítulos existentes da reunião pra evitar
 *    duplicação (re-importar é caso de uso comum)
 *  - Mantém `notasLivres` (anotações manuais do Marcelo) intacta
 *  - Mantém `resumoIA` se o Doc não trouxer resumo (Business Standard
 *    sem Gemini) — Marcelo gera depois via Claude Max
 *  - Atualiza `status=TRANSCRITA` quando há blocos
 *  - Salva o ID do Doc importado na descrição pra rastreio
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getDocText, extrairDocId } from "@/lib/google-docs";
import { parsearMeetDoc } from "@/lib/meet-parser";

const schema = z
  .object({
    docId: z.string().optional(),
    docUrl: z.string().optional(),
  })
  .refine((d) => d.docId || d.docUrl, "docId ou docUrl obrigatório");

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const body = schema.parse(await req.json());

    const docId = body.docId ?? extrairDocId(body.docUrl ?? "");
    if (!docId) throw new Error("ID/URL do Doc inválido");

    // Confirma que a reunião existe
    const reuniao = await prisma.reuniao.findUniqueOrThrow({
      where: { id: params.id },
      select: { id: true },
    });

    // Baixa e parseia
    const texto = await getDocText(docId);
    const parsed = parsearMeetDoc(texto);

    // Transação: substitui SÓ o que veio no Doc atual. Preserva o resto.
    //
    // Motivação: o Meet com Gemini frequentemente gera 2 Docs separados
    // ("Anotações da reunião" → resumo+actions; "Transcrição" → só blocos).
    // Marcelo pode querer importar os DOIS pra reunião — se a gente apagar
    // tudo no segundo import, perde o primeiro.
    //
    // Regra: se o Doc atual TROUXE blocks → substitui blocks (re-import
    // do mesmo Doc com correção fica idempotente). Se NÃO trouxe → preserva.
    // Mesma lógica pra actions e resumo.
    await prisma.$transaction(async (tx) => {
      if (parsed.blocks.length > 0) {
        await tx.reuniaoBlock.deleteMany({ where: { reuniaoId: reuniao.id } });
        await tx.reuniaoBlock.createMany({
          data: parsed.blocks.map((b, i) => ({
            reuniaoId: reuniao.id,
            ordem: i,
            timestamp: b.timestampSeg,
            speaker: b.speaker,
            texto: b.texto,
          })),
        });
      }

      if (parsed.actions.length > 0) {
        await tx.reuniaoAction.deleteMany({ where: { reuniaoId: reuniao.id } });
        await tx.reuniaoAction.createMany({
          data: parsed.actions.map((a, i) => ({
            reuniaoId: reuniao.id,
            ordem: i,
            texto: a.texto,
            responsavel: a.responsavel,
            prazo: a.prazo,
            concluido: false,
          })),
        });
      }

      // Atualiza reuniao: status + resumoIA (se trouxe)
      const dataUpdate: { status?: "TRANSCRITA"; resumoIA?: string } = {};
      if (parsed.blocks.length > 0) dataUpdate.status = "TRANSCRITA";
      if (parsed.resumo) {
        dataUpdate.resumoIA = JSON.stringify(textoParaBlockNote(parsed.resumo));
      }

      if (Object.keys(dataUpdate).length > 0) {
        await tx.reuniao.update({
          where: { id: reuniao.id },
          data: dataUpdate,
        });
      }
    });

    return {
      ok: true,
      blocos: parsed.blocks.length,
      actions: parsed.actions.length,
      resumoImportado: !!parsed.resumo,
      planoDetectado: parsed.temResumo ? "Plus/Enterprise (com Gemini)" : "Standard (só transcrição)",
    };
  });
}

/**
 * Converte texto plano em estrutura BlockNote serializada (JSON).
 * Linhas vazias separam parágrafos. Linhas começando com "-" viram bullets.
 */
function textoParaBlockNote(texto: string): unknown[] {
  const blocos: unknown[] = [];
  for (const linha of texto.split("\n")) {
    const t = linha.trim();
    if (!t) continue;
    if (t.startsWith("- ") || t.startsWith("• ") || t.startsWith("* ")) {
      blocos.push({
        type: "bulletListItem",
        content: [{ type: "text", text: t.replace(/^[-•*]\s*/, ""), styles: {} }],
      });
    } else {
      blocos.push({
        type: "paragraph",
        content: [{ type: "text", text: t, styles: {} }],
      });
    }
  }
  return blocos;
}
