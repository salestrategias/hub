// Edge-safe config (sem prisma/bcrypt) para o middleware
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isPublic =
        path.startsWith("/login") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/_next") ||
        path === "/favicon.ico" ||
        // Conteúdo público (cliente acessa via link compartilhado):
        // - /p/* — páginas públicas (proposta, share genérico)
        // - /api/p/* — APIs que servem o conteúdo público
        // - /api/propostas/:id/aceitar e /recusar — autenticadas por token, não sessão
        // - /api/propostas/:id/pdf?token=... — download público do PDF
        // - /api/mcp — endpoint MCP (autenticado via Bearer token, não session)
        path.startsWith("/p/") ||
        path.startsWith("/api/p/") ||
        path === "/api/mcp" ||
        path.startsWith("/api/mcp/") ||
        /^\/api\/propostas\/[^/]+\/(aceitar|recusar)$/.test(path) ||
        (/^\/api\/propostas\/[^/]+\/pdf$/.test(path) && request.nextUrl.searchParams.has("token"));
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
};
