import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { gerarNotificacoes } from "@/lib/notificacoes";

/**
 * Lista notificações do usuário logado.
 *
 * Query:
 *   limite      — máximo retornado (default 30, max 100)
 *   apenasNaoLidas — "1" filtra só não lidas
 *
 * Sempre roda `gerarNotificacoes` antes (idempotente, ~200ms) pra garantir
 * que regras novas (contrato vencendo hoje, tarefa que ficou atrasada à
 * meia-noite) apareçam na próxima poll do sininho.
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const limite = Math.min(Math.max(Number(searchParams.get("limite") ?? 30), 1), 100);
    const apenasNaoLidas = searchParams.get("apenasNaoLidas") === "1";

    // Gera novas notificações (idempotente). Não bloqueia caso falhe.
    try {
      await gerarNotificacoes(user.id);
    } catch (e) {
      console.warn("[notificacoes] gerar falhou:", e);
    }

    const [items, naoLidas] = await Promise.all([
      prisma.notificacao.findMany({
        where: {
          userId: user.id,
          ...(apenasNaoLidas ? { lida: false } : {}),
        },
        orderBy: [{ lida: "asc" }, { createdAt: "desc" }],
        take: limite,
      }),
      prisma.notificacao.count({
        where: { userId: user.id, lida: false },
      }),
    ]);

    return { items, naoLidas };
  });
}
