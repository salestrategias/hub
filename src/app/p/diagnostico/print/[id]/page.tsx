import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { verifyPrintToken } from "@/lib/print-token";
import { normalizarSecoes } from "@/lib/diagnostico-secoes";
import {
  DiagnosticoDocumento,
  type DiagnosticoDocumentoData,
} from "@/components/diagnostico-documento";

export const dynamic = "force-dynamic";

/**
 * Página de PRINT do diagnóstico — documento A4 limpo, sem chrome interativo,
 * reusando exatamente o render da pública (`DiagnosticoDocumento`).
 *
 * É a página que o Chromium headless (puppeteer-core) abre pra gerar o PDF
 * fiel à web. NÃO registra view pública (é uso interno).
 *
 * Acesso (auth dupla, igual à proposta):
 *   (a) `?t=<token>` válido (HMAC efêmero, assinado pela rota de PDF), OU
 *   (b) sessão NextAuth autenticada (Marcelo logado pré-visualiza no navegador).
 * Sem nenhum dos dois → notFound().
 */
export default async function DiagnosticoPrintPage({
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

  const diagnostico = await prisma.diagnostico.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, nome: true } },
      user: { select: { name: true, email: true } },
    },
  });
  if (!diagnostico) notFound();

  // Só seções visíveis, na ordem — mesma regra da rota pública, pra o print
  // ficar idêntico ao que o cliente vê na web.
  const secoes = normalizarSecoes(diagnostico.secoes)
    .filter((s) => s.visivel)
    .map((s) => ({ id: s.id, tipo: s.tipo, titulo: s.titulo, conteudo: s.conteudo }));

  const data: DiagnosticoDocumentoData = {
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

  return (
    <>
      {/* Stylesheet de print mínimo: A4, sem margem (margens vêm do page.pdf). */}
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; }
      `}</style>
      <DiagnosticoDocumento diag={data} modoApresentacao print />
    </>
  );
}
