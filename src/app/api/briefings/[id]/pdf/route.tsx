import { existsSync } from "node:fs";
// puppeteer-core é peerDep externo: NÃO está no package.json (o Marcelo roda
// `npm install puppeteer-core` à parte pra não desincronizar o lock).
// Por isso este import pode não resolver no editor até instalar — é esperado.
// (Mesmo padrão da rota de PDF da proposta.)
import puppeteer from "puppeteer-core";
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { signPrintToken } from "@/lib/print-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gera PDF das RESPOSTAS do briefing (lado SAL) — espelha a rota de PDF da
 * proposta: abre a página de print interna (`/p/briefing/print/[id]`) com
 * Chromium headless via puppeteer-core e imprime em PDF.
 *
 * Acesso: só sessão autenticada (uso interno — não há link público de PDF
 * de briefing). O Chromium acessa a página de print via print-token efêmero
 * assinado aqui (mesmo `signPrintToken` da proposta).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth();

    const briefing = await prisma.briefing.findUnique({
      where: { id: params.id },
      select: { id: true, clienteNome: true, titulo: true, respondidoEm: true },
    });
    if (!briefing) {
      return new Response("Briefing não encontrado", { status: 404 });
    }

    const buffer = await renderChromiumPdf(briefing.id);
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nomeArquivo(briefing)}"`,
      },
    });
  } catch (e) {
    if (e instanceof ChromiumPdfError) {
      console.error("[briefings/pdf] chromium falhou:", e.message);
      return new Response(`Falha ao gerar PDF via Chromium: ${e.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return apiHandler(async () => {
      throw e;
    });
  }
}

// ─── Engine Chromium (mesmo padrão da rota de proposta) ──────────────────

class ChromiumPdfError extends Error {}

/** Resolve o executável do Chromium: env var ou caminhos comuns do Alpine. */
function resolverChromiumPath(): string {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env) return env;
  for (const candidato of ["/usr/bin/chromium-browser", "/usr/bin/chromium"]) {
    if (existsSync(candidato)) return candidato;
  }
  throw new ChromiumPdfError(
    "Chromium não encontrado. Rode `npm install puppeteer-core` e defina " +
      "PUPPETEER_EXECUTABLE_PATH (ex: /usr/bin/chromium-browser no Alpine, " +
      "ou o caminho do Chrome local no Windows/macOS)."
  );
}

/**
 * Abre a página de print interna com Chromium headless e imprime em PDF.
 * baseUrl é server-side (loopback) — o Chromium roda no mesmo host da app.
 */
async function renderChromiumPdf(briefingId: string): Promise<Buffer> {
  const executablePath = resolverChromiumPath();
  const printToken = signPrintToken(briefingId);
  const baseUrl = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  const printUrl = `${baseUrl}/p/briefing/print/${briefingId}?t=${encodeURIComponent(printToken)}`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } catch (e) {
    if (e instanceof ChromiumPdfError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new ChromiumPdfError(msg);
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

// ─── Nome do arquivo ─────────────────────────────────────────────────────
/** briefing-{cliente|titulo}-{yyyy-mm-dd}.pdf (slug ascii-safe). */
function nomeArquivo(b: { clienteNome: string | null; titulo: string; respondidoEm: Date | null }): string {
  const base = b.clienteNome?.trim() || b.titulo?.trim() || "briefing";
  const data = (b.respondidoEm ?? new Date()).toISOString().slice(0, 10);
  return `briefing-${slug(base)}-${data}.pdf`;
}

/** Normaliza pra slug seguro em header (sem acento, espaços → '-'). */
function slug(s: string): string {
  return (
    s
      .normalize("NFD")
      // Remove marcas de acento (combining diacritics U+0300–U+036F).
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "briefing"
  );
}
