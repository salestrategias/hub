import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
