/**
 * Tela de consent OAuth — onde o user aprova/nega o connector MCP.
 *
 * Fluxo:
 *  1. Claude Desktop redireciona pra cá com query params
 *     (response_type, client_id, redirect_uri, code_challenge, state, etc)
 *  2. Se user não logado, middleware redireciona pra /login com callback
 *  3. User logado vê esta tela com "Autorizar Claude" / "Cancelar"
 *  4. Approve → POST /authorize/aprovar (server action) → gera code → redirect Claude
 *  5. Deny → redirect Claude com error=access_denied
 *
 * Restrição: redirect_uri DEVE bater com domain claude.ai/* ou
 * localhost (segurança contra phishing).
 */
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { aprovarOAuth, negarOAuth } from "./actions";

const REDIRECT_URIS_PERMITIDOS = [
  /^https:\/\/claude\.ai\//,
  /^https:\/\/claude\.com\//,
  /^http:\/\/localhost(:\d+)?\//,
  /^http:\/\/127\.0\.0\.1(:\d+)?\//,
];

function redirectUriValido(uri: string): boolean {
  try {
    const url = new URL(uri);
    return REDIRECT_URIS_PERMITIDOS.some((re) => re.test(url.origin + "/"));
  } catch {
    return false;
  }
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: { [k: string]: string | undefined };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    // Middleware deveria ter redirecionado, mas double-check
    const callbackUrl = encodeURIComponent(
      `/authorize?${new URLSearchParams(searchParams as Record<string, string>).toString()}`
    );
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  const {
    response_type,
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    state,
    scope,
  } = searchParams;

  // Validações
  if (response_type !== "code") {
    return <ErroOAuth motivo="response_type inválido — só 'code' suportado" />;
  }
  if (!client_id || !redirect_uri || !code_challenge) {
    return <ErroOAuth motivo="Parâmetros obrigatórios faltando (client_id, redirect_uri, code_challenge)" />;
  }
  if (code_challenge_method !== "S256") {
    return <ErroOAuth motivo="code_challenge_method deve ser S256" />;
  }
  if (!redirectUriValido(redirect_uri)) {
    return <ErroOAuth motivo={`redirect_uri não permitido: ${redirect_uri}. Apenas claude.ai/claude.com/localhost.`} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-xl border border-border bg-card shadow-xl p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
          >
            <span className="text-white text-2xl">🔌</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight">
              Conectar Claude ao SAL Hub
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Logado como <strong>{session.user.email ?? session.user.name}</strong>
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm space-y-2">
          <p className="font-medium">O Claude vai poder:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Ler e criar clientes, leads, tarefas e projetos</li>
            <li>Acessar reuniões, notas e calendário editorial</li>
            <li>Consultar dados financeiros e contratos</li>
            <li>Buscar em todos os módulos</li>
          </ul>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-500">
          ⚠️ Só aprove se você está conectando o seu Claude Desktop pessoal.
          Você pode revogar o acesso a qualquer momento em <code className="font-mono">/admin/mcp</code>.
        </div>

        <form className="flex gap-2 pt-1">
          <input type="hidden" name="client_id" value={client_id} />
          <input type="hidden" name="redirect_uri" value={redirect_uri} />
          <input type="hidden" name="code_challenge" value={code_challenge} />
          <input type="hidden" name="state" value={state ?? ""} />
          <input type="hidden" name="scope" value={scope ?? ""} />
          <button
            formAction={negarOAuth}
            className="flex-1 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary/60 transition"
          >
            Cancelar
          </button>
          <button
            formAction={aprovarOAuth}
            className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
          >
            Autorizar Claude
          </button>
        </form>
      </div>
    </div>
  );
}

function ErroOAuth({ motivo }: { motivo: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/5 p-7 space-y-3">
        <h1 className="font-display text-xl font-semibold text-destructive">Solicitação OAuth inválida</h1>
        <p className="text-sm text-muted-foreground">{motivo}</p>
        <p className="text-xs text-muted-foreground/70">
          Se isso aconteceu enquanto você conectava o Claude Desktop, talvez o app esteja desatualizado
          ou tentando um fluxo não suportado.
        </p>
      </div>
    </div>
  );
}
