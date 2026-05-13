/**
 * OAuth Protected Resource Metadata (RFC 9728).
 *
 * Claude Desktop (e outros clientes MCP modernos) faz discovery aqui
 * antes de conectar. Como o SAL Hub MCP usa Bearer estático (PAT) e
 * NÃO tem authorization server OAuth próprio, retornamos um descriptor
 * mínimo que sinaliza "use Bearer token direto, sem flow OAuth".
 *
 * Anthropic doc: clientes que veem `authorization_servers: []` ou
 * ausência de OAuth metadata caem no fallback de Bearer estático.
 */
export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET(req: Request) {
  const baseUrl = new URL(req.url).origin;
  return Response.json(
    {
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [], // sem OAuth — Bearer estático
      bearer_methods_supported: ["header"],
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
