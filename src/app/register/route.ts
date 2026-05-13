/**
 * Dynamic Client Registration (RFC 7591) — endpoint público.
 *
 * Claude Desktop chama aqui no início pra "registrar" como cliente
 * OAuth. Como confiamos no fluxo (qualquer Claude pode tentar, no
 * fim do dia o user precisa logar e aprovar consent), retornamos
 * client_id genérico sem persistir nada.
 *
 * Spec: https://datatracker.ietf.org/doc/html/rfc7591
 */
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body opcional; alguns clientes mandam vazio
  }

  // Gera client_id "dinâmico" — não persistimos. Apenas validamos no
  // /authorize que o redirect_uri bate com algum claude.ai/* ou localhost.
  const clientId = `mcp_client_${randomBytes(12).toString("hex")}`;

  return Response.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      // Public client (sem secret) — PKCE garante segurança
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      // Reflete o que veio no body (informativo)
      client_name: body.client_name ?? "MCP Client",
      redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
