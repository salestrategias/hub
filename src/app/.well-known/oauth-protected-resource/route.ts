/**
 * OAuth Protected Resource Metadata (RFC 9728).
 *
 * IMPORTANTE: `force-dynamic` + leitura via x-forwarded-host porque
 * o Cloudflare proxy passa req.url como http://localhost:3000 pro
 * Next, e força-static congelaria a URL errada no build.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl(req: Request): string {
  // Cloudflare/Traefik/nginx mandam host real em x-forwarded-host
  const fwdHost = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto") ?? "https";
  if (fwdHost) return `${fwdProto}://${fwdHost}`;
  // Fallback: header host normal
  const host = req.headers.get("host");
  if (host) {
    const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    return `${proto}://${host}`;
  }
  // Último recurso: env var
  return process.env.NEXT_PUBLIC_HUB_URL ?? "https://hub.salestrategias.com.br";
}

export async function GET(req: Request) {
  const baseUrl = getBaseUrl(req);
  return Response.json(
    {
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
      resource_documentation: `${baseUrl}/admin/mcp`,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
