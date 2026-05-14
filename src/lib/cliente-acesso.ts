/**
 * Helpers do Portal do Cliente.
 *
 * Modelo de sessão: cookie HTTP-only assinado com NEXTAUTH_SECRET
 * (mesmo segredo que NextAuth) contendo `{ tokenAcesso, expira }`.
 * Validade 7 dias. Se cookie inválido, força revalidação de senha.
 *
 * Por que não usar NextAuth direto: NextAuth aqui é só pra users
 * INTERNOS da SAL. Cliente é um "guest" identificado por token, sem
 * conta. Cookie próprio mantém o caminho separado e simples.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { ClienteAcesso, Cliente } from "@prisma/client";

const COOKIE_NAME = "sal-cliente-sessao";
const COOKIE_MAX_AGE_DIAS = 7;

function segredo(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET não configurado");
  return s;
}

/**
 * Gera cookie de sessão (HMAC-SHA256). Formato:
 *   <base64(payload)>.<base64(hmac)>
 */
export function gerarCookieSessao(tokenAcesso: string): { value: string; maxAge: number } {
  const expira = Date.now() + COOKIE_MAX_AGE_DIAS * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ tokenAcesso, expira });
  const b64Payload = Buffer.from(payload).toString("base64url");
  const hmac = createHmac("sha256", segredo()).update(b64Payload).digest("base64url");
  return {
    value: `${b64Payload}.${hmac}`,
    maxAge: COOKIE_MAX_AGE_DIAS * 24 * 60 * 60,
  };
}

/**
 * Valida cookie de sessão. Retorna tokenAcesso se válido + não expirado.
 */
export function validarCookieSessao(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null;
  const [b64Payload, hmacEsperado] = cookieValue.split(".");
  if (!b64Payload || !hmacEsperado) return null;

  // Valida HMAC (timing-safe)
  const hmacCalculado = createHmac("sha256", segredo()).update(b64Payload).digest("base64url");
  const a = Buffer.from(hmacCalculado);
  const b = Buffer.from(hmacEsperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
    if (typeof payload.tokenAcesso !== "string") return null;
    if (typeof payload.expira !== "number") return null;
    if (payload.expira < Date.now()) return null;
    return payload.tokenAcesso;
  } catch {
    return null;
  }
}

export const COOKIE_PORTAL_CLIENTE = COOKIE_NAME;

/**
 * Busca o acesso + cliente por token. Retorna null se inválido/inativo.
 * NÃO valida senha — caller faz isso quando relevante.
 */
export async function getAcessoPorToken(
  token: string
): Promise<{ acesso: ClienteAcesso; cliente: Cliente } | null> {
  const acesso = await prisma.clienteAcesso.findUnique({
    where: { token },
    include: { cliente: true },
  });
  if (!acesso || !acesso.ativo) return null;
  return { acesso, cliente: acesso.cliente };
}

/**
 * Valida senha contra hash bcrypt. Retorna true se OK ou se acesso
 * não tem senha (acesso público sem senha).
 */
export async function validarSenha(
  acesso: ClienteAcesso,
  senhaProvida: string | null
): Promise<boolean> {
  if (!acesso.senhaHash) return true; // sem senha — qualquer um acessa
  if (!senhaProvida) return false;
  return bcrypt.compare(senhaProvida, acesso.senhaHash);
}

/**
 * Valida sessão completa: cookie + token bate + acesso ativo.
 * Use em todos os endpoints internos /api/p/cliente/[token]/X.
 */
export async function requerSessaoCliente(
  token: string,
  cookieValue: string | null | undefined
): Promise<{ acesso: ClienteAcesso; cliente: Cliente }> {
  const tokenSessao = validarCookieSessao(cookieValue);
  if (tokenSessao !== token) throw new Error("Sessão inválida — faça login");
  const r = await getAcessoPorToken(token);
  if (!r) throw new Error("Acesso desativado");
  return r;
}

/**
 * Registra acesso (incrementa contador + atualiza ultimoAcesso).
 * Fire-and-forget — não bloqueia caller.
 */
export function registrarAcesso(acessoId: string): void {
  void prisma.clienteAcesso
    .update({
      where: { id: acessoId },
      data: {
        ultimoAcesso: new Date(),
        totalAcessos: { increment: 1 },
      },
    })
    .catch((err) => console.error("[cliente-acesso] erro ao registrar acesso:", err));
}
