"use client";
/**
 * RESULTADOS v5 — o valor da SAL visível sem o cliente pedir.
 *
 * Novidade do v5 (aba própria na navegação):
 *  - 4 cards de métrica do mês (alcance / interações / seguidores /
 *    posts publicados) com delta % vs mês anterior
 *  - Gráfico de barras: alcance dos últimos 4 meses (mês atual na cor
 *    da marca)
 *  - Relatórios mensais em PDF (gerados na hora pela rota do portal)
 *
 * Fonte: GET /api/p/cliente/[token]/resultados (MetricaRede mensal).
 * Sem métricas importadas ainda → estado vazio honesto + PDFs sempre.
 */
import { useCallback, useEffect, useState } from "react";
import { BarChart3, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchPortal } from "@/lib/portal-fetch";

type Resultados = {
  mes: { ano: number; mes: number; rotulo: string };
  metricas: {
    temDados: boolean;
    alcance: number;
    alcanceDelta: number | null;
    interacoes: number;
    interacoesDelta: number | null;
    seguidores: number;
    seguidoresDelta: number | null;
  };
  alcancePorMes: { rotulo: string; alcance: number; temDados: boolean }[];
  entregasMes: { postsPublicados: number };
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** 48.200 → "48,2k" (padrão de app, fácil de bater o olho). */
function compacto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(".", ",")}k`;
  return n.toLocaleString("pt-BR");
}

export function PortalResultados({ token, corMarca }: { token: string; corMarca: string }) {
  const [dados, setDados] = useState<Resultados | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro(false);
    fetchPortal(`/api/p/cliente/${token}/resultados`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (r.ok && d?.metricas) setDados(d as Resultados);
        else setErro(true);
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Últimos 6 meses pros PDFs (o link é gerado no front; o PDF é on-demand)
  const hoje = new Date();
  const mesesPdf: { ano: number; mes: number; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    mesesPdf.push({
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  if (loading) return <ResultadosSkeleton />;

  const m = dados?.metricas;
  const maxAlcance = Math.max(1, ...(dados?.alcancePorMes.map((x) => x.alcance) ?? [1]));

  return (
    <div className="p5-screen space-y-5">
      <section className="pt-1">
        <h1 className="font-display text-[26px] font-extrabold tracking-tight leading-tight">
          Resultados
        </h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">
          O que o marketing rendeu — sem precisar pedir.
        </p>
      </section>

      {erro ? (
        <Card className="p5-card">
          <CardContent className="p-8 text-center space-y-2">
            <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Não conseguimos carregar seus resultados.</p>
            <Button variant="outline" size="sm" onClick={carregar} className="touch-feedback">
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : m?.temDados ? (
        <>
          {/* Métricas do mês */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard n={compacto(m.alcance)} delta={m.alcanceDelta} label="pessoas alcançadas" />
            <StatCard n={compacto(m.interacoes)} delta={m.interacoesDelta} label="interações no mês" />
            <StatCard n={compacto(m.seguidores)} delta={m.seguidoresDelta} label="seguidores" />
            <StatCard
              n={String(dados?.entregasMes.postsPublicados ?? 0)}
              delta={null}
              label={`posts publicados em ${MESES[(dados?.mes.mes ?? 1) - 1].toLowerCase()}`}
            />
          </div>

          {/* Alcance por mês */}
          <section>
            <h2 className="mb-2.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80">
              Alcance por mês
            </h2>
            <Card className="p5-card">
              <CardContent className="p-0">
                <div className="flex h-[104px] items-end gap-2 px-4 pb-1.5 pt-4">
                  {dados?.alcancePorMes.map((x, i, arr) => {
                    const ultimo = i === arr.length - 1;
                    const h = Math.max(8, Math.round((x.alcance / maxAlcance) * 100));
                    return (
                      <div
                        key={x.rotulo + i}
                        className="flex-1 rounded-t-lg rounded-b-sm transition-all"
                        style={{
                          height: `${h}%`,
                          background: ultimo
                            ? corMarca
                            : `color-mix(in srgb, ${corMarca} 22%, transparent)`,
                        }}
                        aria-label={`${x.rotulo}: ${x.alcance.toLocaleString("pt-BR")} pessoas`}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-2 px-4 pb-3.5">
                  {dados?.alcancePorMes.map((x, i) => (
                    <span
                      key={x.rotulo + i}
                      className="flex-1 text-center text-[9px] font-bold uppercase text-muted-foreground/70"
                    >
                      {x.rotulo}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <Card className="p5-card">
          <CardContent className="p-6 flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
              style={{ background: `color-mix(in srgb, ${corMarca} 12%, transparent)` }}
            >
              <TrendingUp className="h-5 w-5" style={{ color: corMarca }} />
            </span>
            <div>
              <div className="font-display text-[14px] font-bold">Métricas chegando</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                Assim que a SAL consolidar as métricas das suas redes, os números do mês aparecem
                aqui. Os relatórios em PDF já estão disponíveis abaixo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relatórios em PDF */}
      <section>
        <h2 className="mb-2.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80">
          Relatórios em PDF
        </h2>
        <Card className="p5-card">
          <CardContent className="divide-y divide-border p-0">
            {mesesPdf.map((mp) => (
              <a
                key={`${mp.ano}-${mp.mes}`}
                href={`/api/p/cliente/${token}/relatorio-mensal?ano=${mp.ano}&mes=${mp.mes}`}
                target="_blank"
                rel="noreferrer"
                className="touch-feedback flex items-center gap-3 px-4 py-3.5"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                  style={{ background: `color-mix(in srgb, ${corMarca} 12%, transparent)` }}
                >
                  <FileText className="h-[18px] w-[18px]" style={{ color: corMarca }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold leading-tight">{mp.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    relatório mensal completo
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-extrabold" style={{ color: corMarca }}>
                  Abrir
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
        <p className="mt-2 px-1 text-center text-[10.5px] text-muted-foreground/70">
          O PDF é gerado na hora, com os dados mais recentes do mês.
        </p>
      </section>
    </div>
  );
}

function StatCard({ n, delta, label }: { n: string; delta: number | null; label: string }) {
  return (
    <Card className="p5-card">
      <CardContent className="p-4">
        <div className="font-display text-[24px] font-extrabold tracking-tight tabular-nums leading-none">
          {n}
          {delta !== null && delta !== 0 && (
            <span
              className={`ml-1.5 align-middle text-[10.5px] font-extrabold ${
                delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          )}
        </div>
        <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function ResultadosSkeleton() {
  return (
    <div className="space-y-5">
      <div className="pt-1 space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[86px] rounded-[22px]" />
        ))}
      </div>
      <Skeleton className="h-[140px] w-full rounded-[22px]" />
      <Skeleton className="h-[220px] w-full rounded-[22px]" />
    </div>
  );
}
