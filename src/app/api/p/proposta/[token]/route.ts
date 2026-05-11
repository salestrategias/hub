import bcrypt from "bcryptjs";
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { propostaContexto, expandirSecaoProposta } from "@/lib/proposta-helpers";

/**
 * Endpoint público que serve a proposta pra o link compartilhado.
 *
 * Segurança:
 *   - Não requer auth (cliente acessa sem login)
 *   - Autenticação implícita pelo token (16 bytes hex aleatórios)
 *   - Senha opcional via header `x-share-senha` ou body POST
 *
 * Side-effects:
 *   - Incrementa shareViews
 *   - Define primeiroAcesso (vistaEm) na primeira request
 *   - Status RASCUNHO/ENVIADA → VISTA (snapshot do timestamp)
 *   - Notifica o criador na primeira visualização
 *
 * Pra POST (com senha), passamos { senha } no body.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  return handle(req, params.token, null);
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const body = (await req.json().catch(() => ({}))) as { senha?: string };
    const result = await handlePublic(params.token, body.senha ?? null);
    return result;
  });
}

function handle(_req: Request, token: string, senhaProvida: string | null) {
  return apiHandler(async () => handlePublic(token, senhaProvida));
}

async function handlePublic(token: string, senhaProvida: string | null) {
  const proposta = await prisma.proposta.findUnique({
    where: { shareToken: token },
    include: {
      cliente: { select: { id: true, nome: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!proposta) {
    throw new Error("Proposta não encontrada");
  }
  if (proposta.shareExpiraEm && proposta.shareExpiraEm < new Date()) {
    // Marca como expirada (idempotente)
    if (proposta.status !== "EXPIRADA" && proposta.status !== "ACEITA" && proposta.status !== "RECUSADA") {
      void prisma.proposta.update({
        where: { id: proposta.id },
        data: { status: "EXPIRADA" },
      }).catch(() => undefined);
    }
    throw new Error("Este link expirou.");
  }

  // Senha (se houver)
  if (proposta.shareSenha) {
    if (!senhaProvida) {
      // Sinaliza pro client mostrar a tela de senha
      return { precisaSenha: true };
    }
    const ok = await bcrypt.compare(senhaProvida, proposta.shareSenha);
    if (!ok) {
      throw new Error("Senha incorreta");
    }
  }

  // Side effects: incrementa views + marca primeira visualização
  const primeiraVez = !proposta.vistaEm;
  void prisma.proposta
    .update({
      where: { id: proposta.id },
      data: {
        shareViews: { increment: 1 },
        vistaEm: proposta.vistaEm ?? new Date(),
        status:
          proposta.status === "RASCUNHO" || proposta.status === "ENVIADA"
            ? "VISTA"
            : proposta.status,
      },
    })
    .catch(() => undefined);

  if (primeiraVez) {
    void prisma.notificacao
      .create({
        data: {
          userId: proposta.criadoPor,
          tipo: "PROPOSTA_VISTA",
          titulo: `👀 ${proposta.clienteNome} viu a proposta ${proposta.numero}`,
          descricao: proposta.titulo,
          href: `/propostas/${proposta.id}`,
          entidadeTipo: "PROPOSTA",
          entidadeId: proposta.id,
          chave: `PROPOSTA_VISTA:${proposta.id}`,
        },
      })
      .catch(() => undefined);
  }

  // Expande variáveis em todas as seções
  const ctx = propostaContexto(
    {
      numero: proposta.numero,
      titulo: proposta.titulo,
      clienteNome: proposta.clienteNome,
      clienteEmail: proposta.clienteEmail,
      valorMensal: proposta.valorMensal ? Number(proposta.valorMensal) : null,
      valorTotal: proposta.valorTotal ? Number(proposta.valorTotal) : null,
      duracaoMeses: proposta.duracaoMeses,
      validadeDias: proposta.validadeDias,
      shareExpiraEm: proposta.shareExpiraEm,
    },
    { name: proposta.user.name, email: proposta.user.email }
  );

  return {
    id: proposta.id,
    numero: proposta.numero,
    titulo: expandirSecaoProposta(proposta.titulo, ctx),
    clienteNome: proposta.clienteNome,
    clienteEmail: proposta.clienteEmail,
    logoUrl: proposta.logoUrl,
    corPrimaria: proposta.corPrimaria,
    capa: expandirSecaoProposta(proposta.capa, ctx),
    diagnostico: expandirSecaoProposta(proposta.diagnostico, ctx),
    objetivo: expandirSecaoProposta(proposta.objetivo, ctx),
    escopo: expandirSecaoProposta(proposta.escopo, ctx),
    cronograma: expandirSecaoProposta(proposta.cronograma, ctx),
    investimento: expandirSecaoProposta(proposta.investimento, ctx),
    proximosPassos: expandirSecaoProposta(proposta.proximosPassos, ctx),
    termos: expandirSecaoProposta(proposta.termos, ctx),
    valorMensal: proposta.valorMensal ? Number(proposta.valorMensal) : null,
    valorTotal: proposta.valorTotal ? Number(proposta.valorTotal) : null,
    duracaoMeses: proposta.duracaoMeses,
    validadeDias: proposta.validadeDias,
    shareExpiraEm: proposta.shareExpiraEm?.toISOString() ?? null,
    status: proposta.status,
    enviadaEm: proposta.enviadaEm?.toISOString() ?? null,
    aceitaEm: proposta.aceitaEm?.toISOString() ?? null,
    recusadaEm: proposta.recusadaEm?.toISOString() ?? null,
    autorNome: proposta.user.name,
    autorEmail: proposta.user.email,
  };
}
