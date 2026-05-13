"use server";
/**
 * Server actions do fluxo OAuth — aprovar e negar consent.
 *
 * Aprovar:
 *  1. Valida session (user logado)
 *  2. Gera code aleatório de 32 bytes
 *  3. Persiste OAuthCode com PKCE challenge + redirect_uri (5 min de validade)
 *  4. Redireciona pro redirect_uri com code + state
 *
 * Negar:
 *  - Redireciona pro redirect_uri com error=access_denied + state
 */
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";

export async function aprovarOAuth(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Sessão inválida — faça login");
  }

  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const state = String(formData.get("state") ?? "");
  const scope = String(formData.get("scope") ?? "mcp");

  if (!clientId || !redirectUri || !codeChallenge) {
    throw new Error("Parâmetros OAuth ausentes");
  }

  // Gera authorization code single-use, validade 5min
  const code = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + 5 * 60_000);

  await prisma.oAuthCode.create({
    data: {
      code,
      userId: session.user.id,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: "S256",
      scope: scope || null,
      expiraEm,
      usado: false,
    },
  });

  // Monta redirect com code + state
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

export async function negarOAuth(formData: FormData) {
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  if (!redirectUri) {
    redirect("/");
  }
  const url = new URL(redirectUri);
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("error_description", "User cancelou a autorização");
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}
