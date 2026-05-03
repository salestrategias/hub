import { ZodError } from "zod";
import { canCallTool, listToolsForScopes, toolRegistry } from "./tools";
import { JSON_RPC_ERRORS, type JsonRpcRequest, type JsonRpcResponse, type McpContext } from "./types";

const SERVER_INFO = {
  name: "sal-hub",
  version: "1.0.0",
};

const SERVER_INSTRUCTIONS = `Você está conectado ao SAL Hub — sistema de gestão da SAL Estratégias de Marketing.

Você tem acesso completo a leitura e escrita em:
- Clientes (CRM com tags)
- Reuniões (transcrições, action items, capítulos)
- Notas (markdown com wikilinks e tags)
- Tarefas (com prioridade e prazos)
- Posts editoriais (sincronizam com Google Calendar quando AGENDADOS)
- Projetos (Kanban Briefing→Entregue)
- Contratos (com aviso de vencimento)
- Financeiro (lançamentos PJ/PF, métricas, MRR)

Diretrizes:
- Sempre confirme antes de excluir registros (cliente_excluir, nota_excluir, etc.).
- Para ações financeiras, valide entidade (PJ/PF) e tipo (RECEITA/DESPESA).
- Datas devem estar em formato ISO (yyyy-mm-dd ou yyyy-mm-ddThh:mm).
- Use buscar_tudo para localizar entidades antes de operar quando o usuário falar por nome.
- Para resumir reuniões, use reuniao_buscar (traz a transcrição completa) e depois reuniao_atualizar com o campo resumoIA + reuniao_adicionar_action para extrair tarefas.`;

function rpcError(id: JsonRpcRequest["id"], code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

function rpcOk(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

/**
 * Processa uma mensagem JSON-RPC do MCP. Notificações (sem id) retornam null.
 */
export async function handleMcpMessage(
  message: JsonRpcRequest,
  ctx: McpContext
): Promise<JsonRpcResponse | null> {
  if (message.jsonrpc !== "2.0") {
    return rpcError(message.id, JSON_RPC_ERRORS.INVALID_REQUEST, "JSON-RPC version inválida");
  }

  const isNotification = message.id === undefined;

  try {
    switch (message.method) {
      case "initialize": {
        const params = message.params as { protocolVersion?: string; clientInfo?: unknown } | undefined;
        return rpcOk(message.id, {
          protocolVersion: params?.protocolVersion ?? "2025-06-18",
          serverInfo: SERVER_INFO,
          capabilities: { tools: { listChanged: false } },
          instructions: SERVER_INSTRUCTIONS,
        });
      }

      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/progress":
        return null; // notification, no response

      case "ping":
        return rpcOk(message.id, {});

      case "tools/list":
        return rpcOk(message.id, { tools: listToolsForScopes(ctx.scopes) });

      case "tools/call": {
        const params = message.params as { name?: string; arguments?: unknown } | undefined;
        const name = params?.name;
        if (!name) {
          return rpcError(message.id, JSON_RPC_ERRORS.INVALID_PARAMS, "Nome da tool ausente");
        }
        const tool = toolRegistry.get(name);
        if (!tool) {
          return rpcError(message.id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Tool desconhecida: ${name}`);
        }
        // Checagem de escopo
        const perm = canCallTool(ctx.scopes, name);
        if (!perm.allowed) {
          return rpcOk(message.id, {
            content: [{
              type: "text",
              text: `Permissão negada para ${name}. Este token requer um dos escopos: ${perm.required.join(", ")}. Escopos atuais: ${ctx.scopes.length ? ctx.scopes.join(", ") : "(nenhum)"}.`,
            }],
            isError: true,
          });
        }
        try {
          const parsed = tool.inputSchema.parse(params?.arguments ?? {});
          const result = await tool.handler(parsed, ctx);
          return rpcOk(message.id, result);
        } catch (e) {
          if (e instanceof ZodError) {
            return rpcOk(message.id, {
              content: [{ type: "text", text: `Argumentos inválidos para ${name}:\n${JSON.stringify(e.issues, null, 2)}` }],
              isError: true,
            });
          }
          const msg = e instanceof Error ? e.message : String(e);
          return rpcOk(message.id, {
            content: [{ type: "text", text: `Erro executando ${name}: ${msg}` }],
            isError: true,
          });
        }
      }

      // Resources e prompts: não implementados ainda
      case "resources/list":
        return rpcOk(message.id, { resources: [] });
      case "prompts/list":
        return rpcOk(message.id, { prompts: [] });

      default:
        if (isNotification) return null;
        return rpcError(message.id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Método ${message.method} não suportado`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return rpcError(message.id, JSON_RPC_ERRORS.INTERNAL, msg);
  }
}
