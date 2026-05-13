/**
 * OAuth Authorization Server Metadata (RFC 8414).
 *
 * SAL Hub MCP NÃO tem authorization server (usa Bearer estático).
 * Retornamos 404 explícito pra Claude Desktop saber que não há OAuth
 * e cair no fallback de Bearer.
 */
export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return new Response(
    JSON.stringify({
      error: "no_authorization_server",
      error_description: "Este recurso usa Bearer token estático (PAT). Sem OAuth.",
    }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
