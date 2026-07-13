"use client";
/**
 * Portal do Cliente v4 — área pública por cliente.
 *
 * Navegação em 4 abas (era 7 — bottom-nav mobile ficava espremida):
 *   Início    → o que precisa de você + entregas do mês
 *   Conteúdo  → posts + anúncios unificados (aprovação/acompanhamento)
 *   Enviar    → caixa de entrada de material do cliente
 *   Mais      → Briefings, Relatórios, Reuniões, Tarefas, contato
 *
 * Fluxo:
 *  1. GET /api/p/cliente/[token] → info + permissões (ou pede senha)
 *  2. Se precisa senha → tela de login → POST com senha → cria sessão
 *  3. Sessão expirada em QUALQUER fetch → evento global → volta pra
 *     tela de entrada (nada de "portal vazio" silencioso)
 *
 * Deep-link por hash: #conteudo · #enviar · #mais · #revisar (abre o
 * Modo Revisão direto — pronto pros e-mails de notificação da Fase 1).
 *
 * Layout próprio (não usa Sidebar/Header do app). Mobile-first.
 */
import { useEffect, useState } from "react";
import { Sparkles, LayoutGrid, UploadCloud, Menu, Lock, Loader2, XCircle, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { EVENTO_SESSAO_EXPIRADA } from "@/lib/portal-fetch";
import { PortalInicio } from "@/components/portal-inicio";
import { PortalConteudo } from "@/components/portal-conteudo";
import { PortalEnviarTab } from "@/components/portal-enviar-tab";
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

/** Itens aguardando a aprovação DESTE cliente (alimenta badges + home). */
type Pendencias = { posts: number; criativos: number };

type EstadoInicial =
  | { tipo: "carregando" }
  | { tipo: "precisa-senha"; clienteNome: string; marca: Marca }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "ok"; clienteId: string; clienteNome: string; permissoes: Permissoes; marca: Marca };

export type Tab = "inicio" | "conteudo" | "enviar" | "mais";

/** Estado dos briefings do cliente (badge na aba Mais). */
type BriefingsResumo = { total: number; pendentes: number };

/** Roxo SAL (default). Acento da marca só substitui quando difere disso. */
const COR_SAL = "#7E30E1";

/** Valida hex #RRGGBB; retorna null se inválido (não confia em dado do banco). */
function sanitizarHex(cor: string | null | undefined): string | null {
  if (!cor) return null;
  return /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : null;
}

/** Aba inicial via hash da URL (deep-link de e-mails/atalhos). */
function tabDoHash(): { tab: Tab; revisar: boolean } {
  if (typeof window === "undefined") return { tab: "inicio", revisar: false };
  const h = window.location.hash.replace("#", "");
  if (h === "revisar") return { tab: "inicio", revisar: true };
  if (h === "conteudo" || h === "enviar" || h === "mais") return { tab: h, revisar: false };
  return { tab: "inicio", revisar: false };
}

