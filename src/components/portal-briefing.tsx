"use client";
/**
 * Aba "Briefing" do Portal do Cliente.
 *
 * Lista os briefings DESTE cliente (ENVIADO/RESPONDIDO) e deixa ele responder
 * SEM sair do portal: ao clicar "Responder"/"Revisar", carrega as perguntas +
 * respostas anteriores do briefing e EMBUTE o componente <BriefingPublico/>
 * (o mesmo da página pública), que submete pro endpoint público já existente
 * POST /api/p/briefing/{shareToken}.
 *
 * Por que embutir (e não navegar pra /p/briefing/{shareToken}):
 *  - cliente fica dentro do portal (volta com 1 toque, mantém contexto/sessão);
 *  - reusa 100% do formulário e do endpoint de submit que já existiam.
 * O preço é só buscar perguntas/respostas sob demanda — feito por
 * GET /api/p/cliente/{token}/briefings/{briefingId}.
 *
 * Dados da lista: GET /api/p/cliente/{token}/briefings.
 * `onPendenciasMudaram` avisa a casca do portal pra reavaliar badges quando o
 * cliente responde (a contagem de pendentes some na hora).
 *
 * Mobile-first: lista em cards, toque generoso; o form embutido herda o
 * mobile-first do próprio BriefingPublico. Sem <style jsx> — só tokens.
 */
import { useEffect, useState } from "react";
import { ClipboardList, CheckCircle2, ChevronRight, Loader2, ArrowLeft, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { BriefingPublico } from "@/components/briefing-publico";
import type { BriefingPergunta } from "@/lib/briefing";

type BriefingStatus = "ENVIADO" | "RESPONDIDO";

type BriefingItem = {
  id: string;
  titulo: string;
  status: BriefingStatus;
  shareToken: string | null;
  respondidoEm: string | null;
};

type Detalhe = {
  id: string;
  titulo: string;
  shareToken: string;
  status: BriefingStatus;
  respondidoEm: string | null;
  perguntas: BriefingPergunta[];
  respostas: Record<string, string | string[]> | null;
};

export function PortalBriefing({
  token,
  clienteNome,
  onPendenciasMudaram,
}: {
  token: string;
  clienteNome: string;
  /** Avisa a casca que pendências mudaram (cliente respondeu) → rebadge. */
  onPendenciasMudaram?: () => void;
}) {
  const [lista, setLista] = useState<BriefingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Briefing aberto pra responder (form embutido).
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  async function carregarLista() {
    try {
      const res = await fetch(`/api/p/cliente/${token}/briefings`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.briefings)) {
        setLista(data.briefings as BriefingItem[]);
      }
    } catch {
      /* silencioso — a aba só abre quando há briefings; erro mostra vazio */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrir(b: BriefingItem) {
    setAbertoId(b.id);
    setDetalhe(null);
    setCarregandoDetalhe(true);
    try {
      const res = await fetch(`/api/p/cliente/${token}/briefings/${b.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.shareToken) {
        toast.error(data?.error ?? "Não consegui abrir este briefing.");
        setAbertoId(null);
        return;
      }
      setDetalhe(data as Detalhe);
    } catch {
      toast.error("Sem conexão. Tente de novo.");
      setAbertoId(null);
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  function voltar() {
    setAbertoId(null);
    setDetalhe(null);
  }

  // Cliente respondeu pelo form embutido → atualiza a lista (status/data) e
  // avisa a casca pra rebaixar o badge de pendentes. Fica no form (estado de
  // agradecimento do BriefingPublico); o "Voltar" leva pra lista já atualizada.
  function aoResponder() {
    void carregarLista();
    onPendenciasMudaram?.();
  }

  // ─── Form embutido ──────────────────────────────────────────────────
  if (abertoId) {
    return (
      <div className="space-y-3">
        <button
          onClick={voltar}
          className="touch-feedback inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos briefings
        </button>

        {carregandoDetalhe || !detalhe ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : (
          // BriefingPublico tem <main> próprio + CTA fixo no rodapé; embutido
          // ele só ocupa o fluxo do portal e reusa todo o comportamento.
          <BriefingPublico
            token={detalhe.shareToken}
            titulo={detalhe.titulo}
            clienteNome={clienteNome}
            perguntas={detalhe.perguntas}
            respostasIniciais={detalhe.respostas}
            jaRespondido={detalhe.status === "RESPONDIDO"}
            respondidoEm={detalhe.respondidoEm}
            onRespondido={aoResponder}
            embutido
          />
        )}
      </div>
    );
  }

  // ─── Lista ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (lista.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum briefing pra você no momento.</p>
        </CardContent>
      </Card>
    );
  }

  const pendentes = lista.filter((b) => b.status === "ENVIADO");
  const respondidos = lista.filter((b) => b.status === "RESPONDIDO");

  return (
    <div className="space-y-5">
      {pendentes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aguardando você ({pendentes.length})
          </h2>
          <div className="space-y-1.5">
            {pendentes.map((b) => (
              <BriefingCard key={b.id} briefing={b} onAbrir={() => abrir(b)} />
            ))}
          </div>
        </section>
      )}

      {respondidos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Respondidos ({respondidos.length})
          </h2>
          <div className="space-y-1.5">
            {respondidos.map((b) => (
              <BriefingCard key={b.id} briefing={b} onAbrir={() => abrir(b)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Card de um briefing na lista. Pendente (ENVIADO) ganha destaque visual
 * (borda/realce) + CTA "Responder". Respondido mostra "✓ Respondido em DD/MM"
 * + "Revisar/editar". O card inteiro é clicável (alvo de toque grande).
 */
function BriefingCard({ briefing, onAbrir }: { briefing: BriefingItem; onAbrir: () => void }) {
  const pendente = briefing.status === "ENVIADO";
  const respondidoData = briefing.respondidoEm
    ? new Date(briefing.respondidoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <Card
      className={cn(
        "transition-colors",
        pendente
          ? "border-amber-500/40 bg-amber-500/[0.04] hover:bg-amber-500/[0.07]"
          : "hover:bg-muted/40"
      )}
    >
      <CardContent className="p-3.5 sm:p-4">
        <button
          onClick={onAbrir}
          className="touch-feedback flex w-full items-center gap-3 text-left"
        >
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              pendente ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
            )}
          >
            {pendente ? <ClipboardList className="h-[18px] w-[18px]" /> : <CheckCircle2 className="h-[18px] w-[18px]" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="text-[14px] sm:text-[13.5px] font-medium leading-snug truncate">
              {briefing.titulo}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px]">
              {pendente ? (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  Aguardando suas respostas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Respondido{respondidoData ? ` em ${respondidoData}` : ""}
                </span>
              )}
            </div>
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        </button>

        <div className="mt-2.5 flex sm:justify-end">
          <Button
            size="sm"
            variant={pendente ? "default" : "outline"}
            onClick={onAbrir}
            className="h-9 w-full sm:w-auto touch-feedback"
          >
            {pendente ? "Responder" : "Revisar / editar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
