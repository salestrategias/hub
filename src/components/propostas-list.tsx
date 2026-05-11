"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";
import { MoneyValue } from "@/components/money-value";
import {
  Plus,
  Search,
  FileSignature,
  ExternalLink,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Proposta = {
  id: string;
  numero: string;
  titulo: string;
  clienteNome: string;
  clienteId: string | null;
  status: "RASCUNHO" | "ENVIADA" | "VISTA" | "ACEITA" | "RECUSADA" | "EXPIRADA";
  valorMensal: number | null;
  valorTotal: number | null;
  shareToken: string | null;
  shareExpiraEm: string | null;
  shareViews: number;
  enviadaEm: string | null;
  aceitaEm: string | null;
  updatedAt: string;
};

type Cliente = { id: string; nome: string; email: string | null };

const STATUS_LABEL: Record<Proposta["status"], string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  VISTA: "Vista",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
};

const STATUS_COR: Record<Proposta["status"], { bg: string; text: string; border: string; Icon: React.ComponentType<{ className?: string }> }> = {
  RASCUNHO: { bg: "bg-secondary", text: "text-muted-foreground", border: "border-border", Icon: PenLine },
  ENVIADA: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", Icon: Clock },
  VISTA: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", Icon: Eye },
  ACEITA: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", Icon: CheckCircle2 },
  RECUSADA: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30", Icon: XCircle },
  EXPIRADA: { bg: "bg-secondary", text: "text-muted-foreground", border: "border-border", Icon: Clock },
};

const TABS: Array<Proposta["status"] | "TODAS"> = ["TODAS", "RASCUNHO", "ENVIADA", "VISTA", "ACEITA", "RECUSADA"];

export function PropostasList({ initial, clientes }: { initial: Proposta[]; clientes: Cliente[] }) {
  const router = useRouter();
  const [propostas] = useState(initial);
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<Proposta["status"] | "TODAS">("TODAS");
  const [criando, setCriando] = useState(false);

  const filtradas = useMemo(() => {
    return propostas.filter((p) => {
      if (tab !== "TODAS" && p.status !== tab) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return (
          p.numero.toLowerCase().includes(q) ||
          p.titulo.toLowerCase().includes(q) ||
          p.clienteNome.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [propostas, tab, busca]);

  if (propostas.length === 0) {
    return (
      <>
        <EmptyState
          icon={FileSignature}
          titulo="Nenhuma proposta criada ainda"
          descricao="Crie propostas comerciais padronizadas pra mandar via link pro cliente — com aceite digital, expiração e exportação PDF. Numeração automática por ano (2026-001, 2026-002...)."
          acaoLabel="Criar primeira proposta"
          acaoIcon={Plus}
          acaoOnClick={() => setCriando(true)}
        />
        {criando && <NovaPropostaDialog open={criando} onOpenChange={setCriando} clientes={clientes} />}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por número, título ou cliente..."
            className="pl-8 h-9"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtradas.length} de {propostas.length}
        </span>
        <Button onClick={() => setCriando(true)} size="sm">
          <Plus className="h-4 w-4" /> Nova proposta
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Proposta["status"] | "TODAS")}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t === "TODAS" ? "Todas" : STATUS_LABEL[t as Proposta["status"]]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={Search}
          titulo="Nenhuma proposta nesse filtro"
          descricao="Ajuste a busca ou troca de aba."
          variante="compact"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {filtradas.map((p) => (
                <li key={p.id}>
                  <PropostaRow proposta={p} onCopiarLink={() => copiarLink(p)} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {criando && <NovaPropostaDialog open={criando} onOpenChange={setCriando} clientes={clientes} />}
    </div>
  );

  async function copiarLink(p: Proposta) {
    if (!p.shareToken) {
      toast.error("Esta proposta ainda não foi enviada. Abra e clique em 'Enviar'.");
      return;
    }
    const url = `${window.location.origin}/p/proposta/${p.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: url });
    } catch {
      toast.error("Falha ao copiar");
    }
  }
}

function PropostaRow({ proposta: p, onCopiarLink }: { proposta: Proposta; onCopiarLink: () => void }) {
  const cor = STATUS_COR[p.status];
  const Icon = cor.Icon;

  return (
    <Link
      href={`/propostas/${p.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 transition group"
    >
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums w-20 shrink-0">{p.numero}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{p.titulo}</div>
        <div className="text-[11px] text-muted-foreground truncate">{p.clienteNome}</div>
      </div>
      {p.valorMensal && (
        <div className="hidden md:flex flex-col items-end shrink-0">
          <MoneyValue value={p.valorMensal} className="font-mono text-[12px]" />
          <span className="text-[10px] text-muted-foreground">/mês</span>
        </div>
      )}
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
          cor.bg,
          cor.text,
          cor.border
        )}
      >
        <Icon className="h-2.5 w-2.5" />
        {STATUS_LABEL[p.status]}
      </span>
      {p.shareViews > 0 && (
        <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden lg:inline">
          {p.shareViews} {p.shareViews === 1 ? "view" : "views"}
        </span>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCopiarLink();
        }}
        title="Copiar link público"
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </Link>
  );
}

function NovaPropostaDialog({
  open,
  onOpenChange,
  clientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNome, setClienteNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    if (!clienteNome.trim() && !clienteId) {
      toast.error("Informe o cliente");
      return;
    }
    setSalvando(true);
    try {
      const cliente = clientes.find((c) => c.id === clienteId);
      const res = await fetch("/api/propostas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          clienteId: clienteId || null,
          clienteNome: cliente?.nome ?? clienteNome.trim(),
          clienteEmail: cliente?.email ?? null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao criar");
      }
      const nova = await res.json();
      onOpenChange(false);
      router.push(`/propostas/${nova.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova proposta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Gestão de marketing — 2026 H1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select
              value={clienteId}
              onValueChange={(v) => {
                setClienteId(v);
                const c = clientes.find((x) => x.id === v);
                if (c) setClienteNome(c.nome);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar cliente existente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-muted-foreground/70 mt-1">
              Ou digite o nome de um cliente novo (prospect sem cadastro):
            </p>
            <Input
              value={clienteNome}
              onChange={(e) => {
                setClienteNome(e.target.value);
                setClienteId("");
              }}
              placeholder="Nome do cliente / prospect"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? "Criando..." : "Criar e editar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
