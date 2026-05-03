/**
 * Tipos minimalistas para Model Context Protocol (MCP) sobre HTTP/JSON-RPC 2.0.
 * Documentação: https://modelcontextprotocol.io
 */
import type { z } from "zod";

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

export const JSON_RPC_ERRORS = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
  // App-specific (range -32000 a -32099)
  UNAUTHORIZED: -32001,
  TOOL_ERROR: -32002,
} as const;

export type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export type ToolResult = {
  content: ToolContent[];
  isError?: boolean;
};

export type ToolDefinition<TInput = unknown> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  /** JSON Schema gerado a partir do zod, para retornar no tools/list */
  jsonSchema: Record<string, unknown>;
  /** Escopos requeridos. Se vazio, tool é pública. Token precisa ter pelo menos um. */
  requiredScopes: readonly string[];
  handler: (input: TInput, ctx: McpContext) => Promise<ToolResult>;
};

export type McpContext = {
  tokenId: string;
  tokenNome: string;
  scopes: string[];
};
