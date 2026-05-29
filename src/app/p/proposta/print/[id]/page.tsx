import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { verifyPrintToken } from "@/lib/print-token";
import { propostaContexto, expandirSecaoProposta } from "@/lib/proposta-helpers";
import { PropostaDocumento, type PropostaDocumentoData } from "@/components/proposta-documento";

export const dynamic = "force-dynamic";

/**
 * Página de PRINT da proposta — documento A4 limpo, sem chrome interativo,
 * reusando exatamente o render da pública (`PropostaDocumento`).
 *
 * É a página que o Chromium headless (puppeteer-core) abre pra gerar o PDF
 * fiel à web. NÃO registra view pública (é uso interno).
 *
 * Acesso (auth dupla):
 *   (a) `?t=<token>` válido (HMAC efêmero, assinado pela rota de PDF), OU
 *   (b) sessão NextAuth autenticada (Marcelo logado pré-visualiza no navegador).
 * Sem nenhum dos dois → notFound().
 */
export default async function PropostaPrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  // ── Auth dupla ──────────────────────────────────────────────
  const tokenValido = verifyPrintToken(params.id, searchParams.t);
  if (!tokenValido) {
    const session = await auth();
    if (!session?.user?.id) notFound();
  }

  const proposta = await prisma.proposta.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, nome: true } },
      user: { select: { name: true, email: true } },
    },
  });
  if (!proposta) notFound();

  // Expande {{vars}} em todas as seções — igual à rota pública, pra o print
  // ficar idêntico ao que o cliente vê na web.
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

  const data: PropostaDocumentoData = {
    id: proposta.id,
    numero: proposta.numero,
    titulo: expandirSecaoProposta(proposta.titulo, ctx),
    clienteNome: proposta.clienteNome,
    clienteEmail: proposta.clienteEmail,
    logoUrl: proposta.logoUrl,
    corPrimaria: proposta.corPrimaria,
    capaImagemUrl: proposta.capaImagemUrl,
    extras: proposta.extras,
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
    aceiteNome: proposta.aceiteNome,
    aceiteCpfCnpj: proposta.aceiteCpfCnpj,
    autorNome: proposta.user.name,
    autorEmail: proposta.user.email,
    versao: proposta.versao,
    versaoAtual: proposta.versaoAtual,
    versaoAtualToken: null,
  };

  return (
    <>
      {/* Stylesheet de print mínimo: A4, fundo branco, preserva cores de fundo. */}
      <style>{`
        @page { size: A4; margin: 0; }
        html, body {
          background: #FFFFFF;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>
      <PropostaDocumento proposta={data} modoApresentacao print />
    </>
  );
}
