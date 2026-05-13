/**
 * OAuth Authorization Server Metadata (RFC 8414).
 *
 * `force-dynamic` + leitura via x-forwarded-host (Cloudflare proxy
 * passa req.url como http://localhost:3000 pro Next).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl(req: Request): string {
  const fwdHost = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto") ?? "https";
  if (fwdHost) return `${fwdProto}://${fwdHost}`;
  const host = req.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.salestrategias.com.br";
}

export async function GET(req: Request) {
  const baseUrl = getBaseUrl(req);
  return Response.json(
    {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
