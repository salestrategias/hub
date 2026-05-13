/**
 * OAuth Token Endpoint (RFC 6749 §3.2 + RFC 7636 PKCE).
 *
 * Troca authorization_code por access_token. O access_token retornado
 * é um McpToken real (persistido no banco), pronto pra usar com o
 * endpoint /api/mcp.
 *
 * Validações:
 *  - grant_type = "authorization_code"
 *  - code existe, não expirado, não usado, bate com client_id e redirect_uri
 *  - PKCE: SHA256(code_verifier) base64url-encoded == codeChallenge salvo
 *
 * Após sucesso:
 *  - Marca code como usado (single-use)
 *  - Cria McpToken associado ao user que aprovou
 *  - Retorna access_token + metadata
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createHash, randomBytes } from "node:crypto";

export const runtime = "nodejs";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    // Body pode vir como form-urlencoded (padrão OAuth) ou JSON
    const ct = req.headers.get("content-type") ?? "";
    let body: Record<string, string> = {};
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } else if (ct.includes("application/json")) {
      body = await req.json();
    } else {
      // Fallback: tenta como form
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    }

    const grantType = body.grant_type;
    if (grantType !== "authorization_code") {
      throw new Error("unsupported_grant_type: só authorization_code");
    }

    const { code, redirect_uri, client_id, code_verifier } = body;
    if (!code || !redirect_uri || !client_id || !code_verifier) {
      throw new Error("invalid_request: code, redirect_uri, client_id e code_verifier obrigatórios");
    }

    // Busca o code
    const oauthCode = await prisma.oAuthCode.findUnique({
      where: { code },
      include: { /* nada */ },
    });

    if (!oauthCode) throw new Error("invalid_grant: code não encontrado");
    if (oauthCode.usado) throw new Error("invalid_grant: code já foi usado");
    if (oauthCode.expiraEm < new Date()) throw new Error("invalid_grant: code expirado");
    if (oauthCode.clientId !== client_id) throw new Error("invalid_grant: client_id não bate");
    if (oauthCode.redirectUri !== redirect_uri) throw new Error("invalid_grant: redirect_uri não bate");

    // Valida PKCE: SHA256(verifier) base64url == challenge
    const computedChallenge = createHash("sha256")
      .update(code_verifier)
      .digest("base64url");
    if (computedChallenge !== oauthCode.codeChallenge) {
      throw new Error("invalid_grant: PKCE verifier não bate com challenge");
    }

    // Marca code como usado
    await prisma.oAuthCode.update({
      where: { code },
      data: { usado: true },
    });

    // Gera McpToken (= access_token) — equivalente a criar um PAT via /admin/mcp
    // Token bruto = "salhub_" + 48 hex chars. Banco guarda apenas o SHA-256.
    const rawToken = `salhub_${randomBytes(24).toString("hex")}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const prefixo = rawToken.slice(0, 16);

    await prisma.mcpToken.create({
      data: {
        nome: `Claude Desktop (OAuth ${new Date().toISOString().slice(0, 10)})`,
        hash: tokenHash,
        prefixo,
        escopos: ["*"], // escopo total — futuro: receber scope do consent
      },
    });

    return {
      access_token: rawToken,
      token_type: "Bearer",
      // Sem refresh token nem expiration — token é permanente até user revogar
      // no /admin/mcp (mesma UX dos tokens manuais)
      scope: oauthCode.scope ?? "mcp",
    };
  }).then((res) => {
    // Adiciona CORS headers à resposta do apiHandler
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders())) {
      headers.set(k, v);
    }
    return new Response(res.body, { status: res.status, headers });
  });
}
