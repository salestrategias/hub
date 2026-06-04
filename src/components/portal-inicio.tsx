"use client";
/**
 * Tab "Início" do Portal — home "Entregas & Resultados".
 *
 * Primeira tela que o cliente vê. Foco em VALOR: o que a SAL entregou
 * pra ele ESTE MÊS. Read-only.
 *
 * Blocos:
 *  1. Boas-vindas (saudação + nome + linha de valor)
 *  2. 4 contadores grandes de entregas do mês (posts, criativos,
 *     reuniões, tarefas concluídas)
 *  3. Últimas entregas (timeline curtinha: ícone + título + data relativa)
 *
 * Acento da marca (corPrimaria) é opcional, aplicado via style inline
 * só nos números/ícones. Sem CSS-in-JS — só tokens Tailwind.
 */
import { useEffect, useState } from "react";
import {
  Megaphone,
  Mic,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles,
  CalendarCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
  entregasMes: EntregasMes;
  ultimasEntregas: Entrega[];
  totais?: { postsPublicados: number };
};

/** "este mês" por extenso, ex.: "junho de 2026" (capitalizado). */
function rotuloMesAtual(): string {
  const s = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
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
}: {
  token: string;
  clienteNome: string;
  /** hex já sanitizado da marca, ou undefined (usa tokens primary). */
  acento?: string;
}) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/p/cliente/${token}/resumo`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.entregasMes) setResumo(d as Resumo);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <InicioSkeleton />;
  }

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
          Veja o que a SAL entregou pra você em{" "}
          <span className="font-medium text-foreground">{rotuloMesAtual()}</span>.
        </p>
      </section>

      {/* 2) Cards de entregas do mês */}
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

      {/* 3) Últimas entregas */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Últimas entregas
        </h2>
        {ultimas.length === 0 ? (
          <Card>
            <CardContent className="p-7 sm:p-8 text-center space-y-2">
              <CalendarCheck className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {totalEntregasMes > 0
                  ? "As entregas deste mês aparecem aqui conforme ficam prontas."
                  : "Sua primeira entrega aparece aqui."}
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                A SAL está trabalhando nos seus conteúdos.
              </p>
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
    </div>
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

function InicioSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-44 rounded bg-muted" />
        <div className="h-3.5 w-60 rounded bg-muted" />
      </div>
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
