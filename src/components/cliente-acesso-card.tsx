"use client";
/**
 * Card de gerenciamento do Portal do Cliente — renderizado dentro
 * do ClienteSheet. Permite habilitar/desabilitar, configurar
 * permissões (toggles), gerar senha, e copiar URL pro cliente.
 */
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import {
  ExternalLink, Copy, Lock, LockOpen, Loader2, ShieldCheck, Eye, EyeOff,
} from "lucide-react";

type AcessoInfo = {
  id: string;
  token: string;
  ativo: boolean;
  temSenha: boolean;
  verCalendario: boolean;
  verCriativos: boolean;
  verTarefas: boolean;
  verReunioes: boolean;
  verRelatorios: boolean;
  podeAprovarPosts: boolean;
  podeAprovarCriativos: boolean;
  podeComentar: boolean;
  ultimoAcesso: string | null;
  totalAcessos: number;
};

export function ClienteAcessoCard({ clienteId }: { clienteId: string }) {
  const [acesso, setAcesso] = useState<AcessoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/acesso`);
      const data = await res.json();
      setAcesso(data && data.id ? data : null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  async function patch(body: Record<string, unknown>) {
    setSalvando(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/acesso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao salvar");
        return;
      }
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function criar() {
    await patch({ ativo: true });
    toast.success("Acesso criado");
  }

  async function setSenha() {
    if (!novaSenha.trim() || novaSenha.length < 4) {
      toast.error("Mínimo 4 caracteres");
      return;
    }
    await patch({ senha: novaSenha });
    setNovaSenha("");
    toast.success("Senha definida");
  }

  async function removerSenha() {
    if (!confirm("Remover senha? Qualquer um com o link poderá acessar.")) return;
    await patch({ senha: null });
    toast.success("Senha removida");
  }

  async function desabilitar() {
    if (!confirm("Desabilitar acesso? O cliente perde acesso imediato — pode reabilitar depois.")) return;
    await patch({ ativo: false });
    toast.success("Acesso desabilitado");
  }

  async function reabilitar() {
    await patch({ ativo: true });
    toast.success("Acesso reabilitado");
  }

  function copiarUrl() {
    if (!acesso) return;
    const url = `${window.location.origin}/p/cliente/${acesso.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!acesso) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">Portal do Cliente</span>
            <Badge variant="muted" className="text-[10px] ml-auto">Não configurado</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Habilita uma área privada onde este cliente vê calendário editorial, tarefas, reuniões e
            pode aprovar/pedir ajuste nos posts. Sem precisar criar conta.
          </p>
          <Button size="sm" onClick={criar} disabled={salvando} className="w-full">
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Habilitar acesso
          </Button>
        </CardContent>
      </Card>
    );
  }

  const url = typeof window !== "undefined" ? `${window.location.origin}/p/cliente/${acesso.token}` : "";

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-sal-400" />
          <span className="text-sm font-medium">Portal do Cliente</span>
          {acesso.ativo ? (
            <Badge variant="success" className="text-[10px] ml-auto">Ativo</Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px] ml-auto">Desabilitado</Badge>
          )}
        </div>

        {/* URL + Copiar */}
        <div className="space-y-1.5">
          <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Link do cliente</Label>
          <div className="flex gap-1.5">
            <Input value={url} readOnly className="text-[11px] font-mono" onClick={(e) => (e.target as HTMLInputElement).select()} />
            <Button size="icon" variant="outline" onClick={copiarUrl} className="shrink-0" title="Copiar link">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" asChild className="shrink-0">
              <a href={url} target="_blank" rel="noreferrer" title="Abrir como cliente">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Senha */}
        <div className="space-y-1.5">
          <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            {acesso.temSenha ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
            Senha {acesso.temSenha ? "(definida)" : "(sem senha — qualquer um com o link entra)"}
          </Label>
          <div className="flex gap-1.5">
            <Input
              type={mostrarSenha ? "text" : "password"}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder={acesso.temSenha ? "Definir nova senha" : "Adicionar senha (opcional)"}
              className="text-[12px]"
            />
            <Button size="icon" variant="ghost" onClick={() => setMostrarSenha((v) => !v)} className="shrink-0">
              {mostrarSenha ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" onClick={setSenha} disabled={!novaSenha.trim() || salvando}>
              Salvar
            </Button>
          </div>
          {acesso.temSenha && (
            <button onClick={removerSenha} className="text-[10.5px] text-destructive hover:underline">
              Remover senha
            </button>
          )}
        </div>

        {/* Toggles de permissão */}
        <div className="space-y-1.5 pt-1 border-t border-border">
          <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">O que o cliente vê</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Toggle label="Calendário editorial" ativo={acesso.verCalendario} onToggle={() => patch({ verCalendario: !acesso.verCalendario })} />
            <Toggle label="Criativos de anúncio" ativo={acesso.verCriativos} onToggle={() => patch({ verCriativos: !acesso.verCriativos })} />
            <Toggle label="Relatórios mensais" ativo={acesso.verRelatorios} onToggle={() => patch({ verRelatorios: !acesso.verRelatorios })} />
            <Toggle label="Tarefas em andamento" ativo={acesso.verTarefas} onToggle={() => patch({ verTarefas: !acesso.verTarefas })} />
            <Toggle label="Reuniões + actions" ativo={acesso.verReunioes} onToggle={() => patch({ verReunioes: !acesso.verReunioes })} />
            <Toggle label="Aprovar posts" ativo={acesso.podeAprovarPosts} onToggle={() => patch({ podeAprovarPosts: !acesso.podeAprovarPosts })} />
            <Toggle label="Aprovar criativos" ativo={acesso.podeAprovarCriativos} onToggle={() => patch({ podeAprovarCriativos: !acesso.podeAprovarCriativos })} />
            <Toggle label="Pedir ajustes" ativo={acesso.podeComentar} onToggle={() => patch({ podeComentar: !acesso.podeComentar })} />
          </div>
        </div>

        {/* Audit */}
        <div className="pt-1 border-t border-border text-[10.5px] text-muted-foreground space-y-0.5">
          <div>
            Acessos totais: <strong className="text-foreground">{acesso.totalAcessos}</strong>
          </div>
          {acesso.ultimoAcesso && (
            <div>
              Último acesso:{" "}
              <span className="font-mono">
                {new Date(acesso.ultimoAcesso).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Ações destrutivas */}
        <div className="flex gap-1.5">
          {acesso.ativo ? (
            <Button size="sm" variant="outline" onClick={desabilitar} className="flex-1 text-destructive hover:text-destructive">
              Desabilitar acesso
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={reabilitar} className="flex-1">
              Reabilitar acesso
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Toggle({ label, ativo, onToggle }: { label: string; ativo: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-[11.5px] transition-colors ${
        ativo
          ? "border-primary/40 bg-primary/5 text-foreground"
          : "border-border text-muted-foreground hover:border-primary/30"
      }`}
    >
      <span>{label}</span>
      <span
        className={`w-7 h-3.5 rounded-full relative transition-colors ${ativo ? "bg-primary" : "bg-border"}`}
      >
        <span
          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${
            ativo ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
