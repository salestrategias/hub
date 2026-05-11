import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { propostaRecusarSchema } from "@/lib/schemas";

/**
 * Recusa de proposta — endpoint PÚBLICO (sem auth, autenticado por token).
 * Comportamento espelhado de aceitar.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) throw new Error("Token obrigatório");

    const body = propostaRecusarSchema.parse(await req.json().catch(() => ({})));

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
    if (proposta.status === "RECUSADA") {
      return { ok: true, jaRecusada: true };
    }
    if (proposta.status === "ACEITA") {
      throw new Error("Esta proposta já foi aceita.");
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;

    await prisma.proposta.update({
      where: { id: params.id },
      data: {
        status: "RECUSADA",
        recusadaEm: new Date(),
        recusaMotivo: body.motivo ?? null,
        aceiteIp: ip,
        aceiteUa: ua,
      },
    });

    void prisma.notificacao
      .create({
        data: {
          userId: proposta.criadoPor,
          tipo: "PROPOSTA_RECUSADA",
          titulo: `${proposta.clienteNome} recusou a proposta ${proposta.numero}`,
          descricao: body.motivo ? `Motivo: ${body.motivo.slice(0, 100)}` : "Sem motivo informado",
          href: `/propostas/${proposta.id}`,
          entidadeTipo: "PROPOSTA",
          entidadeId: proposta.id,
          chave: `PROPOSTA_RECUSADA:${proposta.id}`,
        },
      })
      .catch(() => undefined);

    return { ok: true };
  });
}
