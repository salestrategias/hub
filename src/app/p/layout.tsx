/**
 * Layout do segmento PÚBLICO (`/p/*`).
 *
 * NÃO usa Sidebar, Header, ou qualquer chrome do app — é a página que
 * o cliente vê quando recebe um link compartilhado. Independente da
 * sessão (não requer login).
 *
 * Herda o root layout (fonts + ThemeProvider + Providers).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
