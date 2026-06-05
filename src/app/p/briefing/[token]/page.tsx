import { prisma } from "@/lib/db";
import { normalizarPerguntas } from "@/lib/briefing";
import { BriefingPublico } from "@/components/briefing-publico";

export const dynamic = "force-dynamic";

/**
 * Página PÚBLICA de preenchimento do briefing (link compartilhado).
 *
 * - Carrega o Briefing pelo shareToken (não exige login — o token é o acesso).
 * - Respeita shareExpiraEm (mensagem amigável se expirado/inexistente).
 * - Renderiza o formulário (client) com as perguntas normalizadas; pré-preenche
 *   com `respostas` se o cliente já tiver respondido (permite revisar/reenviar).
 *
 * Herda o layout /p (sem sidebar/header do app). Assume tema claro como o resto
 * do /p. Mobile-first (safe-area no topo pra notch).
 */
export default async function BriefingPublicoPage({ params }: { params: { token: string } }) {
  const briefing = await prisma.briefing.findUnique({
    where: { shareToken: params.token },
    select: {
      id: true,
      titulo: true,
      perguntas: true,
      respostas: true,
      clienteNome: true,
      status: true,
      shareExpiraEm: true,
      respondidoEm: true,
    },
  });

  const expirado = !!briefing?.shareExpiraEm && briefing.shareExpiraEm < new Date();

  if (!briefing || expirado) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 safe-area-inset-top">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-display text-xl font-semibold">
            {expirado ? "Este link expirou" : "Briefing não encontrado"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {expirado
              ? "O preenchimento deste briefing não está mais disponível."
              : "O link pode ter sido revogado ou está incorreto."}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Se você acha que isso é um erro, fale com quem enviou o link.
          </p>
        </div>
      </div>
    );
  }

  const perguntas = normalizarPerguntas(briefing.perguntas);
  const respostas =
    briefing.respostas && typeof briefing.respostas === "object" && !Array.isArray(briefing.respostas)
      ? (briefing.respostas as Record<string, string | string[]>)
      : null;

  return (
    <BriefingPublico
      token={params.token}
      titulo={briefing.titulo}
      clienteNome={briefing.clienteNome}
      perguntas={perguntas}
      respostasIniciais={respostas}
      jaRespondido={briefing.status === "RESPONDIDO"}
      respondidoEm={briefing.respondidoEm?.toISOString() ?? null}
    />
  );
}
