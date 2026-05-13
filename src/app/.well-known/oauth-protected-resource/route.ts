/**
 * OAuth Protected Resource Metadata (RFC 9728).
 *
 * Sinaliza ao Claude Desktop: "este recurso (/api/mcp) é protegido,
 * use OAuth 2.1 contra ESTE servidor (apontado em authorization_servers)
 * para obter access_token."
 */
export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET(req: Request) {
  const baseUrl = new URL(req.url).origin;
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
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
