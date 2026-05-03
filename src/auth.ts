import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { ipFromHeaders, logActivity } from "@/lib/activity-log";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "ADMIN" | "MEMBER" } & DefaultSession["user"];
  }
}

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credenciais",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        // Capturar headers para logging (no escopo de authorize ainda há contexto de request)
        let ip: string | null = null;
        let ua: string | null = null;
        try {
          const h = await headers();
          ip = ipFromHeaders(h);
          ua = h.get("user-agent");
        } catch { /* sem contexto de request */ }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          logActivity({ userId: user.id, tipo: "LOGIN_FALHOU", ip, userAgent: ua, meta: { provider: "credentials" } });
          return null;
        }

        logActivity({ userId: user.id, tipo: "LOGIN_OK", ip, userAgent: ua, meta: { provider: "credentials" } });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Persistir tokens Google no User para refresh posterior
      if (account?.provider === "google" && user?.email) {
        const updated = await prisma.user.update({
          where: { email: user.email },
          data: {
            googleAccessToken: account.access_token ?? null,
            googleRefreshToken: account.refresh_token ?? undefined, // não sobrescreve com null
            googleTokenExpiresAt: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
            googleScope: account.scope ?? null,
          },
          select: { id: true },
        });
        let ip: string | null = null;
        let ua: string | null = null;
        try {
          const h = await headers();
          ip = ipFromHeaders(h);
          ua = h.get("user-agent");
        } catch { /* sem contexto */ }
        logActivity({ userId: updated.id, tipo: "LOGIN_OK", ip, userAgent: ua, meta: { provider: "google" } });
        logActivity({ userId: updated.id, tipo: "GOOGLE_CONECTADO", ip, userAgent: ua });
      }
      return true;
    },
    async jwt({ token, user, trigger, session: triggerSession }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: "ADMIN" | "MEMBER" }).role ?? "MEMBER";
        token.name = (user as { name?: string | null }).name ?? null;
        token.picture = (user as { image?: string | null }).image ?? null;
      }
      // useSession().update({...}) propaga campos passados aqui
      if (trigger === "update" && triggerSession) {
        const s = triggerSession as { name?: string | null; image?: string | null };
        if (s.name !== undefined) token.name = s.name;
        if (s.image !== undefined) token.picture = s.image;
      }
      // Em cada request com token: re-lê do banco se faltar campos cruciais (defesa em profundidade)
      if (token.id && (!token.name || token.picture === undefined)) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, image: true, role: true },
        });
        if (fresh) {
          token.name = fresh.name;
          token.picture = fresh.image;
          token.role = fresh.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "ADMIN" | "MEMBER") ?? "MEMBER";
        session.user.name = (token.name as string | null) ?? session.user.name;
        session.user.image = (token.picture as string | null) ?? session.user.image;
      }
      return session;
    },
  },
});
