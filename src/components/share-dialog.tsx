"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Copy, Lock, Trash2, ExternalLink, Loader2, Eye } from "lucide-react";

type ShareEntidade = "NOTA" | "BRIEFING" | "REUNIAO" | "RELATORIO";

type Share = {
  id: string;
  token: string;
  expiraEm: string | null;
  views: number;
  primeiroAcesso: string | null;
  ultimoAcesso: string | null;
};

const VALIDADE_OPCOES = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
  { value: "never", label: "Nunca expira" },
];

/**
 * Modal genérico de compartilhamento público.
 *
 * Lista shares ativos pra a entidade, permite criar novo (com expiração
 * + senha opcional), copiar URL, revogar.
 *
 * Reusável em qualquer página que tenha um botão "Compartilhar".
 */
export function ShareDialog({
  open,
  onOpenChange,
  entidadeTipo,
  entidadeId,
  entidadeNome,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entidadeTipo: ShareEntidade;
  entidadeId: string;
  entidadeNome: string;
}) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);

  const [validade, setValidade] = useState("30");
  const [usarSenha, setUsarSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/shares?entidadeTipo=${entidadeTipo}&entidadeId=${entidadeId}`)
      .then(async (r) => (r.ok ? r.json() : []))
      .then(setShares)
      .catch(() => setShares([]))
      .finally(() => setLoading(false));
  }, [open, entidadeTipo, entidadeId]);

  async function criar() {
    if (usarSenha && senha.trim().length < 4) {
      toast.error("Senha precisa de pelo menos 4 caracteres");
      return;
    }
    setCriando(true);
    try {
      const expiraEm =
        validade === "never"
          ? null
          : new Date(Date.now() + Number(validade) * 86_400_000).toISOString();

      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entidadeTipo,
          entidadeId,
          expiraEm,
          senha: usarSenha ? senha : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao criar");
      }
      const novo = await res.json();
      const url = `${window.location.origin}/p/share/${novo.token}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
      toast.success("Link criado e copiado", { description: url });
      setShares([novo, ...shares]);
      setUsarSenha(false);
      setSenha("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setCriando(false);
    }
  }

  async function revogar(id: string) {
    if (!confirm("Revogar este link? O cliente não vai conseguir mais abrir.")) return;
    const res = await fetch(`/api/shares/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao revogar");
      return;
    }
    setShares(shares.filter((s) => s.id !== id));
    toast.success("Link revogado");
  }

  async function copiar(token: string) {
    const url = `${window.location.origin}/p/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar publicamente</DialogTitle>
          <p className="text-[11px] text-muted-foreground">{entidadeNome}</p>
        </DialogHeader>

        {/* Form de criar */}
        <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Validade</Label>
              <Select value={validade} onValueChange={setValidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALIDADE_OPCOES.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={usarSenha}
                  onChange={(e) => setUsarSenha(e.target.checked)}
                  className="accent-sal-600"
                />
                <Lock className="h-3 w-3" />
                Proteger com senha
              </Label>
              {usarSenha && (
                <Input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                />
              )}
            </div>
          </div>
          <Button onClick={criar} disabled={criando} className="w-full" size="sm">
            {criando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Gerar link e copiar"}
          </Button>
        </div>

        {/* Lista de shares ativos */}
        {loading ? (
          <div className="text-center py-6">
            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : shares.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum link ativo. Crie o primeiro acima.
          </p>
        ) : (
          <div className="space-y-1">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Links ativos ({shares.length})
            </div>
            <ul className="space-y-1.5">
              {shares.map((s) => {
                const expirou = s.expiraEm && new Date(s.expiraEm) < new Date();
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-background/40"
                  >
                    <div className="flex-1 min-w-0 text-[11px] font-mono truncate">
                      /p/share/{s.token.slice(0, 12)}…
                    </div>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 shrink-0">
                      <Eye className="h-2.5 w-2.5" />
                      {s.views}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                      {expirou
                        ? "Expirou"
                        : s.expiraEm
                        ? `até ${new Date(s.expiraEm).toLocaleDateString("pt-BR")}`
                        : "permanente"}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copiar(s.token)} title="Copiar">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Abrir em nova aba"
                    >
                      <a href={`/p/share/${s.token}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 hover:text-destructive"
                      onClick={() => revogar(s.id)}
                      title="Revogar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
