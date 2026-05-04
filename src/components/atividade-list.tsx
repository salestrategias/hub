"use client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, LogIn, LogOut, KeyRound, UserCog, Cpu, ShieldAlert, Globe,
  Smartphone, Monitor, Tablet,
} from "lucide-react";
import { parseUserAgent } from "@/lib/user-agent";

type Tipo =
  | "LOGIN_OK" | "LOGIN_FALHOU" | "MUDANCA_SENHA" | "MUDANCA_PERFIL"
  | "TOKEN_MCP_CRIADO" | "TOKEN_MCP_REVOGADO" | "TOKEN_MCP_ESCOPOS_ALTERADOS"
  | "GOOGLE_CONECTADO";

type Atividade = {
  id: string;
  tipo: Tipo;
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

const TIPO_INFO: Record<Tipo, { label: string; icon: React.ReactNode; cor: string }> = {
  LOGIN_OK: { label: "Login bem-sucedido", icon: <LogIn className="h-3.5 w-3.5" />, cor: "#10B981" },
  LOGIN_FALHOU: { label: "Tentativa de login falhada", icon: <ShieldAlert className="h-3.5 w-3.5" />, cor: "#EF4444" },
  MUDANCA_SENHA: { label: "Senha alterada", icon: <KeyRound className="h-3.5 w-3.5" />, cor: "#7E30E1" },
  MUDANCA_PERFIL: { label: "Perfil atualizado", icon: <UserCog className="h-3.5 w-3.5" />, cor: "#3B82F6" },
  TOKEN_MCP_CRIADO: { label: "Token MCP criado", icon: <Cpu className="h-3.5 w-3.5" />, cor: "#10B981" },
  TOKEN_MCP_REVOGADO: { label: "Token MCP revogado", icon: <Cpu className="h-3.5 w-3.5" />, cor: "#EF4444" },
  TOKEN_MCP_ESCOPOS_ALTERADOS: { label: "Escopos de token MCP alterados", icon: <Cpu className="h-3.5 w-3.5" />, cor: "#F59E0B" },
  GOOGLE_CONECTADO: { label: "Google conectado", icon: <Globe className="h-3.5 w-3.5" />, cor: "#3B82F6" },
};

const FILTROS: { key: "todos" | "auth" | "perfil" | "mcp"; label: string }[] = [
  { key: "todos", label: "Tudo" },
  { key: "auth", label: "Logins" },
  { key: "perfil", label: "Perfil & senha" },
  { key: "mcp", label: "MCP / Claude" },
];

const FILTRO_TIPOS: Record<string, Tipo[]> = {
  auth: ["LOGIN_OK", "LOGIN_FALHOU", "GOOGLE_CONECTADO"],
  perfil: ["MUDANCA_SENHA", "MUDANCA_PERFIL"],
  mcp: ["TOKEN_MCP_CRIADO", "TOKEN_MCP_REVOGADO", "TOKEN_MCP_ESCOPOS_ALTERADOS"],
};

export function AtividadeList({ atividades }: { atividades: Atividade[] }) {
  const [filtro, setFiltro] = useState<"todos" | "auth" | "perfil" | "mcp">("todos");

  const filtradas = useMemo(() => {
    if (filtro === "todos") return atividades;
    const tipos = FILTRO_TIPOS[filtro];
    return atividades.filter((a) => tipos.includes(a.tipo));
  }, [atividades, filtro]);

  const ultimoLogin = atividades.find((a) => a.tipo === "LOGIN_OK");
  const tentativasFalhas = atividades.filter((a) => a.tipo === "LOGIN_FALHOU").length;

  return (
    <Card className="mt-5">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-display font-semibold text-[15px] flex items-center gap-2">
              <Activity className="h-4 w-4" /> Atividade da conta
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Últimos 50 eventos de segurança e mudanças relevantes
            </div>
          </div>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <TabsList>
              {FILTROS.map((f) => <TabsTrigger key={f.key} value={f.key}>{f.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>

        {(ultimoLogin || tentativasFalhas > 0) && (
          <div className="grid md:grid-cols-2 gap-3">
            {ultimoLogin && (
              <UltimoLoginCard atividade={ultimoLogin} />
            )}
            {tentativasFalhas > 0 && (
              <Card className="border-amber-500/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{tentativasFalhas} tentativa(s) de login falharam</div>
                    <div className="text-[11px] text-muted-foreground">Nos últimos 50 eventos. Se não foi você, troque a senha.</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="space-y-1">
          {filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade nesse filtro.</p>
          ) : (
            filtradas.map((a) => <Linha key={a.id} a={a} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UltimoLoginCard({ atividade }: { atividade: Atividade }) {
  const { dispositivo, navegador, os } = parseUserAgent(atividade.userAgent);
  const Icon = dispositivo === "Celular" ? Smartphone : dispositivo === "Tablet" ? Tablet : Monitor;
  return (
    <Card className="border-emerald-500/30">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-md flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
          <Icon className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <div className="text-sm font-medium">Último login bem-sucedido</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {navegador} no {os} ({dispositivo}) · {atividade.ip ?? "IP desconhecido"} · {formatRel(atividade.createdAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Linha({ a }: { a: Atividade }) {
  const info = TIPO_INFO[a.tipo];
  const { dispositivo, navegador, os } = parseUserAgent(a.userAgent);
  const meta = a.meta ?? {};
  const provider = (meta as { provider?: string }).provider;
  const tokenNome = (meta as { nome?: string }).nome;

  return (
    <div className="flex items-start gap-3 py-2.5 px-2 rounded-md hover:bg-secondary/40 transition border-b border-border/40 last:border-0">
      <div
        className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${info.cor}20`, color: info.cor }}
      >
        {info.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium flex items-center gap-2 flex-wrap">
          {info.label}
          {provider && <Badge variant="outline" className="text-[10px]">{provider}</Badge>}
          {tokenNome && <code className="text-[10.5px] font-mono bg-secondary/60 border border-border rounded px-1.5 py-px">{tokenNome}</code>}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{navegador} no {os}</span>
          {a.ip && <><span>·</span><span className="font-mono">{a.ip}</span></>}
          <span>·</span>
          <span>{formatAbs(a.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function formatRel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatAbs(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
