import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Aceite digital de proposta — endpoint PÚBLICO (sem auth).
 *
 * Autenticação: pelo `token` (query param), que tem que bater com o
 * `shareToken` da proposta E não estar expirado.
 *
 * Registra:
 *   - status = ACEITA
 *   - aceitaEm = agora
 *   - aceiteIp, aceiteUa (snapshot)
 *
 * Cria notificação interna pro Marcelo "Cliente X aceitou proposta Y".
 *
 * Idempotente: se já está ACEITA, retorna ok sem duplicar.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) throw new Error("Token obrigatório");

    const proposta = await prisma.proposta.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        numero: true,
        titulo: true,
        clienteNome: true,
        shareToken: true,
        shareExpiraEm: true,
        status: true,
        criadoPor: true,
      },
    });

    if (!proposta || proposta.shareToken !== token) {
      throw new Error("Proposta não encontrada");
    }
    if (proposta.shareExpiraEm && proposta.shareExpiraEm < new Date()) {
      throw new Error("Link expirado");
    }
    if (proposta.status === "ACEITA") {
      // idempotente
      return { ok: true, jaAceita: true };
    }
    if (proposta.status === "RECUSADA") {
      throw new Error("Esta proposta foi recusada — entre em contato pra emitirmos uma nova.");
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;

    await prisma.proposta.update({
      where: { id: params.id },
      data: {
        status: "ACEITA",
        aceitaEm: new Date(),
        aceiteIp: ip,
        aceiteUa: ua,
      },
    });

    // Notificação interna (fire-and-forget)
    void prisma.notificacao
      .create({
        data: {
          userId: proposta.criadoPor,
          tipo: "PROPOSTA_ACEITA",
          titulo: `🎉 ${proposta.clienteNome} aceitou a proposta ${proposta.numero}`,
          descricao: proposta.titulo,
          href: `/propostas/${proposta.id}`,
          entidadeTipo: "PROPOSTA",
          entidadeId: proposta.id,
          chave: `PROPOSTA_ACEITA:${proposta.id}`,
        },
      })
      .catch(() => undefined);

    return { ok: true };
  });
}
