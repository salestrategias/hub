/**
 * POST /api/calendario/reagendar
 *
 * Reagenda um evento via drag-drop no calendário unificado. Despacha
 * pra o endpoint correto baseado em `origem`:
 *   - TAREFA       → PATCH tarefa.dataEntrega
 *   - POST         → PATCH post.dataPublicacao
 *   - CONTEUDO_SAL → PATCH conteudoSal.dataPublicacao
 *   - REUNIAO      → PATCH reuniao.data
 *
 * Origens "marco" (CONTRATO_VENCENDO, PROPOSTA_EXPIRA) não são
 * reagendáveis — endpoint rejeita.
 *
 * Body: { origem, entidadeId, novoInicio (ISO) }
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  origem: z.enum(["TAREFA", "POST", "CONTEUDO_SAL", "REUNIAO"]),
  entidadeId: z.string().min(1),
  novoInicio: z.coerce.date(),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { origem, entidadeId, novoInicio } = schema.parse(await req.json());

    switch (origem) {
      case "TAREFA":
        await prisma.tarefa.update({
          where: { id: entidadeId },
          data: { dataEntrega: novoInicio },
        });
        return { ok: true };
      case "POST":
        await prisma.post.update({
          where: { id: entidadeId },
          data: { dataPublicacao: novoInicio },
        });
        return { ok: true };
      case "CONTEUDO_SAL":
        await prisma.conteudoSAL.update({
          where: { id: entidadeId },
          data: { dataPublicacao: novoInicio },
        });
        return { ok: true };
      case "REUNIAO":
        await prisma.reuniao.update({
          where: { id: entidadeId },
          data: { data: novoInicio },
        });
        return { ok: true };
    }
  });
}
