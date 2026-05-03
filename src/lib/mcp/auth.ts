import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import type { McpContext } from "./types";

const TOKEN_PREFIX = "salhub_";

/** Gera token cru no formato "salhub_xxxxxxxx..." (32 chars hex) */
export function generateMcpToken(): { token: string; hash: string; prefixo: string } {
  const random = crypto.randomBytes(24).toString("hex"); // 48 chars
  const token = `${TOKEN_PREFIX}${random}`;
  const hash = sha256(token);
  const prefixo = token.slice(0, 16); // "salhub_xxxxxxxx"
  return { token, hash, prefixo };
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Valida um Bearer token e retorna o contexto. Retorna null se inválido/revogado/expirado.
 * Atualiza ultimoUso e totalChamadas em background (sem await crítico).
 */
export async function verifyMcpToken(authHeader: string | null): Promise<McpContext | null> {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw.startsWith(TOKEN_PREFIX)) return null;

  const hash = sha256(raw);
  const tk = await prisma.mcpToken.findUnique({ where: { hash } });
  if (!tk) return null;
  if (tk.revogadoEm) return null;
  if (tk.expiraEm && tk.expiraEm < new Date()) return null;

  // Atualização não-bloqueante de uso
  prisma.mcpToken
    .update({
      where: { id: tk.id },
      data: { ultimoUso: new Date(), totalChamadas: { increment: 1 } },
    })
    .catch(() => { /* silencioso */ });

  return { tokenId: tk.id, tokenNome: tk.nome, scopes: tk.escopos };
}
