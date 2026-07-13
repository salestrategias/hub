"use client";
/**
 * Portal do Cliente v5 — "o app da marca do cliente".
 *
 * Direção visual aprovada no protótipo (preview/portal-v5.html):
 * a COR DO CLIENTE é a protagonista (herói, FAB, navegação); a SAL vira
 * assinatura discreta. Cards sem borda com sombra suave (tokens .portal-v5
 * no globals.css). Benchmarks: Nubank (cartão de pendências), Instagram
 * (revisão stories + grade do feed), iFood (FAB central de envio).
 *
 * Navegação:
 *   Início · Conteúdo · [ + ] · Resultados · Mais
 *   — FAB central abre o sheet de ENVIO (2 modos preservados)
 *   — Resultados: métricas + relatórios (novidade do v5)
 *
 * Fluxo de sessão (v4, mantido):
 *  1. GET /api/p/cliente/[token] → info + permissões (ou pede senha)
 *  2. Senha → POST → cookie de sessão (deslizante 7d)
 *  3. 401 em qualquer fetch → evento global → volta pra tela de entrada
 *
 * Deep-links por hash: #conteudo · #resultados · #mais · #revisar · #enviar
 */
import { useEffect, useState } from "react";
import { Sparkles, LayoutGrid, BarChart3, Menu, Lock, Loader2, XCircle, ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { EVENTO_SESSAO_EXPIRADA } from "@/lib/portal-fetch";
import { PortalInicio } from "@/components/portal-inicio";
import { PortalConteudo } from "@/components/portal-conteudo";
import { PortalEnviarTab } from "@/components/portal-enviar-tab";
import { PortalResultados } from "@/components/portal-resultados";
import { PortalMais } from "@/components/portal-mais";
import { PortalRevisao } from "@/components/portal-revisao";

type Permissoes = {
  verCalendario: boolean;
  verCriativos: boolean;
  verTarefas: boolean;
  verReunioes: boolean;
  verRelatorios: boolean;
  podeAprovarPosts: boolean;
  podeAprovarCriativos: boolean;
  podeComentar: boolean;
  podeEnviarConteudo: boolean;
};

/** Marca leve do cliente (white-label): logo + cor de acento. */
type Marca = { logoUrl: string | null; corPrimaria: string | null };

/** Item pendente leve (sem artes) — herói + carrossel do Início. */
export type PendenciaItem = { id: string; kind: "post" | "criativo"; titulo: string; quando: string | null };

/** Dia da strip "Sua semana". */
export type DiaSemana = { data: string; posts: number; pendentes: number };

/** Entrega recente (timeline do Início). */
export type Entrega = { id: string; tipo: "post" | "criativo"; titulo: string; data: string };

type Pendencias = { posts: number; criativos: number; itens: PendenciaItem[] };

type EstadoInicial =
  | { tipo: "carregando" }
  | { tipo: "precisa-senha"; clienteNome: string; marca: Marca }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "ok"; clienteId: string; clienteNome: string; permissoes: Permissoes; marca: Marca };

export type Tab = "inicio" | "conteudo" | "resultados" | "mais";

type BriefingsResumo = { total: number; pendentes: number };

/** Roxo SAL (default). Acento da marca só substitui quando difere disso. */
export const COR_SAL = "#7E30E1";

/** Valida hex #RRGGBB; retorna null se inválido (não confia em dado do banco). */
function sanitizarHex(cor: string | null | undefined): string | null {
  if (!cor) return null;
  return /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : null;
}

/** Aba/ação inicial via hash da URL (deep-link de e-mails/atalhos). */
function tabDoHash(): { tab: Tab; revisar: boolean; enviar: boolean } {
  if (typeof window === "undefined") return { tab: "inicio", revisar: false, enviar: false };
  const h = window.location.hash.replace("#", "");
  if (h === "revisar") return { tab: "inicio", revisar: true, enviar: false };
  if (h === "enviar") return { tab: "inicio", revisar: false, enviar: true };
  if (h === "conteudo" || h === "resultados" || h === "mais")
    return { tab: h, revisar: false, enviar: false };
  return { tab: "inicio", revisar: false, enviar: false };
}