export function PortalCliente({ token }: { token: string }) {
  const [estado, setEstado] = useState<EstadoInicial>({ tipo: "carregando" });
  const [tab, setTab] = useState<Tab>("inicio");
  const [senha, setSenha] = useState("");
  const [autenticando, setAutenticando] = useState(false);
  const [pendencias, setPendencias] = useState<Pendencias>({ posts: 0, criativos: 0 });
  const [briefingsResumo, setBriefingsResumo] = useState<BriefingsResumo>({ total: 0, pendentes: 0 });
  const [revisando, setRevisando] = useState(false);
  // Muda pra forçar remount da aba Conteúdo após o Modo Revisão agir.
  const [versaoConteudo, setVersaoConteudo] = useState(0);

  // Pendências de aprovação (badges + bloco "Esperando você"). Lê do /resumo.
  async function recarregarPendencias() {
    try {
      const res = await fetch(`/api/p/cliente/${token}/resumo`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.pendencias) {
        setPendencias({
          posts: Number(data.pendencias.posts) || 0,
          criativos: Number(data.pendencias.criativos) || 0,
        });
      }
    } catch {
      /* ignora — badges são complementares */
    }
  }

  // Briefings do cliente (aba Mais + badge de pendentes).
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
      /* ignora — aba/badge são complementares */
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
        // Senha errada / rate limit: continua na tela de senha com aviso —
        // não derruba pro estado de erro terminal.
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
      // Aba inicial: respeita deep-link (#conteudo/#enviar/#mais/#revisar).
      const { tab: tabInicial, revisar } = tabDoHash();
      setTab(tabInicial);
      if (revisar) setRevisando(true);
      // Carrega badges (não bloqueia render).
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

  // Sessão expirou em qualquer fetch do portal → volta pra tela de entrada.
  useEffect(() => {
    function aoExpirar() {
      setRevisando(false);
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (estado.tipo === "erro") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background safe-area-inset-top safe-area-inset-bottom">
        <Card className="max-w-md w-full">
          <CardContent className="p-5 sm:p-7 text-center space-y-3">
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
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background safe-area-inset-top safe-area-inset-bottom">
        <Card className="max-w-sm w-full">
          <CardContent className="p-5 sm:p-7 space-y-4">
            <div className="text-center space-y-2">
              {estado.marca.logoUrl ? (
                <div className="h-14 w-14 rounded-2xl mx-auto flex items-center justify-center overflow-hidden bg-white border border-border shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={estado.marca.logoUrl}
                    alt={estado.clienteNome}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-xl mx-auto flex items-center justify-center bg-primary shadow-sm">
                  <Lock className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <h1 className="font-display text-lg font-semibold">Portal {estado.clienteNome}</h1>
              <p className="text-xs text-muted-foreground">entregue por SAL Estratégias de Marketing</p>
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
                className="h-11 text-base sm:text-sm"
              />
              <Button
                onClick={entrarComSenha}
                disabled={!senha.trim() || autenticando}
                className="w-full h-11 text-sm touch-feedback"
              >
                {autenticando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado OK — renderiza portal completo
  const { permissoes, clienteNome, marca } = estado;
  // Acento da marca: só aplica se for um hex válido E diferente do roxo SAL.
  const acento = sanitizarHex(marca.corPrimaria);
  const temAcento = !!acento && acento.toUpperCase() !== COR_SAL;
  const corAtiva = temAcento ? acento! : undefined;

  const verConteudo = permissoes.verCalendario || permissoes.verCriativos;
  const totalPendencias = pendencias.posts + pendencias.criativos;

  const tabsVisiveis: {
    id: Tab;
    label: string;
    icon: typeof Sparkles;
    visivel: boolean;
    badge: number;
  }[] = [
    { id: "inicio", label: "Início", icon: Sparkles, visivel: true, badge: 0 },
    { id: "conteudo", label: "Conteúdo", icon: LayoutGrid, visivel: verConteudo, badge: totalPendencias },
    { id: "enviar", label: "Enviar", icon: UploadCloud, visivel: permissoes.podeEnviarConteudo, badge: 0 },
    { id: "mais", label: "Mais", icon: Menu, visivel: true, badge: briefingsResumo.pendentes },
  ];
  const visiveis = tabsVisiveis.filter((t) => t.visivel);
  const temBottomNav = visiveis.length > 1;

  function fecharRevisao(agiu: boolean) {
    setRevisando(false);
    if (agiu) {
      void recarregarPendencias();
      setVersaoConteudo((v) => v + 1);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      {/* Header — sticky com safe area pra notch iOS */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-md safe-area-inset-top">
        {/* Acento sutil da marca do cliente */}
        {temAcento && <div className="h-[3px] w-full" style={{ background: corAtiva }} />}
        <div className="max-w-2xl lg:max-w-3xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3">
          {marca.logoUrl ? (
            <div
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white border border-border shadow-sm"
              style={temAcento ? { boxShadow: `0 0 0 1px ${corAtiva}33` } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={marca.logoUrl} alt={clienteNome} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 bg-primary shadow-sm">
              <span className="text-primary-foreground font-display text-sm sm:text-base font-bold">S</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[13px] sm:text-base font-semibold truncate leading-tight">{clienteNome}</h1>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight">
              entregue por SAL Estratégias de Marketing
            </p>
          </div>
          {/* Atalho de revisão no header (desktop) quando há pendência */}
          {totalPendencias > 0 && verConteudo && (
            <button
              type="button"
              onClick={() => setRevisando(true)}
              className="touch-feedback hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              style={temAcento ? { background: corAtiva } : undefined}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Revisar ({totalPendencias})
            </button>
          )}
        </div>

        {/* Tabs no TOPO — só em >= sm (no mobile vira bottom-nav app-like) */}
        {visiveis.length > 1 && (
          <nav className="hidden sm:flex max-w-2xl lg:max-w-3xl mx-auto px-6 gap-1 border-t border-border/30">
            {visiveis.map((t) => {
              const Icon = t.icon;
              const ativo = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`touch-feedback flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors relative ${
                    ativo
                      ? temAcento
                        ? ""
                        : "text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                      : "text-muted-foreground active:text-foreground hover:text-foreground"
                  }`}
                  style={
                    ativo && temAcento
                      ? { color: corAtiva, boxShadow: `inset 0 -2px 0 0 ${corAtiva}` }
                      : undefined
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {t.badge > 0 && <ContadorBadge n={t.badge} acento={corAtiva} />}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Conteúdo — padding-bottom extra no mobile pra não ficar atrás da bottom-nav */}
      <main
        className={`max-w-2xl lg:max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-5 ${
          temBottomNav ? "pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-5" : ""
        }`}
      >
        {tab === "inicio" && (
          <PortalInicio
            token={token}
            clienteNome={clienteNome}
            acento={corAtiva}
            pendencias={pendencias}
            briefingsPendentes={briefingsResumo.pendentes}
            podeRevisar={verConteudo && (permissoes.podeAprovarPosts || permissoes.podeAprovarCriativos)}
            podeEnviar={permissoes.podeEnviarConteudo}
            onRevisar={() => setRevisando(true)}
            onIrParaTab={(t) => setTab(t)}
          />
        )}
        {tab === "conteudo" && verConteudo && (
          <PortalConteudo
            key={versaoConteudo}
            token={token}
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
        {tab === "enviar" && permissoes.podeEnviarConteudo && (
          <PortalEnviarTab token={token} clienteNome={clienteNome} />
        )}
        {tab === "mais" && (
          <PortalMais
            token={token}
            clienteNome={clienteNome}
            permissoes={{
              verTarefas: permissoes.verTarefas,
              verReunioes: permissoes.verReunioes,
              verRelatorios: permissoes.verRelatorios,
            }}
            briefingsPendentes={briefingsResumo.pendentes}
            temBriefings={briefingsResumo.total > 0}
            onPendenciasMudaram={recarregarBriefings}
          />
        )}
      </main>

      <footer
        className={`max-w-2xl lg:max-w-3xl mx-auto px-3 sm:px-6 py-6 text-center text-[10.5px] text-muted-foreground/70 ${
          temBottomNav ? "hidden sm:block" : "safe-area-inset-bottom"
        }`}
      >
        SAL Estratégias de Marketing · Portal do Cliente
      </footer>

      {/* Bottom-nav app-like — só no mobile (< sm). 4 abas, alcance do polegar. */}
      {temBottomNav && (
        <nav
          className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
          aria-label="Navegação principal"
        >
          <div className="mx-auto flex max-w-2xl items-stretch justify-around">
            {visiveis.map((t) => {
              const Icon = t.icon;
              const ativo = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={ativo ? "page" : undefined}
                  className="touch-feedback relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px]"
                >
                  <span
                    className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                      ativo && !temAcento ? "bg-primary" : ""
                    }`}
                    style={ativo && temAcento ? { background: corAtiva } : undefined}
                  >
                    <Icon className={`h-[18px] w-[18px] ${ativo ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    {t.badge > 0 && (
                      <span
                        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-card"
                        style={temAcento ? { background: corAtiva } : undefined}
                        aria-label={`${t.badge} pendências`}
                      >
                        {t.badge > 9 ? "9+" : t.badge}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] leading-none ${
                      ativo
                        ? temAcento
                          ? "font-semibold"
                          : "text-primary font-semibold"
                        : "text-muted-foreground font-medium"
                    }`}
                    style={ativo && temAcento ? { color: corAtiva } : undefined}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Modo Revisão — overlay fullscreen (fila item a item) */}
      {revisando && (
        <PortalRevisao
          token={token}
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
    </div>
  );
}

/**
 * Badge de contagem das top-tabs (≥ sm) — pílula pequena com o nº de itens
 * aguardando. Usa o acento da marca quando há; senão, primary.
 */
function ContadorBadge({ n, acento }: { n: number; acento?: string }) {
  return (
    <span
      className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground"
      style={acento ? { background: acento } : undefined}
      aria-label={`${n} pendências`}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}
