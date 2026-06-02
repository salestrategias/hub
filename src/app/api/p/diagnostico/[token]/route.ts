import bcrypt from "bcryptjs";
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizarSecoes } from "@/lib/diagnostico-secoes";

/**
 * Endpoint público que serve o diagnóstico pro link compartilhado.
 *
 * Segurança:
 *   - Não requer auth (prospect acessa sem login)
 *   - Autenticado implicitamente pelo token (16 bytes hex aleatórios)
 *   - Senha opcional via body POST { senha }
 *
 * Side-effects:
 *   - Incrementa shareViews
 *   - Define vistoEm na primeira request; status ENVIADO → VISTO
 *   - Notifica o criador na primeira visualização
 *
 * Diagnóstico não tem aceite (não é contrato) — só leitura.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => handlePublic(params.token, null));
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const body = (await req.json().catch(() => ({}))) as { senha?: string };
    return handlePublic(params.token, body.senha ?? null);
  });
}

async function handlePublic(token: string, senhaProvida: string | null) {
  const diagnostico = await prisma.diagnostico.findUnique({
    where: { shareToken: token },
    include: {
      cliente: { select: { id: true, nome: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!diagnostico) {
    throw new Error("Diagnóstico não encontrado");
  }
  if (diagnostico.shareExpiraEm && diagnostico.shareExpiraEm < new Date()) {
    throw new Error("Este link expirou.");
  }

  // Senha (se houver)
  if (diagnostico.shareSenha) {
    if (!senhaProvida) {
      return { precisaSenha: true };
    }
    const ok = await bcrypt.compare(senhaProvida, diagnostico.shareSenha);
    if (!ok) {
      throw new Error("Senha incorreta");
    }
  }

  // Side-effects: incrementa views + marca primeira visualização
  const primeiraVez = !diagnostico.vistoEm;
  void prisma.diagnostico
    .update({
      where: { id: diagnostico.id },
      data: {
        shareViews: { increment: 1 },
        vistoEm: diagnostico.vistoEm ?? new Date(),
        status: diagnostico.status === "ENVIADO" ? "VISTO" : diagnostico.status,
      },
    })
    .catch(() => undefined);

  if (primeiraVez) {
    void prisma.notificacao
      .create({
        data: {
          userId: diagnostico.criadoPor,
          tipo: "SISTEMA",
          titulo: `👀 ${diagnostico.clienteNome} viu o diagnóstico ${diagnostico.numero}`,
          descricao: diagnostico.titulo,
          href: `/diagnosticos/${diagnostico.id}`,
          entidadeTipo: "DIAGNOSTICO",
          entidadeId: diagnostico.id,
          chave: `DIAGNOSTICO_VISTO:${diagnostico.id}`,
        },
      })
      .catch(() => undefined);
  }

  // Só seções visíveis, na ordem — diagnóstico é leitura elegante.
  // `dados` carrega o payload dos blocos visuais estruturados.
  const secoes = normalizarSecoes(diagnostico.secoes)
    .filter((s) => s.visivel)
    .map((s) => ({ id: s.id, tipo: s.tipo, titulo: s.titulo, conteudo: s.conteudo, dados: s.dados }));

  return {
    id: diagnostico.id,
    numero: diagnostico.numero,
    titulo: diagnostico.titulo,
    clienteNome: diagnostico.clienteNome,
    logoUrl: diagnostico.logoUrl,
    corPrimaria: diagnostico.corPrimaria,
    capaImagemUrl: diagnostico.capaImagemUrl,
    secoes,
    status: diagnostico.status,
    enviadoEm: diagnostico.enviadoEm?.toISOString() ?? null,
    shareExpiraEm: diagnostico.shareExpiraEm?.toISOString() ?? null,
    autorNome: diagnostico.user.name,
    autorEmail: diagnostico.user.email,
  };
}
