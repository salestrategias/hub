import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Erro de API com status HTTP explícito. Lance de dentro de um handler
 * embrulhado em `apiHandler` pra responder com o status certo (401 de
 * sessão expirada, 403 de permissão, 404, 429 de rate limit...) em vez
 * do 500 genérico.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Wrapper padrão para handlers de API com tratamento de erro consistente */
export function apiHandler<T>(
  fn: () => Promise<T>
): Promise<NextResponse> {
  return fn()
    .then((data) => NextResponse.json(data ?? { ok: true }))
    .catch((err: unknown) => {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validação falhou", issues: err.issues },
          { status: 400 }
        );
      }
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      const status = msg.includes("Não autenticado") ? 401 : 500;
      console.error("[API ERROR]", msg);
      return NextResponse.json({ error: msg }, { status });
    });
}

export async function requireAuth() {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  return session.user;
}

/**
 * Sessão + papel ADMIN obrigatórios. Use em áreas sensíveis (financeiro,
 * admin). Responde 403 via ApiError — não o 500 genérico.
 */
export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new ApiError(403, "Apenas administradores acessam esta área");
  }
  return user;
}
