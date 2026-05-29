/**
 * Tokens de print pra rota interna /p/proposta/print/[id].
 *
 * Por quê: o gerador de PDF (Chromium headless via puppeteer-core) abre a
 * página de print sem cookie de sessão. Em vez de expor a página internamente
 * sem auth, assinamos um token HMAC efêmero (~2 min) que o Chromium passa via
 * `?t=<token>`. A página aceita OU esse token OU uma sessão NextAuth válida
 * (pro Marcelo pré-visualizar logado no navegador).
 *
 * Formato do token: `<expiraMs>.<hmacBase64url>`, onde hmac = HMAC-SHA256 de
 * `${id}.${expiraMs}` assinado com NEXTAUTH_SECRET (mesmo segredo que o resto
 * do app — ver src/lib/cliente-acesso.ts).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** TTL do token de print. Curto: só precisa viver o tempo do Chromium abrir a página. */
const TTL_MS = 2 * 60 * 1000;

function segredo(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET não configurado");
  return s;
}

function assinar(id: string, expiraMs: number): string {
  return createHmac("sha256", segredo()).update(`${id}.${expiraMs}`).digest("base64url");
}

/** Assina um token de print pra um id de proposta. Válido por ~2 min. */
export function signPrintToken(id: string): string {
  const expiraMs = Date.now() + TTL_MS;
  const hmac = assinar(id, expiraMs);
  return `${expiraMs}.${hmac}`;
}

/**
 * Verifica um token de print contra um id. Retorna true se válido E não
 * expirado. Comparação do HMAC é timing-safe.
 */
export function verifyPrintToken(id: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const [expiraStr, hmacRecebido] = token.split(".");
  if (!expiraStr || !hmacRecebido) return false;

  const expiraMs = Number(expiraStr);
  if (!Number.isFinite(expiraMs) || expiraMs < Date.now()) return false;

  const hmacEsperado = assinar(id, expiraMs);
  const a = Buffer.from(hmacEsperado);
  const b = Buffer.from(hmacRecebido);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
