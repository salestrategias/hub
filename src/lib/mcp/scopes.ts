/**
 * Catálogo de escopos do MCP.
 *
 * Convenção: <recurso>:<acao> onde acao ∈ {read, write}.
 * "write" implica capacidade de criar/atualizar/excluir nesse recurso.
 * O wildcard "*" concede acesso total.
 *
 * Token sem escopos (`escopos: []`) é tratado como wildcard por compatibilidade
 * com tokens criados antes da feature.
 */

export const ALL_SCOPES = [
  "clientes:read",
  "clientes:write",
  "reunioes:read",
  "reunioes:write",
  "notas:read",
  "notas:write",
  "tarefas:read",
  "tarefas:write",
  "editorial:read",
  "editorial:write",
  "projetos:read",
  "projetos:write",
  "contratos:read",
  "contratos:write",
  "financeiro:read",
  "financeiro:write",
  "agenda:read",
  "busca:read",
] as const;

export type Scope = typeof ALL_SCOPES[number] | "*";

export const SCOPE_GROUPS: { recurso: string; label: string; read: Scope; write: Scope | null }[] = [
  { recurso: "clientes", label: "Clientes (CRM)", read: "clientes:read", write: "clientes:write" },
  { recurso: "reunioes", label: "Reuniões", read: "reunioes:read", write: "reunioes:write" },
  { recurso: "notas", label: "Notas", read: "notas:read", write: "notas:write" },
  { recurso: "tarefas", label: "Tarefas", read: "tarefas:read", write: "tarefas:write" },
  { recurso: "editorial", label: "Editorial", read: "editorial:read", write: "editorial:write" },
  { recurso: "projetos", label: "Projetos", read: "projetos:read", write: "projetos:write" },
  { recurso: "contratos", label: "Contratos", read: "contratos:read", write: "contratos:write" },
  { recurso: "financeiro", label: "Financeiro", read: "financeiro:read", write: "financeiro:write" },
  { recurso: "agenda", label: "Agenda (somente leitura)", read: "agenda:read", write: null },
  { recurso: "busca", label: "Busca universal", read: "busca:read", write: null },
];

export type ScopePreset = "total" | "leitura" | "sem_financeiro" | "produtividade" | "customizado";

export const PRESETS: Record<Exclude<ScopePreset, "customizado">, { label: string; descricao: string; scopes: Scope[] }> = {
  total: {
    label: "Acesso total",
    descricao: "Token pode usar todas as tools. Equivalente ao escopo *.",
    scopes: ["*"],
  },
  leitura: {
    label: "Somente leitura",
    descricao: "Apenas operações de leitura em todos os módulos. Útil para chats de consulta.",
    scopes: ALL_SCOPES.filter((s) => s.endsWith(":read")),
  },
  sem_financeiro: {
    label: "Sem financeiro",
    descricao: "Tudo exceto tools de Financeiro e Contratos. Ideal para automações operacionais.",
    scopes: ALL_SCOPES.filter((s) => !s.startsWith("financeiro:") && !s.startsWith("contratos:")),
  },
  produtividade: {
    label: "Produtividade (Workspace)",
    descricao: "Acesso a Reuniões, Notas, Tarefas, Editorial e Busca. Sem financeiro, contratos ou clientes.",
    scopes: [
      "reunioes:read", "reunioes:write",
      "notas:read", "notas:write",
      "tarefas:read", "tarefas:write",
      "editorial:read", "editorial:write",
      "agenda:read", "busca:read",
    ],
  },
};

/**
 * Verifica se os escopos do token cobrem pelo menos um dos requeridos pela tool.
 * - Token com escopo `*` (ou `escopos: []` = backward compat): acesso total
 * - Tool sem `requiredScopes` declarado: pública (raro)
 */
export function hasScope(tokenScopes: string[], required: readonly string[]): boolean {
  if (tokenScopes.length === 0) return true; // backward compat
  if (tokenScopes.includes("*")) return true;
  if (required.length === 0) return true;
  return required.some((r) => tokenScopes.includes(r));
}
