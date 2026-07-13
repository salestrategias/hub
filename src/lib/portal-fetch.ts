"use client";
/**
 * Fetch do Portal do Cliente com tratamento central de sessão expirada.
 *
 * Toda aba do portal busca dados com `fetchPortal`. Quando o backend
 * responde 401 (sessão de 7 dias venceu), dispara o evento
 * `portal:sessao-expirada` — a casca (<PortalCliente>) escuta e volta pra
 * tela de entrada em vez de deixar as abas renderizarem "lista vazia"
 * silenciosamente (o bug antigo).
 */
export const EVENTO_SESSAO_EXPIRADA = "portal:sessao-expirada";

export async function fetchPortal(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA));
  }
  return res;
}
