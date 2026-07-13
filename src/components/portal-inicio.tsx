"use client";
/**
 * Início v5 — feed de decisão (padrão do protótipo aprovado).
 *
 * Blocos, na ordem:
 *  1. Saudação grande por hora do dia
 *  2. HERÓI de pendências (estilo fintech): número grande + thumbs
 *     decorativas + "Revisar agora" (abre o Modo Revisão stories).
 *     Zero pendências → cartão calmo "Tudo em dia".
 *  3. "Sua semana" — strip de 7 dias com bolinhas de publicação
 *     (bolinha âmbar = tem pendência no dia)
 *  4. Carrossel "Para aprovar" — itens leves (sem artes; capa é um
 *     gradiente decorativo). Tocar abre o Modo Revisão.
 *  5. Últimas entregas do mês
 *
 * Métricas/contadores saíram daqui — agora vivem na aba Resultados.
 * SEM fetch próprio: o shell já busca o /resumo (pendências + semana +
 * últimas entregas) e passa tudo por props — uma chamada só no load.
 */
import { Megaphone, Image as ImageIcon, CalendarCheck, ClipboardList, ArrowRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tab, PendenciaItem, DiaSemana, Entrega } from "@/components/portal-cliente";

/** Gradientes decorativos pros cards sem arte (pool fixo, escolhido por índice). */
export const GRADIENTES = [
  "linear-gradient(135deg,#F7B733,#FC4A1A)",
  "linear-gradient(135deg,#7F7FD5,#86A8E7,#91EAE4)",
  "linear-gradient(135deg,#11998E,#38EF7D)",
  "linear-gradient(135deg,#EC008C,#FC6767)",
  "linear-gradient(135deg,#DA22FF,#9733EE)",
  "linear-gradient(135deg,#02AAB0,#00CDAC)",
  "linear-gradient(135deg,#00B4DB,#0083B0)",
  "linear-gradient(135deg,#F953C6,#B91D73)",
];
export function gradiente(i: number): string {
  return GRADIENTES[Math.abs(i) % GRADIENTES.length];
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 6) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
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

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function PortalInicio({
  corMarca,
  pendencias,
  semana,
  ultimas,
  briefingsPendentes = 0,
  podeRevisar = false,
  onRevisar,
  onIrParaTab,
}: {
  /** cor efetiva da marca (acento ou roxo SAL) — herói/CTAs. */
  corMarca: string;
  pendencias: { posts: number; criativos: number; itens: PendenciaItem[] };
  semana: DiaSemana[];
  /** null = ainda carregando (skeleton). */
  ultimas: Entrega[] | null;
  briefingsPendentes?: number;
  podeRevisar?: boolean;
  onRevisar?: () => void;
  onIrParaTab?: (tab: Tab) => void;
}) {
  const totalPendencias = podeRevisar ? pendencias.posts + pendencias.criativos : 0;
  const hojeIso = new Date().toDateString();

  return (
    <div className="p5-screen space-y-6">
      {/* 1) Saudação */}
      <section className="pt-1">
        <h1 className="font-display text-[26px] font-extrabold tracking-tight leading-tight">
          {saudacao()}! 👋
        </h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">
          Seu marketing está andando — veja o que chegou.
        </p>
      </section>

      {/* 2) Herói de pendências */}
      {totalPendencias > 0 ? (
        <section
          className="rounded-[26px] p-5 text-white"
          style={{
            background: `radial-gradient(120% 160% at 100% 0%, color-mix(in srgb, ${corMarca} 55%, #ffffff 12%) 0%, ${corMarca} 55%)`,
            boxShadow: `0 14px 34px color-mix(in srgb, ${corMarca} 38%, transparent)`,
          }}
          aria-label="Conteúdos esperando sua aprovação"
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[.09em] opacity-80">
            Esperando você
          </div>
          <div className="font-display text-[40px] font-extrabold leading-[1.05] tracking-tight tabular-nums mt-1">
            {totalPendencias}
          </div>
          <div className="text-[13px] opacity-85">
            {totalPendencias === 1 ? "conteúdo pra aprovar" : "conteúdos pra aprovar"} · leva ~1 min
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex">
              {pendencias.itens.slice(0, 3).map((p, i) => (
                <i
                  key={p.id}
                  className={`h-[34px] w-[34px] rounded-[11px] border-2 ${i > 0 ? "-ml-2" : ""}`}
                  style={{
                    background: gradiente(i),
                    borderColor: `color-mix(in srgb, ${corMarca} 60%, #ffffff 18%)`,
                  }}
                />
              ))}
            </div>
            {onRevisar && (
              <button
                type="button"
                onClick={onRevisar}
                className="touch-feedback ml-auto rounded-full bg-white px-5 py-3 text-[13.5px] font-extrabold text-[#1B1730] shadow-[0_4px_14px_rgba(0,0,0,.18)]"
              >
                Revisar agora
              </button>
            )}
          </div>
        </section>
      ) : (
        <Card className="p5-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-[13px] text-white"
                style={{ background: corMarca }}
              >
                <Check className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-[15px] font-bold">Tudo em dia ✦</div>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Quando a SAL mandar conteúdo novo, aparece aqui pra você aprovar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Briefing pendente — linha própria, acionável */}
      {briefingsPendentes > 0 && onIrParaTab && (
        <button
          type="button"
          onClick={() => onIrParaTab("mais")}
          className="touch-feedback p5-card flex w-full items-center gap-3 bg-card p-4 text-left"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${corMarca} 12%, transparent)` }}
          >
            <ClipboardList className="h-[18px] w-[18px]" style={{ color: corMarca }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold leading-tight">
              {briefingsPendentes === 1
                ? "1 briefing esperando sua resposta"
                : `${briefingsPendentes} briefings esperando sua resposta`}
            </span>
            <span className="block text-[11.5px] text-muted-foreground mt-0.5">
              suas respostas afinam a estratégia
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        </button>
      )}

      {/* 3) Sua semana */}
      {semana.length > 0 && (
        <section>
          <h2 className="text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80 mb-2.5 px-0.5">
            Sua semana
          </h2>
          <div className="p5-hscroll flex gap-2 overflow-x-auto pb-1">
            {semana.map((d) => {
              const data = new Date(d.data);
              const ehHoje = data.toDateString() === hojeIso;
              return (
                <div
                  key={d.data}
                  className="p5-card min-w-[52px] shrink-0 rounded-2xl bg-card px-0 py-2.5 text-center"
                  style={ehHoje ? { boxShadow: `inset 0 0 0 2px ${corMarca}, var(--p5-shadow)` } : undefined}
                >
                  <div
                    className="text-[9.5px] font-extrabold uppercase tracking-wide"
                    style={{ color: ehHoje ? corMarca : "hsl(var(--muted-foreground))" }}
                  >
                    {DIAS_CURTOS[data.getDay()]}
                  </div>
                  <div className="font-display text-base font-extrabold tabular-nums mt-0.5">
                    {data.getDate()}
                  </div>
                  <div className="mt-1 flex min-h-[6px] items-center justify-center gap-[3px]">
                    {Array.from({ length: Math.min(d.posts, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className="h-[5px] w-[5px] rounded-full"
                        style={{ background: i < d.pendentes ? "#F5A623" : corMarca }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4) Para aprovar (carrossel) */}
      {totalPendencias > 0 && pendencias.itens.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-baseline justify-between px-0.5">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80">
              Para aprovar
            </h2>
            {onIrParaTab && (
              <button
                type="button"
                onClick={() => onIrParaTab("conteudo")}
                className="touch-feedback text-[11.5px] font-bold"
                style={{ color: corMarca }}
              >
                ver tudo →
              </button>
            )}
          </div>
          <div className="p5-hscroll flex gap-3 overflow-x-auto pb-2 pl-0.5">
            {pendencias.itens.map((p, i) => (
              <button
                key={`${p.kind}-${p.id}`}
                type="button"
                onClick={onRevisar}
                className="p5-card w-[150px] shrink-0 overflow-hidden rounded-[18px] bg-card text-left touch-feedback"
              >
                <div className="relative aspect-square" style={{ background: gradiente(i) }}>
                  <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-extrabold text-white backdrop-blur-sm">
                    {p.kind === "post" ? "Orgânico" : "Anúncio"}
                  </span>
                </div>
                <div className="px-3 pb-3 pt-2.5">
                  <div className="line-clamp-2 text-[12px] font-bold leading-snug">{p.titulo}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {p.quando
                      ? new Date(p.quando).toLocaleDateString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })
                      : "campanha"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 5) Últimas entregas */}
      <section>
        <h2 className="text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80 mb-2.5 px-0.5">
          Últimas entregas
        </h2>
        {ultimas === null ? (
          <Card className="p5-card">
            <CardContent className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-[13px]" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : ultimas.length === 0 ? (
          <Card className="p5-card">
            <CardContent className="p-8 text-center space-y-2">
              <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Sua primeira entrega do mês aparece aqui.</p>
              <p className="text-[11px] text-muted-foreground/60">
                A SAL está trabalhando nos seus conteúdos.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="p5-card">
            <CardContent className="divide-y divide-border p-0">
              {ultimas.map((e, i) => {
                const Icon = e.tipo === "post" ? Megaphone : ImageIcon;
                return (
                  <div key={`${e.tipo}-${e.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-white"
                      style={{ background: gradiente(i + 3) }}
                    >
                      <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold leading-snug">{e.titulo}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.tipo === "post" ? "Post publicado" : "Anúncio produzido"}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                      {dataRelativa(e.data)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
