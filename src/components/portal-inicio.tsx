"use client";
/**
 * Tab "Início" do Portal — home "Entregas & Resultados".
 *
 * Primeira tela que o cliente vê. Foco em VALOR: o que a SAL entregou
 * pra ele. Read-only.
 *
 * Blocos:
 *  1. Boas-vindas (saudação + nome + linha de valor)
 *  2. "Esperando você" — só se há itens aguardando a aprovação do cliente
 *     (atalho que leva pra aba certa). Estado ATUAL, não muda com o mês.
 *  3. Navegação de mês (◀ {Mês} ▶) — histórico de entregas. Não passa do
 *     mês atual (futuro não tem entrega pra mostrar).
 *  4. 4 contadores grandes de entregas do mês (posts, criativos,
 *     reuniões, tarefas concluídas)
 *  5. Últimas entregas (timeline curtinha: ícone + título + data relativa)
 *
 * Acento da marca (corPrimaria) é opcional, aplicado via style inline
 * só nos números/ícones/destaques. Sem CSS-in-JS — só tokens Tailwind.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Megaphone,
  Mic,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Tab } from "@/components/portal-cliente";

type EntregasMes = {
  postsPublicados: number;
  criativosProduzidos: number;
  reunioesRealizadas: number;
  tarefasConcluidas: number;
};

type Entrega = {
  id: string;
  tipo: "post" | "criativo";
  titulo: string;
  data: string;
};

type Resumo = {
  mes?: string;
  entregasMes: EntregasMes;
  ultimasEntregas: Entrega[];
  totais?: { postsPublicados: number };
};

type Pendencias = { posts: number; criativos: number };

// ─── Helpers de mês ────────────────────────────────────────────────────
/** "YYYY-MM" de uma data. */
function mesIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** "YYYY-MM" do mês atual. */
function mesAtualIso(): string {
  return mesIso(new Date());
}
/** Soma `delta` meses a um "YYYY-MM" e devolve outro "YYYY-MM". */
function somarMes(iso: string, delta: number): string {
  const [a, m] = iso.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return mesIso(d);
}
/** Rótulo por extenso de um "YYYY-MM", ex.: "Junho de 2026" (capitalizado). */
function rotuloMes(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  const s = new Date(a, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Data relativa curta em pt-BR ("hoje", "ontem", "há 3 dias", "12/05"). */
function dataRelativa(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);
  const diffDias = Math.round((hoje.getTime() - alvo.getTime()) / 86_400_000);
  if (diffDias === 0) return "hoje";
  if (diffDias === 1) return "ontem";
  if (diffDias > 1 && diffDias < 7) return `há ${diffDias} dias`;
  if (diffDias === -1) return "amanhã";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function PortalInicio({
  token,
  clienteNome,
  acento,
  pendencias = { posts: 0, criativos: 0 },
  podeVerCalendario = false,
  podeVerCriativos = false,
  onIrParaTab,
}: {
  token: string;
  clienteNome: string;
  /** hex já sanitizado da marca, ou undefined (usa tokens primary). */
  acento?: string;
  /** Itens aguardando a aprovação do cliente (alimenta "Esperando você"). */
  pendencias?: Pendencias;
  /** Permissões — só oferece atalho de aprovação pra aba que o cliente vê. */
  podeVerCalendario?: boolean;
  podeVerCriativos?: boolean;
  /** Troca a aba do portal (atalhos do bloco "Esperando você"). */
  onIrParaTab?: (tab: Tab) => void;
}) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  // Mês exibido (histórico). Default = mês atual.
  const [mes, setMes] = useState<string>(mesAtualIso());

  const ehMesAtual = mes === mesAtualIso();

  const carregar = useCallback(
    (alvoMes: string) => {
      setLoading(true);
      fetch(`/api/p/cliente/${token}/resumo?mes=${alvoMes}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.entregasMes) setResumo(d as Resumo);
          else setResumo(null);
        })
        .finally(() => setLoading(false));
    },
    [token]
  );

  useEffect(() => {
    carregar(mes);
  }, [carregar, mes]);

  // Pendências só viram atalho se a aba correspondente está visível.
  const pendPosts = podeVerCalendario ? pendencias.posts : 0;
  const pendCriativos = podeVerCriativos ? pendencias.criativos : 0;
  const totalPendencias = pendPosts + pendCriativos;

  const entregas = resumo?.entregasMes ?? {
    postsPublicados: 0,
    criativosProduzidos: 0,
    reunioesRealizadas: 0,
    tarefasConcluidas: 0,
  };
  const ultimas = resumo?.ultimasEntregas ?? [];
  const totalEntregasMes =
    entregas.postsPublicados +
    entregas.criativosProduzidos +
    entregas.reunioesRealizadas +
    entregas.tarefasConcluidas;

  const cards: { label: string; valor: number; icon: typeof Megaphone }[] = [
    { label: "Posts publicados", valor: entregas.postsPublicados, icon: Megaphone },
    { label: "Criativos", valor: entregas.criativosProduzidos, icon: ImageIcon },
    { label: "Reuniões", valor: entregas.reunioesRealizadas, icon: Mic },
    { label: "Tarefas concluídas", valor: entregas.tarefasConcluidas, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-5">
      {/* 1) Boas-vindas */}
      <section className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10"
            style={acento ? { background: `${acento}1A` } : undefined}
          >
            <Sparkles className="h-4 w-4 text-primary" style={acento ? { color: acento } : undefined} />
          </span>
          <h1 className="font-display text-lg sm:text-xl font-semibold leading-tight">
            Olá, {clienteNome}!
          </h1>
        </div>
        <p className="text-[13px] sm:text-sm text-muted-foreground leading-relaxed">
          Aqui você acompanha o que a SAL está entregando pra você.
        </p>
      </section>

      {/* 2) Esperando você — só se há pendências de aprovação (estado atual) */}
      {totalPendencias > 0 && onIrParaTab && (
        <EsperandoVoce
          posts={pendPosts}
          criativos={pendCriativos}
          acento={acento}
          onIrParaTab={onIrParaTab}
        />
      )}

      {/* 3) Navegação de mês (histórico de entregas) */}
      <section className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Entregas do mês
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMes((m) => somarMes(m, -1))}
            className="touch-feedback flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[7.5rem] text-center font-display text-[13px] font-semibold capitalize">
            {rotuloMes(mes)}
          </span>
          <button
            type="button"
            onClick={() => setMes((m) => somarMes(m, 1))}
            disabled={ehMesAtual}
            className="touch-feedback flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {loading ? (
        <ConteudoSkeleton />
      ) : (
        <>
          {/* 4) Cards de entregas do mês */}
          <section className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.label}>
                  <CardContent className="p-3.5 sm:p-4 space-y-1.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"
                      style={acento ? { background: `${acento}1A` } : undefined}
                    >
                      <Icon
                        className="h-[18px] w-[18px] text-primary"
                        style={acento ? { color: acento } : undefined}
                      />
                    </span>
                    <div
                      className="font-display text-2xl sm:text-[26px] font-bold leading-none text-foreground"
                      style={acento && c.valor > 0 ? { color: acento } : undefined}
                    >
                      {c.valor}
                    </div>
                    <div className="text-[11.5px] sm:text-xs text-muted-foreground leading-tight">
                      {c.label}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          {/* 5) Últimas entregas */}
          <section className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {ehMesAtual ? "Últimas entregas" : "Entregas do mês"}
            </h2>
            {ultimas.length === 0 ? (
              <Card>
                <CardContent className="p-7 sm:p-8 text-center space-y-2">
                  <CalendarCheck className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {ehMesAtual
                      ? totalEntregasMes > 0
                        ? "As entregas deste mês aparecem aqui conforme ficam prontas."
                        : "Sua primeira entrega aparece aqui."
                      : `Nenhuma entrega registrada em ${rotuloMes(mes).toLowerCase()}.`}
                  </p>
                  {ehMesAtual && (
                    <p className="text-[11px] text-muted-foreground/60">
                      A SAL está trabalhando nos seus conteúdos.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {ultimas.map((e) => (
                    <EntregaItem key={`${e.tipo}-${e.id}`} entrega={e} acento={acento} />
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Bloco "Esperando você" — destaque acionável quando há itens aguardando a
 * aprovação do cliente. Um botão por tipo com pendência (posts → Calendário,
 * criativos → Criativos). Acento da marca quando há; senão, primary.
 */
function EsperandoVoce({
  posts,
  criativos,
  acento,
  onIrParaTab,
}: {
  posts: number;
  criativos: number;
  acento?: string;
  onIrParaTab: (tab: Tab) => void;
}) {
  const total = posts + criativos;
  return (
    <section
      className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 sm:p-4"
      style={acento ? { borderColor: `${acento}4D`, background: `${acento}0D` } : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15"
          style={acento ? { background: `${acento}26` } : undefined}
        >
          <ClipboardCheck className="h-5 w-5 text-primary" style={acento ? { color: acento } : undefined} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-semibold leading-tight">Esperando você</h2>
          <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
            Você tem{" "}
            <span className="font-semibold text-foreground">
              {total} {total === 1 ? "item" : "itens"}
            </span>{" "}
            pra aprovar.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {posts > 0 && (
          <BotaoPendencia
            label={`${posts} ${posts === 1 ? "post" : "posts"} pra aprovar`}
            acento={acento}
            onClick={() => onIrParaTab("calendario")}
          />
        )}
        {criativos > 0 && (
          <BotaoPendencia
            label={`${criativos} ${criativos === 1 ? "criativo" : "criativos"} pra aprovar`}
            acento={acento}
            onClick={() => onIrParaTab("criativos")}
          />
        )}
      </div>
    </section>
  );
}

/** Botão de atalho do bloco "Esperando você" (cor sólida da marca/primary). */
function BotaoPendencia({
  label,
  acento,
  onClick,
}: {
  label: string;
  acento?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-feedback flex flex-1 items-center justify-between gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-[13px] font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      style={acento ? { background: acento } : undefined}
    >
      <span className="truncate">{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </button>
  );
}

function EntregaItem({ entrega, acento }: { entrega: Entrega; acento?: string }) {
  const Icon = entrega.tipo === "post" ? Megaphone : ImageIcon;
  const rotuloTipo = entrega.tipo === "post" ? "Post publicado" : "Criativo";
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10"
        style={acento ? { background: `${acento}1A` } : undefined}
      >
        <Icon className="h-4 w-4 text-primary" style={acento ? { color: acento } : undefined} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] sm:text-[13px] font-medium leading-snug truncate">
          {entrega.titulo}
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight">{rotuloTipo}</div>
      </div>
      <span className="shrink-0 text-[11px] font-mono text-muted-foreground">
        {dataRelativa(entrega.data)}
      </span>
    </div>
  );
}

/** Skeleton só dos cards + lista (o cabeçalho de mês fica estável ao navegar). */
function ConteudoSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-3.5 sm:p-4 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-muted" />
              <div className="h-6 w-10 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-muted" />
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3.5 py-3">
                <div className="h-8 w-8 rounded-lg bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-muted" />
                  <div className="h-2.5 w-16 rounded bg-muted" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
