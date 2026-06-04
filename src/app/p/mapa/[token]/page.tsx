import Link from "next/link";
import { prisma } from "@/lib/db";
import { MindMapCanvas } from "@/components/mind-map-canvas";

export const dynamic = "force-dynamic";

/**
 * Página PÚBLICA do mapa mental (link compartilhado).
 *
 * - Carrega o MindMap pelo shareToken (não exige login — o token é o acesso).
 * - Respeita shareExpiraEm (mostra mensagem amigável se expirado/inexistente).
 * - Incrementa shareViews (fire-and-forget).
 * - Renderiza o canvas em modo READ-ONLY (sem ferramentas/edição/auto-save).
 *
 * Herda o layout /p (sem sidebar/header do app).
 */
export default async function MapaPublicoPage({ params }: { params: { token: string } }) {
  const mapa = await prisma.mindMap.findUnique({
    where: { shareToken: params.token },
    select: { id: true, titulo: true, descricao: true, data: true, shareExpiraEm: true },
  });

  const expirado = !!mapa?.shareExpiraEm && mapa.shareExpiraEm < new Date();

  if (!mapa || expirado) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-display text-xl font-semibold">
            {expirado ? "Este link expirou" : "Mapa não encontrado"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {expirado
              ? "O compartilhamento deste mapa não está mais disponível."
              : "O link pode ter sido revogado ou está incorreto."}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Se você acha que isso é um erro, fale com quem enviou o link.
          </p>
        </div>
      </div>
    );
  }

  // Registra a visualização sem bloquear o render.
  void prisma.mindMap
    .update({ where: { id: mapa.id }, data: { shareViews: { increment: 1 } } })
    .catch(() => undefined);

  const data = (mapa.data as { nodes?: unknown[]; edges?: unknown[] }) ?? {};

  return (
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-4">
      <div className="flex-1 min-h-0">
        <MindMapCanvas
          id={mapa.id}
          titulo={mapa.titulo}
          descricao={mapa.descricao}
          data={{ nodes: data.nodes ?? [], edges: data.edges ?? [] }}
          readOnly
        />
      </div>
      <footer className="pt-3 text-center text-[11px] text-muted-foreground/60">
        <Link href="/" className="hover:text-foreground transition-colors">
          Mapa compartilhado via <span className="font-semibold">SAL</span>
        </Link>
      </footer>
    </main>
  );
}
