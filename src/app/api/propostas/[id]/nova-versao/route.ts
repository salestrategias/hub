/**
 * POST /api/propostas/[id]/nova-versao
 *
 * Cria nova versão (revisão) da proposta a partir da atual.
 *
 * Fluxo:
 *  1. Carrega proposta atual + descobre raiz (versaoRaizId ?? id)
 *  2. Conta quantas versões existem na thread → nova = max+1
 *  3. Duplica registro com todos os campos copiados
 *  4. Reseta status (RASCUNHO), shareToken (null), datas de envio/aceite
 *  5. Marca todas as outras versões da thread como versaoAtual=false
 *  6. Nova versão fica como versaoAtual=true
 *  7. numero da nova: "{numero raiz}-v{novaVersao}"
 *
 * Body opcional: { motivo: string } — anotação interna da revisão.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();

    const body = (await req.json().catch(() => ({}))) as { motivo?: string };
    const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 2000) : null;

    const atual = await prisma.proposta.findUniqueOrThrow({ where: { id: params.id } });
    const raizId = atual.versaoRaizId ?? atual.id;

    // Encontra raiz pra extrair número base (sem sufixo -vN)
    const raiz = atual.versaoRaizId
      ? await prisma.proposta.findUnique({ where: { id: atual.versaoRaizId } })
      : atual;
    if (!raiz) throw new Error("Versão raiz não encontrada");

    // Próxima versão
    const todasDaThread = await prisma.proposta.findMany({
      where: { OR: [{ id: raizId }, { versaoRaizId: raizId }] },
      select: { versao: true },
    });
    const novaVersao = Math.max(...todasDaThread.map((p) => p.versao), 1) + 1;

    // Marca todas como não-atuais
    await prisma.proposta.updateMany({
      where: { OR: [{ id: raizId }, { versaoRaizId: raizId }] },
      data: { versaoAtual: false },
    });

    // Duplica registro — só copia campos editoriais; reseta status/share
    const novoNumero = `${raiz.numero}-v${novaVersao}`;

    const novaProposta = await prisma.proposta.create({
      data: {
        numero: novoNumero,
        titulo: atual.titulo,
        clienteId: atual.clienteId,
        clienteNome: atual.clienteNome,
        clienteEmail: atual.clienteEmail,

        // Conteúdo (cópia integral)
        capa: atual.capa,
        diagnostico: atual.diagnostico,
        objetivo: atual.objetivo,
        escopo: atual.escopo,
        cronograma: atual.cronograma,
        investimento: atual.investimento,
        proximosPassos: atual.proximosPassos,
        termos: atual.termos,

        valorMensal: atual.valorMensal,
        valorTotal: atual.valorTotal,
        duracaoMeses: atual.duracaoMeses,
        validadeDias: atual.validadeDias,

        logoUrl: atual.logoUrl,
        corPrimaria: atual.corPrimaria,
        capaImagemUrl: atual.capaImagemUrl,
        extras: atual.extras as object | null,

        // Status reseta — começa como RASCUNHO até reenviar
        status: "RASCUNHO",
        // Share zerado — precisa enviar de novo pra gerar novo token
        shareToken: null,
        shareExpiraEm: null,
        shareSenha: atual.shareSenha, // mantém senha se tinha
        shareViews: 0,

        enviadaEm: null,
        vistaEm: null,
        aceitaEm: null,
        recusadaEm: null,
        recusaMotivo: null,
        aceiteIp: null,
        aceiteUa: null,
        aceiteNome: null,
        aceiteCpfCnpj: null,

        leadId: atual.leadId,
        criadoPor: atual.criadoPor,

        // Versionamento
        versao: novaVersao,
        versaoRaizId: raizId,
        versaoAtual: true,
        motivoRevisao: motivo,
      },
    });

    return novaProposta;
  });
}
