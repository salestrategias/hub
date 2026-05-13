/**
 * OAuth Authorization Server Metadata (RFC 8414).
 *
 * O SAL Hub age como Authorization Server pro fluxo OAuth do Claude Desktop.
 * Implementação mínima compatível: Authorization Code Flow + PKCE + DCR.
 *
 * Claude Desktop usa esses endpoints automaticamente após o Discovery.
 */
export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET(req: Request) {
  const baseUrl = new URL(req.url).origin;
  return Response.json(
    {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"], // public client (Claude Desktop não tem secret)
      scopes_supported: ["mcp"],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
