import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

/**
 * Retorna um OAuth2 client do googleapis com tokens do usuário logado,
 * fazendo refresh automático e persistindo o novo access_token no banco.
 */
export async function getGoogleClient() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiresAt: true,
    },
  });

  if (!user?.googleAccessToken) {
    throw new Error("Conta Google não conectada. Faça login com Google primeiro.");
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken ?? undefined,
    expiry_date: user.googleTokenExpiresAt?.getTime() ?? undefined,
  });

  // Atualiza o banco quando o token é renovado
  oauth2.on("tokens", (tokens) => {
    prisma.user
      .update({
        where: { id: user.id },
        data: {
          googleAccessToken: tokens.access_token ?? user.googleAccessToken,
          googleTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
        },
      })
      .catch(() => {/* silencioso para não quebrar a request */});
  });

  return oauth2;
}
