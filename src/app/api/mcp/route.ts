import { verifyMcpToken } from "@/lib/mcp/auth";
import { handleMcpMessage } from "@/lib/mcp/handler";
import { JSON_RPC_ERRORS } from "@/lib/mcp/types";
import type { JsonRpcRequest, JsonRpcResponse } from "@/lib/mcp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CORS deliberadamente PERMISSIVO porque clientes legítimos do MCP
 * (Claude Desktop / Claude Code / scripts servidor a servidor) NÃO enviam
 * o header `Origin` — ou enviam origins arbitrárias específicas do binário.
 *
 * O que protege o endpoint NÃO é a origem; é o Bearer token (validado em verifyMcpToken).
 * Bloquear por origin daria falso ganho de segurança e quebraria clientes válidos.
 *
 * Browser malicioso atacando esse endpoint precisaria do token; sem o token
 * a API retorna 401 antes de ler o body.
 */
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    // Reflete a origin que veio (ou wildcard se não houver) — não compromete segurança
    // pois autorização é por token, não por origin
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  // Endpoint informativo — útil para testar conectividade no browser
  return Response.json(
    {
      name: "SAL Hub MCP Server",
      version: "1.0.0",
      protocol: "Model Context Protocol",
      transport: "Streamable HTTP",
      docs: "Envie mensagens JSON-RPC 2.0 via POST com header Authorization: Bearer <token>",
    },
    { headers: corsHeaders(req) }
  );
}

export async function POST(req: Request) {
  // 1. Auth
  const ctx = await verifyMcpToken(req.headers.get("authorization"));
  if (!ctx) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: JSON_RPC_ERRORS.UNAUTHORIZED, message: "Token MCP inválido ou ausente" } },
      { status: 401, headers: corsHeaders(req) }
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: JSON_RPC_ERRORS.PARSE, message: "JSON inválido" } },
      { status: 400, headers: corsHeaders(req) }
    );
  }

  // 3. Suporte a batch (array de mensagens) — opcional no JSON-RPC 2.0
  const messages: JsonRpcRequest[] = Array.isArray(body) ? body : [body as JsonRpcRequest];

  const responses: JsonRpcResponse[] = [];
  for (const msg of messages) {
    const r = await handleMcpMessage(msg, ctx);
    if (r) responses.push(r);
  }

  // 4. Resposta: objeto único se entrada única, array se batch, 204 se só notificações
  if (responses.length === 0) {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  const payload = Array.isArray(body) ? responses : responses[0];
  return Response.json(payload, { headers: corsHeaders(req) });
}