export function PortalCliente({ token }: { token: string }) {
  const [estado, setEstado] = useState<EstadoInicial>({ tipo: "carregando" });
  const [tab, setTab] = useState<Tab>("inicio");
  const [senha, setSenha] = useState("");
  const [autenticando, setAutenticando] = useState(false);
  const [pendencias, setPendencias] = useState<Pendencias>({ posts: 0, criativos: 0, itens: [] });
  const [semana, setSemana] = useState<DiaSemana[]>([]);
  const [ultimas, setUltimas] = useState<Entrega[] | null>(null);
  const [briefingsResumo, setBriefingsResumo] = useState<BriefingsResumo>({ total: 0, pendentes: 0 });
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Muda pra forçar remount da aba Conteúdo após o Modo Revisão agir.
  const [versaoConteudo, setVersaoConteudo] = useState(0);

  async function recarregarPendencias() {
    try {
      const res = await fetch(`/api/p/cliente/${token}/resumo`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.pendencias) {
        setPendencias({
          posts: Number(data.pendencias.posts) || 0,
          criativos: Number(data.pendencias.criativos) || 0,
          itens: Array.isArray(data.pendencias.itens) ? data.pendencias.itens : [],
        });
      }
      if (Array.isArray(data?.semana)) setSemana(data.semana);
      if (Array.isArray(data?.ultimasEntregas)) setUltimas(data.ultimasEntregas);
    } catch {
      /* badges são complementares */
    }
  }

  async function recarregarBriefings() {
    try {
      const res = await fetch(`/api/p/cliente/${token}/briefings`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.briefings)) {
        const total = data.briefings.length;
        const pendentes = data.briefings.filter(
          (b: { status?: string }) => b?.status === "ENVIADO"
        ).length;
        setBriefingsResumo({ total, pendentes });
      }
    } catch {
      /* aba/badge são complementares */
    }
  }

  async function carregar(senhaProvida?: string) {
    try {
      const opts: RequestInit = senhaProvida
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senha: senhaProvida }),
          }
        : { method: "GET" };
      const res = await fetch(`/api/p/cliente/${token}`, opts);
      const data = await res.json();
      if (!res.ok) {
        // Senha errada / rate limit: fica na tela de senha com aviso.
        if (senhaProvida && (res.status === 401 || res.status === 429)) {
          toast.error(data?.error ?? "Senha incorreta");
          return;
        }
        setEstado({ tipo: "erro", mensagem: data?.error ?? "Falha ao carregar" });
        return;
      }
      if (data.precisaSenha) {
        setEstado({
          tipo: "precisa-senha",
          clienteNome: data.clienteNome,
          marca: { logoUrl: data.logoUrl ?? null, corPrimaria: data.corPrimaria ?? null },
        });
        return;
      }
      setEstado({
        tipo: "ok",
        clienteId: data.cliente.id,
        clienteNome: data.cliente.nome,
        permissoes: data.permissoes,
        marca: { logoUrl: data.cliente.logoUrl ?? null, corPrimaria: data.cliente.corPrimaria ?? null },
      });
      const { tab: tabInicial, revisar, enviar } = tabDoHash();
      setTab(tabInicial);
      if (revisar) setRevisando(true);
      if (enviar && data.permissoes?.podeEnviarConteudo) setEnviando(true);
      void recarregarPendencias();
      void recarregarBriefings();
    } catch (e) {
      setEstado({ tipo: "erro", mensagem: e instanceof Error ? e.message : "Erro" });
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sessão expirou em qualquer fetch → volta pra tela de entrada.
  useEffect(() => {
    function aoExpirar() {
      setRevisando(false);
      setEnviando(false);
      setEstado({ tipo: "carregando" });
      void carregar();
    }
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function entrarComSenha() {
    if (!senha.trim()) return;
    setAutenticando(true);
    try {
      await carregar(senha);
    } finally {
      setAutenticando(false);
    }
  }

  if (estado.tipo === "carregando") {
    return (
      <div className="portal-v5 min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (estado.tipo === "erro") {
    return (
      <div className="portal-v5 min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background safe-area-inset-top safe-area-inset-bottom">
        <Card className="p5-card max-w-md w-full">
          <CardContent className="p-6 sm:p-8 text-center space-y-3">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="font-display text-xl font-semibold">Acesso indisponível</h1>
            <p className="text-sm text-muted-foreground">{estado.mensagem}</p>
            <p className="text-[11px] text-muted-foreground/60">
              Entre em contato com a SAL Estratégias de Marketing.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (estado.tipo === "precisa-senha") {
    const acentoLogin = sanitizarHex(estado.marca.corPrimaria);
    return (
      <div className="portal-v5 min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background safe-area-inset-top safe-area-inset-bottom">
        <Card className="p5-card max-w-sm w-full">
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-2.5">
              {estado.marca.logoUrl ? (
                <div className="h-16 w-16 rounded-2xl mx-auto flex items-center justify-center overflow-hidden bg-white p5-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={estado.marca.logoUrl}
                    alt={estado.clienteNome}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="h-14 w-14 rounded-2xl mx-auto flex items-center justify-center bg-primary p5-float"
                  style={acentoLogin ? { background: acentoLogin } : undefined}
                >
                  <Lock className="h-6 w-6 text-primary-foreground" />
                </div>
              )}
              <h1 className="font-display text-xl font-bold tracking-tight">{estado.clienteNome}</h1>
              <p className="text-xs text-muted-foreground">seu portal, cuidado pela SAL Estratégias</p>
            </div>
            <div className="space-y-2.5">
              <Input
                type="password"
                inputMode="text"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                onKeyDown={(e) => e.key === "Enter" && entrarComSenha()}
                autoFocus
                className="h-12 text-base sm:text-sm rounded-2xl"
              />
              <Button
                onClick={entrarComSenha}
                disabled={!senha.trim() || autenticando}
                className="w-full h-12 text-sm rounded-2xl touch-feedback"
                style={acentoLogin ? { background: acentoLogin } : undefined}
              >
                {autenticando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado OK — renderiza o app
  const { permissoes, clienteNome, marca } = estado;
  const acento = sanitizarHex(marca.corPrimaria);
  const temAcento = !!acento && acento.toUpperCase() !== COR_SAL;
  const corAtiva = temAcento ? acento! : undefined;
  const corMarca = corAtiva ?? COR_SAL;

  const verConteudo = permissoes.verCalendario || permissoes.verCriativos;
  const podeRevisar = verConteudo && (permissoes.podeAprovarPosts || permissoes.podeAprovarCriativos);
  const totalPendencias = podeRevisar ? pendencias.posts + pendencias.criativos : 0;

  const tabsVisiveis: { id: Tab; label: string; icon: typeof Sparkles; visivel: boolean; badge: number }[] = [
    { id: "inicio", label: "Início", icon: Sparkles, visivel: true, badge: 0 },
    { id: "conteudo", label: "Conteúdo", icon: LayoutGrid, visivel: verConteudo, badge: totalPendencias },
    { id: "resultados", label: "Resultados", icon: BarChart3, visivel: permissoes.verRelatorios, badge: 0 },
    { id: "mais", label: "Mais", icon: Menu, visivel: true, badge: briefingsResumo.pendentes },
  ];
  const visiveis = tabsVisiveis.filter((t) => t.visivel);
  const temFab = permissoes.podeEnviarConteudo;
  // Nav mobile: metade das abas de cada lado do FAB (quando há FAB).
  const meio = Math.ceil(visiveis.length / 2);
  const navEsq = temFab ? visiveis.slice(0, meio) : visiveis;
  const navDir = temFab ? visiveis.slice(meio) : [];

  function fecharRevisao(agiu: boolean) {
    setRevisando(false);
    if (agiu) {
      void recarregarPendencias();
      setVersaoConteudo((v) => v + 1);
    }
  }

  return (
    <div className="portal-v5 min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      {/* Header — logo + nome do cliente; SAL como assinatura */}
      <header className="safe-area-inset-top">
        <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-1 flex items-center gap-3">
          {marca.logoUrl ? (
            <div className="h-10 w-10 rounded-[13px] flex items-center justify-center shrink-0 overflow-hidden bg-white p5-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={marca.logoUrl} alt={clienteNome} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div
              className="h-10 w-10 rounded-[13px] flex items-center justify-center shrink-0 p5-float"
              style={{ background: corMarca }}
            >
              <span className="text-white font-display text-base font-bold">
                {clienteNome.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="font-display text-[14px] sm:text-base font-bold truncate">{clienteNome}</h1>
            <p className="text-[10.5px] text-muted-foreground">cuidado pela SAL Estratégias</p>
          </div>
          {/* Desktop: atalhos no header (mobile tem FAB + herói) */}
          <div className="hidden sm:flex items-center gap-2">
            {totalPendencias > 0 && podeRevisar && (
              <button
                type="button"
                onClick={() => setRevisando(true)}
                className="touch-feedback inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-bold text-white p5-float hover:opacity-90"
                style={{ background: corMarca }}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Revisar ({totalPendencias})
              </button>
            )}
            {temFab && (
              <button
                type="button"
                onClick={() => setEnviando(true)}
                className="touch-feedback inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-[12.5px] font-bold hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Enviar
              </button>
            )}
          </div>
        </div>

        {/* Tabs no topo — só desktop (mobile usa bottom-nav) */}
        {visiveis.length > 1 && (
          <nav className="hidden sm:flex max-w-2xl lg:max-w-3xl mx-auto px-6 gap-1.5 pt-2">
            {visiveis.map((t) => {
              const Icon = t.icon;
              const ativo = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`touch-feedback flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold transition-colors ${
                    ativo ? "text-white" : "bg-card text-muted-foreground hover:text-foreground p5-card"
                  }`}
                  style={ativo ? { background: corMarca } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {t.badge > 0 && (
                    <span
                      className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${
                        ativo ? "bg-white/25 text-white" : "text-white"
                      }`}
                      style={!ativo ? { background: corMarca } : undefined}
                    >
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Conteúdo */}
      <main className="max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-8">
        {tab === "inicio" && (
          <PortalInicio
            corMarca={corMarca}
            pendencias={pendencias}
            semana={semana}
            ultimas={ultimas}
            briefingsPendentes={briefingsResumo.pendentes}
            podeRevisar={podeRevisar}
            onRevisar={() => setRevisando(true)}
            onIrParaTab={(t) => setTab(t)}
          />
        )}
        {tab === "conteudo" && verConteudo && (
          <PortalConteudo
            key={versaoConteudo}
            token={token}
            corMarca={corMarca}
            permissoes={{
              verCalendario: permissoes.verCalendario,
              verCriativos: permissoes.verCriativos,
              podeAprovarPosts: permissoes.podeAprovarPosts,
              podeAprovarCriativos: permissoes.podeAprovarCriativos,
              podeComentar: permissoes.podeComentar,
              podeEnviarConteudo: permissoes.podeEnviarConteudo,
            }}
            onPendenciasMudaram={recarregarPendencias}
            onAbrirRevisao={() => setRevisando(true)}
          />
        )}
        {tab === "resultados" && permissoes.verRelatorios && (
          <PortalResultados token={token} corMarca={corMarca} />
        )}
        {tab === "mais" && (
          <PortalMais
            token={token}
            clienteNome={clienteNome}
            corMarca={corMarca}
            permissoes={{
              verTarefas: permissoes.verTarefas,
              verReunioes: permissoes.verReunioes,
            }}
            briefingsPendentes={briefingsResumo.pendentes}
            temBriefings={briefingsResumo.total > 0}
            onPendenciasMudaram={recarregarBriefings}
          />
        )}
      </main>

      <footer className="hidden sm:block max-w-2xl lg:max-w-3xl mx-auto px-6 py-6 text-center text-[10.5px] text-muted-foreground/70">
        SAL Estratégias de Marketing · Portal do Cliente
      </footer>

      {/* Bottom-nav mobile: abas + FAB central de envio */}
      <nav
        className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação principal"
      >
        <div
          className="mx-auto grid max-w-2xl items-center px-2 pt-1.5 pb-1"
          style={{
            gridTemplateColumns: temFab
              ? `repeat(${navEsq.length}, 1fr) 72px repeat(${navDir.length}, 1fr)`
              : `repeat(${navEsq.length}, 1fr)`,
          }}
        >
          {navEsq.map((t) => (
            <NavItem key={t.id} t={t} ativo={tab === t.id} corMarca={corMarca} onClick={() => setTab(t.id)} />
          ))}
          {temFab && (
            <button
              type="button"
              onClick={() => setEnviando(true)}
              aria-label="Enviar material pra SAL"
              className="touch-feedback mx-auto -mt-7 flex h-[58px] w-[58px] items-center justify-center rounded-[20px] text-white p5-float"
              style={{ background: corMarca }}
            >
              <Plus className="h-7 w-7" />
            </button>
          )}
          {navDir.map((t) => (
            <NavItem key={t.id} t={t} ativo={tab === t.id} corMarca={corMarca} onClick={() => setTab(t.id)} />
          ))}
        </div>
      </nav>

      {/* Modo Revisão — stories fullscreen */}
      {revisando && (
        <PortalRevisao
          token={token}
          clienteNome={clienteNome}
          corMarca={corMarca}
          permissoes={{
            verCalendario: permissoes.verCalendario,
            verCriativos: permissoes.verCriativos,
            podeAprovarPosts: permissoes.podeAprovarPosts,
            podeAprovarCriativos: permissoes.podeAprovarCriativos,
            podeComentar: permissoes.podeComentar,
          }}
          onFechar={fecharRevisao}
        />
      )}

      {/* Sheet de envio (FAB) */}
      {enviando && (
        <Dialog open onOpenChange={(o) => !o && setEnviando(false)}>
          <DialogContent className="dialog-bottom-sheet max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <div className="sm:hidden flex justify-center -mt-1 mb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            {/* Título acessível (o conteúdo da aba já tem o heading visual) */}
            <DialogTitle className="sr-only">Enviar material pra SAL</DialogTitle>
            <PortalEnviarTab token={token} clienteNome={clienteNome} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function NavItem({
  t,
  ativo,
  corMarca,
  onClick,
}: {
  t: { id: Tab; label: string; icon: typeof Sparkles; badge: number };
  ativo: boolean;
  corMarca: string;
  onClick: () => void;
}) {
  const Icon = t.icon;
  return (
    <button
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className="touch-feedback relative flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[54px]"
    >
      <span className="relative flex h-6 items-center justify-center">
        <Icon
          className="h-[19px] w-[19px]"
          style={{ color: ativo ? corMarca : "hsl(var(--muted-foreground))" }}
        />
        {t.badge > 0 && (
          <span
            className="absolute -right-2.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white ring-2 ring-background"
            style={{ background: corMarca }}
            aria-label={`${t.badge} pendências`}
          >
            {t.badge > 9 ? "9+" : t.badge}
          </span>
        )}
      </span>
      <span
        className={`text-[9.5px] leading-none ${ativo ? "font-bold" : "font-medium text-muted-foreground"}`}
        style={ativo ? { color: corMarca } : undefined}
      >
        {t.label}
      </span>
    </button>
  );
}
