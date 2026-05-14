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
import { Calendar, ListChecks, Mic, BarChart3, Lock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PortalCalendario } from "@/components/portal-calendario";
import { PortalTarefas } from "@/components/portal-tarefas";
import { PortalReunioes } from "@/components/portal-reunioes";
import { PortalRelatorios } from "@/components/portal-relatorios";

type Permissoes = {
  verCalendario: boolean;
  verTarefas: boolean;
  verReunioes: boolean;
  verRelatorios: boolean;
  podeAprovarPosts: boolean;
  podeComentar: boolean;
};

type EstadoInicial =
  | { tipo: "carregando" }
  | { tipo: "precisa-senha"; clienteNome: string }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "ok"; clienteId: string; clienteNome: string; permissoes: Permissoes };

type Tab = "calendario" | "tarefas" | "reunioes" | "relatorios";

export function PortalCliente({ token }: { token: string }) {
  const [estado, setEstado] = useState<EstadoInicial>({ tipo: "carregando" });
  const [tab, setTab] = useState<Tab>("calendario");
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
        setEstado({ tipo: "precisa-senha", clienteNome: data.clienteNome });
        return;
      }
      setEstado({
        tipo: "ok",
        clienteId: data.cliente.id,
        clienteNome: data.cliente.nome,
        permissoes: data.permissoes,
      });
      // Escolhe a primeira tab visível
      const p: Permissoes = data.permissoes;
      if (p.verCalendario) setTab("calendario");
      else if (p.verTarefas) setTab("tarefas");
      else if (p.verReunioes) setTab("reunioes");
      else if (p.verRelatorios) setTab("relatorios");
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-7 text-center space-y-3">
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-sm w-full">
          <CardContent className="p-7 space-y-4">
            <div className="text-center space-y-2">
              <div
                className="h-12 w-12 rounded-lg mx-auto flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
              >
                <Lock className="h-5 w-5 text-white" />
              </div>
              <h1 className="font-display text-lg font-semibold">Portal {estado.clienteNome}</h1>
              <p className="text-xs text-muted-foreground">SAL Estratégias de Marketing</p>
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                onKeyDown={(e) => e.key === "Enter" && entrarComSenha()}
                autoFocus
              />
              <Button
                onClick={entrarComSenha}
                disabled={!senha.trim() || autenticando}
                className="w-full"
                style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
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
  const { permissoes, clienteNome, clienteId } = estado;
  const tabsVisiveis: { id: Tab; label: string; icon: typeof Calendar; visivel: boolean }[] = [
    { id: "calendario", label: "Calendário", icon: Calendar, visivel: permissoes.verCalendario },
    { id: "tarefas", label: "Tarefas", icon: ListChecks, visivel: permissoes.verTarefas },
    { id: "reunioes", label: "Reuniões", icon: Mic, visivel: permissoes.verReunioes },
    { id: "relatorios", label: "Relatórios", icon: BarChart3, visivel: permissoes.verRelatorios },
  ];
  const visiveis = tabsVisiveis.filter((t) => t.visivel);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
          >
            <span className="text-white font-display text-sm font-semibold">S</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-sm sm:text-base font-semibold truncate">{clienteNome}</h1>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground">SAL Estratégias de Marketing</p>
          </div>
        </div>

        {/* Tabs */}
        {visiveis.length > 1 && (
          <nav className="max-w-5xl mx-auto px-2 sm:px-6 flex gap-1 overflow-x-auto pb-1 border-t border-border/30">
            {visiveis.map((t) => {
              const Icon = t.icon;
              const ativo = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors ${
                    ativo
                      ? "text-foreground border-b-2 border-primary -mb-px"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Conteúdo */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {tab === "calendario" && permissoes.verCalendario && (
          <PortalCalendario
            token={token}
            podeAprovar={permissoes.podeAprovarPosts}
            podeComentar={permissoes.podeComentar}
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

      <footer className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-[10.5px] text-muted-foreground/70">
        SAL Estratégias de Marketing · Portal do Cliente
      </footer>
    </div>
  );
}
