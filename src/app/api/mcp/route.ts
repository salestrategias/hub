import { verifyMcpToken } from "@/lib/mcp/auth";
import { handleMcpMessage } from "@/lib/mcp/handler";
import { JSON_RPC_ERRORS } from "@/lib/mcp/types";
import type { JsonRpcRequest, JsonRpcResponse } from "@/lib/mcp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  // Endpoint informativo — útil para testar conectividade no browser
  return Response.json(
    {
      name: "SAL Hub MCP Server",
      version: "1.0.0",
      protocol: "Model Context Protocol",
      transport: "Streamable HTTP",
      docs: "Envie mensagens JSON-RPC 2.0 via POST com header Authorization: Bearer <token>",
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: Request) {
  // 1. Auth
  const ctx = await verifyMcpToken(req.headers.get("authorization"));
  if (!ctx) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: JSON_RPC_ERRORS.UNAUTHORIZED, message: "Token MCP inválido ou ausente" } },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: JSON_RPC_ERRORS.PARSE, message: "JSON inválido" } },
      { status: 400, headers: CORS_HEADERS }
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
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const payload = Array.isArray(body) ? responses : responses[0];
  return Response.json(payload, { headers: CORS_HEADERS });
}
