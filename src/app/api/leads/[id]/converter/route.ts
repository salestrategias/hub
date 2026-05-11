import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { leadConverterSchema } from "@/lib/schemas";

/**
 * Converte um Lead em Cliente, marcando o lead como GANHO.
 *
 * Modos:
 *  - "novo" → cria Cliente novo usando dados do lead
 *  - "existente" → vincula a um Cliente pré-cadastrado (clienteId obrigatório)
 *
 * Side effects:
 *  - Cria notificação celebrativa (PROPOSTA_ACEITA reaproveitado por
 *    enquanto — tipo genérico de "conquista comercial")
 *  - Marca status = GANHO e convertidoEm = agora
 *  - Liga `lead.clienteId` ao cliente criado/escolhido (relação 1:1)
 *
 * Idempotente: se lead já tem clienteId, retorna sem duplicar cliente.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = leadConverterSchema.parse(await req.json());

    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: params.id },
      include: { cliente: true },
    });

    // Idempotente
    if (lead.clienteId && lead.cliente) {
      return {
        ok: true,
        jaConvertido: true,
        clienteId: lead.cliente.id,
        clienteNome: lead.cliente.nome,
      };
    }

    let clienteId: string;
    let clienteNome: string;

    if (body.modo === "existente") {
      if (!body.clienteId) throw new Error("clienteId obrigatório no modo existente");
      const c = await prisma.cliente.findUnique({ where: { id: body.clienteId } });
      if (!c) throw new Error("Cliente não encontrado");
      // Bloqueia vincular a cliente que já é de outro lead
      const conflito = await prisma.lead.findFirst({
        where: { clienteId: c.id, id: { not: lead.id } },
      });
      if (conflito) {
        throw new Error(`Cliente ${c.nome} já está vinculado ao lead "${conflito.empresa}"`);
      }
      // Promove status pra ATIVO se ainda era PROSPECT
      if (c.status === "PROSPECT") {
        await prisma.cliente.update({
          where: { id: c.id },
          data: {
            status: "ATIVO",
            valorContratoMensal:
              body.valorContratoMensal ??
              (lead.valorEstimadoMensal ? Number(lead.valorEstimadoMensal) : c.valorContratoMensal),
          },
        });
      }
      clienteId = c.id;
      clienteNome = c.nome;
    } else {
      // Modo "novo" — cria Cliente a partir do lead
      const valor =
        body.valorContratoMensal ??
        (lead.valorEstimadoMensal ? Number(lead.valorEstimadoMensal) : 0);
      const novo = await prisma.cliente.create({
        data: {
          nome: lead.empresa,
          email: lead.contatoEmail || null,
          telefone: lead.contatoTelefone || null,
          status: "ATIVO",
          valorContratoMensal: valor,
          notas: lead.notas, // preserva contexto rico
        },
      });
      clienteId = novo.id;
      clienteNome = novo.nome;
    }

    // Marca lead como ganho + linka cliente
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "GANHO",
        clienteId,
        convertidoEm: new Date(),
      },
    });

    // Notificação celebrativa pro responsável do lead
    void prisma.notificacao
      .create({
        data: {
          userId: lead.responsavel,
          tipo: "PROPOSTA_ACEITA",
          titulo: `🎉 ${lead.empresa} fechou! Agora é cliente.`,
          descricao: `Convertido em ${new Date().toLocaleDateString("pt-BR")}${
            user.id !== lead.responsavel ? ` por ${user.name ?? "outro membro"}` : ""
          }`,
          href: `/clientes/${clienteId}`,
          entidadeTipo: "CLIENTE",
          entidadeId: clienteId,
          chave: `LEAD_GANHO:${lead.id}`,
        },
      })
      .catch(() => undefined);

    return { ok: true, clienteId, clienteNome };
  });
}
