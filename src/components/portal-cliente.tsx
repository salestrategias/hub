"use client";
/**
 * Portal do Cliente — área pública por cliente.
 *
 * Fluxo:
 *  1. GET /api/p/cliente/[token] → info + permissões (ou pede senha)
 *  2. Se precisa senha → tela de login → POST com senha → cria sessão
 *  3. Tabs: Calendário | Tarefas | Reuniões | Relatórios (filtradas
 *     por permissão)
 *
 * Layout próprio (não usa Sidebar/Header do app). Mobile-first.
 */
import { useEffect, useState } from "react";
import { Sparkles, Calendar, Megaphone, ListChecks, Mic, BarChart3, Lock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PortalInicio } from "@/components/portal-inicio";
import { PortalCalendario } from "@/components/portal-calendario";
import { PortalCriativos } from "@/components/portal-criativos";
import { PortalTarefas } from "@/components/portal-tarefas";
import { PortalReunioes } from "@/components/portal-reunioes";
import { PortalRelatorios } from "@/components/portal-relatorios";

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

type EstadoInicial =
  | { tipo: "carregando" }
  | { tipo: "precisa-senha"; clienteNome: string; marca: Marca }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "ok"; clienteId: string; clienteNome: string; permissoes: Permissoes; marca: Marca };

type Tab = "inicio" | "calendario" | "criativos" | "tarefas" | "reunioes" | "relatorios";

/** Roxo SAL (default). Acento da marca só substitui quando difere disso. */
const COR_SAL = "#7E30E1";

/** Valida hex #RRGGBB; retorna null se inválido (não confia em dado do banco). */
function sanitizarHex(cor: string | null | undefined): string | null {
  if (!cor) return null;
  return /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : null;
}

export function PortalCliente({ token }: { token: string }) {
  const [estado, setEstado] = useState<EstadoInicial>({ tipo: "carregando" });
  const [tab, setTab] = useState<Tab>("inicio");
  const [senha, setSenha] = useState("");
  const [autenticando, setAutenticando] = useState(false);

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
      // Início é a primeira tab e existe sempre — cliente cai nela ao abrir.
      setTab("inicio");
    } catch (e) {
      setEstado({ tipo: "erro", mensagem: e instanceof Error ? e.message : "Erro" });
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const { permissoes, clienteNome, clienteId, marca } = estado;
  // Acento da marca: só aplica se for um hex válido E diferente do roxo SAL
  // (quando é o default, os tokens `primary` já dão conta — sem inline).
  const acento = sanitizarHex(marca.corPrimaria);
  const temAcento = !!acento && acento.toUpperCase() !== COR_SAL;
  const corAtiva = temAcento ? acento! : undefined;
  const tabsVisiveis: { id: Tab; label: string; labelCurto: string; icon: typeof Calendar; visivel: boolean }[] = [
    { id: "inicio", label: "Início", labelCurto: "Início", icon: Sparkles, visivel: true },
    { id: "calendario", label: "Calendário", labelCurto: "Agenda", icon: Calendar, visivel: permissoes.verCalendario },
    { id: "criativos", label: "Criativos", labelCurto: "Criativos", icon: Megaphone, visivel: permissoes.verCriativos },
    { id: "tarefas", label: "Tarefas", labelCurto: "Tarefas", icon: ListChecks, visivel: permissoes.verTarefas },
    { id: "reunioes", label: "Reuniões", labelCurto: "Reuniões", icon: Mic, visivel: permissoes.verReunioes },
    { id: "relatorios", label: "Relatórios", labelCurto: "Relatórios", icon: BarChart3, visivel: permissoes.verRelatorios },
  ];
  const visiveis = tabsVisiveis.filter((t) => t.visivel);
  const temBottomNav = visiveis.length > 1;

  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      {/* Header — sticky com safe area pra notch iOS */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-md safe-area-inset-top">
        {/* Acento sutil da marca do cliente — fininho, não quebra o clean */}
        {temAcento && <div className="h-[3px] w-full" style={{ background: corAtiva }} />}
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3">
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
        </div>

        {/* Tabs no TOPO — só em >= sm (no mobile vira bottom-nav app-like) */}
        {visiveis.length > 1 && (
          <nav className="hidden sm:flex max-w-5xl mx-auto px-6 gap-1 portal-tabs-scroll overflow-x-auto border-t border-border/30">
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
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Conteúdo — padding-bottom extra no mobile pra não ficar atrás da bottom-nav */}
      <main
        className={`max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-5 ${
          temBottomNav ? "pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-5" : ""
        }`}
      >
        {tab === "inicio" && (
          <PortalInicio token={token} clienteNome={clienteNome} acento={corAtiva} />
        )}
        {tab === "calendario" && permissoes.verCalendario && (
          <PortalCalendario
            token={token}
            podeAprovar={permissoes.podeAprovarPosts}
            podeComentar={permissoes.podeComentar}
            podeEnviar={permissoes.podeEnviarConteudo}
          />
        )}
        {tab === "criativos" && permissoes.verCriativos && (
          <PortalCriativos
            token={token}
            podeAprovar={permissoes.podeAprovarCriativos}
            podeComentar={permissoes.podeComentar}
            podeEnviar={permissoes.podeEnviarConteudo}
          />
        )}
        {tab === "tarefas" && permissoes.verTarefas && <PortalTarefas token={token} />}
        {tab === "reunioes" && permissoes.verReunioes && <PortalReunioes token={token} />}
        {tab === "relatorios" && permissoes.verRelatorios && (
          <PortalRelatorios clienteId={clienteId} />
        )}
        {visiveis.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nada habilitado pra exibir. Entre em contato com a SAL.
            </CardContent>
          </Card>
        )}
      </main>

      <footer
        className={`max-w-5xl mx-auto px-3 sm:px-6 py-6 text-center text-[10.5px] text-muted-foreground/70 ${
          temBottomNav ? "hidden sm:block" : "safe-area-inset-bottom"
        }`}
      >
        SAL Estratégias de Marketing · Portal do Cliente
      </footer>

      {/* Bottom-nav app-like — só no mobile (< sm). Tabs fixas no rodapé,
          alcance do polegar. Tab ativa destacada na cor SAL. */}
      {temBottomNav && (
        <nav
          className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
          aria-label="Navegação principal"
        >
          <div className="mx-auto flex max-w-5xl items-stretch justify-around">
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
                    className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                      ativo && !temAcento ? "bg-primary" : ""
                    }`}
                    style={ativo && temAcento ? { background: corAtiva } : undefined}
                  >
                    <Icon className={`h-[18px] w-[18px] ${ativo ? "text-primary-foreground" : "text-muted-foreground"}`} />
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
                    {t.labelCurto}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
