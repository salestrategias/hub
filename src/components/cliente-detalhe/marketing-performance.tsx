"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MoneyValue } from "@/components/money-value";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Megaphone,
  Users,
  Search,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Music2,
  Target,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrafegoPagoResumo, RedesResumo, SeoResumo } from "@/lib/cliente-marketing";
import type { RedeSocial } from "@prisma/client";

type Props = {
  trafegoPago: TrafegoPagoResumo;
  redes: RedesResumo;
  seo: SeoResumo;
  clienteId: string;
};

const REDES_ICONES: Record<RedeSocial, React.ComponentType<{ className?: string }>> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  LINKEDIN: Linkedin,
  YOUTUBE: Youtube,
  TIKTOK: Music2,
};

const REDES_LABELS: Record<RedeSocial, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
};

const REDES_CORES: Record<RedeSocial, string> = {
  INSTAGRAM: "#EC4899",
  FACEBOOK: "#3B82F6",
  LINKEDIN: "#0A66C2",
  YOUTUBE: "#EF4444",
  TIKTOK: "#14B8A6",
};

export function MarketingPerformance({ trafegoPago, redes, seo, clienteId }: Props) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm font-semibold">Marketing performance</h3>
        </div>

        <Tabs defaultValue="trafego">
          <TabsList>
            <TabsTrigger value="trafego">
              <Megaphone className="h-3 w-3 mr-1.5" /> Tráfego pago
            </TabsTrigger>
            <TabsTrigger value="redes">
              <Users className="h-3 w-3 mr-1.5" /> Redes sociais
            </TabsTrigger>
            <TabsTrigger value="seo">
              <Search className="h-3 w-3 mr-1.5" /> SEO
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trafego" className="mt-4">
            <TrafegoPagoTab data={trafegoPago} clienteId={clienteId} />
          </TabsContent>
          <TabsContent value="redes" className="mt-4">
            <RedesTab data={redes} clienteId={clienteId} />
          </TabsContent>
          <TabsContent value="seo" className="mt-4">
            <SeoTab data={seo} clienteId={clienteId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Tráfego pago ─────────────────────────────────────────────

function TrafegoPagoTab({ data, clienteId }: { data: TrafegoPagoResumo; clienteId: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted ? resolvedTheme === "dark" : true;
  const axisStroke = dark ? "rgba(150, 150, 168, 0.7)" : "rgba(80, 80, 100, 0.6)";

  if (data.investimentoTotal6m === 0) {
    return <EmptyHint mensagem="Sem campanhas registradas nos últimos 6 meses." href={`/relatorios/trafego-pago?cliente=${clienteId}`} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Investido (6m)" valueNode={<MoneyValue value={data.investimentoTotal6m} className="font-mono" />} />
        <Stat label="Conversões (6m)" value={String(data.conversoesTotal6m)} />
        <Stat label="ROAS médio" value={data.roasMedio6m.toFixed(2) + "×"} accent={data.roasMedio6m >= 3 ? "good" : data.roasMedio6m >= 1 ? "warn" : "bad"} />
        <Stat label="CPA médio" valueNode={<MoneyValue value={data.cpaMedio6m} className="font-mono" />} />
      </div>

      {data.porMes.length > 0 && (
        <div className="rounded-md border border-border bg-background/40 p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Investimento mensal
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data.porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"} vertical={false} />
              <XAxis dataKey="label" stroke={axisStroke} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={axisStroke} fontSize={10} tickLine={false} axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  background: dark ? "#13131C" : "#fff",
                  border: `1px solid ${dark ? "#1F1F2D" : "#E2E2EA"}`,
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)}
                cursor={{ fill: "rgba(126,48,225,0.06)" }}
              />
              <Bar dataKey="investimento" fill="#7E30E1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.topCampanhas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
              Top campanhas por ROAS
            </div>
            <Link
              href={`/relatorios/trafego-pago?cliente=${clienteId}`}
              className="text-[10.5px] text-sal-400 hover:underline inline-flex items-center gap-1"
            >
              Relatório completo <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
          <ul className="space-y-1">
            {data.topCampanhas.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-secondary/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{c.nome}</div>
                  <div className="text-[10.5px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] mr-1">{plataformaLabel(c.plataforma)}</Badge>
                    {c.conversoes} conv · <MoneyValue value={c.investimento} className="font-mono" />
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {c.roas.toFixed(2)}× ROAS
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Redes sociais ────────────────────────────────────────────

function RedesTab({ data, clienteId }: { data: RedesResumo; clienteId: string }) {
  const ativas = data.porRede.filter((r) => r.seguidoresAtual > 0 || r.ultimoRegistro);

  if (ativas.length === 0) {
    return <EmptyHint mensagem="Sem métricas de redes registradas." href={`/relatorios/redes-sociais?cliente=${clienteId}`} />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ativas.map((r) => {
          const Icon = REDES_ICONES[r.rede];
          const cor = REDES_CORES[r.rede];
          return (
            <div
              key={r.rede}
              className="rounded-md border border-border bg-background/40 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${cor}1F`, color: cor }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold">{REDES_LABELS[r.rede]}</span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[20px] font-semibold tabular-nums leading-none">
                    {formatN(r.seguidoresAtual)}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground">seguidores</span>
                  {r.deltaSeguidores !== 0 && r.seguidoresAnterior > 0 && (
                    <DeltaSmall value={r.deltaSeguidores} />
                  )}
                </div>

                {r.metaSeguidores > 0 && (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span className="inline-flex items-center gap-1"><Target className="h-2.5 w-2.5" /> Meta {formatN(r.metaSeguidores)}</span>
                      <span className="font-mono">{Math.round(r.progressoMeta * 100)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full" style={{ width: `${r.progressoMeta * 100}%`, background: cor }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1 text-[10.5px] text-muted-foreground pt-1 border-t border-border/40">
                <Mini label="Alcance" value={formatN(r.alcanceMes)} />
                <Mini label="Engaj." value={formatN(r.engajamentoMes)} hint={r.taxaEngajamento > 0 ? `${(r.taxaEngajamento * 100).toFixed(1)}%` : undefined} />
                <Mini label="Posts" value={`${r.postsMes}p ${r.reelsMes}r`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-right">
        <Link
          href={`/relatorios/redes-sociais?cliente=${clienteId}`}
          className="text-[10.5px] text-sal-400 hover:underline inline-flex items-center gap-1"
        >
          Relatório completo <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  );
}

// ─── Tab: SEO ──────────────────────────────────────────────────────

function SeoTab({ data, clienteId }: { data: SeoResumo; clienteId: string }) {
  if (data.posicaoMedia === null) {
    return <EmptyHint mensagem="Sem métricas de SEO registradas." href={`/relatorios/seo?cliente=${clienteId}`} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Posição média"
          value={data.posicaoMedia.toFixed(1)}
          delta={data.deltaPosicao !== null ? -data.deltaPosicao : undefined}
          deltaInverted
        />
        <Stat label="Cliques orgânicos" value={formatN(data.cliquesOrganicos ?? 0)} />
        <Stat label="Impressões" value={formatN(data.impressoes ?? 0)} />
        <Stat label="CTR" value={data.ctr !== null ? `${(data.ctr * 100).toFixed(2)}%` : "—"} />
      </div>

      {data.observacoes && (
        <div className="rounded-md border border-border bg-background/40 p-3 text-[12px] text-muted-foreground leading-relaxed">
          {data.observacoes}
        </div>
      )}

      {data.topKeywords.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
              Top keywords
            </div>
            <Link
              href={`/relatorios/seo?cliente=${clienteId}`}
              className="text-[10.5px] text-sal-400 hover:underline inline-flex items-center gap-1"
            >
              Relatório completo <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
          <ul className="space-y-1">
            {data.topKeywords.map((k) => (
              <li
                key={k.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-secondary/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{k.keyword}</div>
                  {k.urlRanqueada && (
                    <a
                      href={k.urlRanqueada}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10.5px] text-muted-foreground hover:text-sal-400 truncate block"
                    >
                      {k.urlRanqueada}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10.5px] text-muted-foreground font-mono">
                    vol {formatN(k.volumeEstimado)}
                  </span>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    #{k.posicaoAtual}
                  </Badge>
                  {k.delta !== 0 && k.posicaoAnterior > 0 && (
                    <DeltaSmall value={-k.delta} positivoLabel="↑" negativoLabel="↓" inverted />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────

function Stat({
  label,
  value,
  valueNode,
  accent,
  delta,
  deltaInverted,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  accent?: "good" | "warn" | "bad";
  delta?: number;
  deltaInverted?: boolean;
}) {
  const accentClass =
    accent === "good"
      ? "text-emerald-400"
      : accent === "warn"
      ? "text-amber-400"
      : accent === "bad"
      ? "text-rose-400"
      : "";

  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={cn("font-display text-[18px] font-semibold tabular-nums leading-none mt-1.5", accentClass)}>
        {valueNode ?? value}
      </div>
      {delta !== undefined && Math.abs(delta) > 0.01 && (
        <div className="mt-1.5">
          <DeltaSmall value={delta} inverted={deltaInverted} />
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{label}</div>
      <div className="font-mono text-[11px] tabular-nums">{value}</div>
      {hint && <div className="text-[9.5px] text-muted-foreground/60">{hint}</div>}
    </div>
  );
}

function DeltaSmall({
  value,
  inverted,
  positivoLabel,
  negativoLabel,
}: {
  value: number;
  inverted?: boolean;
  positivoLabel?: string;
  negativoLabel?: string;
}) {
  if (Math.abs(value) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
        <Minus className="h-2.5 w-2.5" />
      </span>
    );
  }
  const positivo = inverted ? value < 0 : value > 0;
  const valor = Math.abs(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-mono",
        positivo ? "text-emerald-400" : "text-rose-400"
      )}
    >
      {positivo ? (
        positivoLabel ?? <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        negativoLabel ?? <TrendingDown className="h-2.5 w-2.5" />
      )}
      {Number.isInteger(valor) ? valor : valor.toFixed(1)}
    </span>
  );
}

function EmptyHint({ mensagem, href }: { mensagem: string; href: string }) {
  return (
    <div className="text-center py-8 space-y-2">
      <p className="text-xs text-muted-foreground">{mensagem}</p>
      <Link
        href={href}
        className="text-[10.5px] text-sal-400 hover:underline inline-flex items-center gap-1"
      >
        Abrir relatório <ExternalLink className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}

function plataformaLabel(p: string): string {
  return p.replace(/_/g, " ").toLowerCase();
}

function formatN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return String(n);
}
