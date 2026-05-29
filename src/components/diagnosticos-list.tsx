"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Plus,
  Search,
  Stethoscope,
  ExternalLink,
  Eye,
  CheckCircle2,
  Clock,
  PenLine,
  Archive,
  Download,
  Mic,
} from "lucide-react";
import { exportarCsv, timestampArquivo, type Coluna } from "@/lib/csv-export";
import { cn } from "@/lib/utils";

type DiagnosticoStatus = "RASCUNHO" | "PRONTO" | "ENVIADO" | "VISTO" | "ARQUIVADO";

type Diagnostico = {
  id: string;
  numero: string;
  titulo: string;
  clienteNome: string;
  clienteId: string | null;
  status: DiagnosticoStatus;
  reuniaoTitulo: string | null;
  secoesVisiveis: number;
  shareToken: string | null;
  shareExpiraEm: string | null;
  shareViews: number;
  enviadoEm: string | null;
  updatedAt: string;
};

type Cliente = { id: string; nome: string; email: string | null };
type Reuniao = { id: string; titulo: string; data: string };

const STATUS_LABEL: Record<DiagnosticoStatus, string> = {
  RASCUNHO: "Rascunho",
  PRONTO: "Pronto",
  ENVIADO: "Enviado",
  VISTO: "Visto",
  ARQUIVADO: "Arquivado",
};

const STATUS_COR: Record<
  DiagnosticoStatus,
  { bg: string; text: string; border: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  RASCUNHO: { bg: "bg-secondary", text: "text-muted-foreground", border: "border-border", Icon: PenLine },
  PRONTO: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", Icon: CheckCircle2 },
  ENVIADO: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", Icon: Clock },
  VISTO: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", Icon: Eye },
  ARQUIVADO: { bg: "bg-secondary", text: "text-muted-foreground/70", border: "border-border", Icon: Archive },
};

const TABS: Array<DiagnosticoStatus | "TODAS"> = ["TODAS", "RASCUNHO", "PRONTO", "ENVIADO", "VISTO", "ARQUIVADO"];

export function DiagnosticosList({
  initial,
  clientes,
  reunioes,
}: {
  initial: Diagnostico[];
  clientes: Cliente[];
  reunioes: Reuniao[];
}) {
  const [diagnosticos] = useState(initial);
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<DiagnosticoStatus | "TODAS">("TODAS");
  const [criando, setCriando] = useState(false);

  const filtrados = useMemo(() => {
    return diagnosticos.filter((d) => {
      if (tab !== "TODAS" && d.status !== tab) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return (
          d.numero.toLowerCase().includes(q) ||
          d.titulo.toLowerCase().includes(q) ||
          d.clienteNome.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [diagnosticos, tab, busca]);

  if (diagnosticos.length === 0) {
    return (
      <>
        <EmptyState
          icon={Stethoscope}
          titulo="Nenhum diagnóstico ainda"
          descricao="O diagnóstico estratégico é a entrega de valor que abre o relacionamento — apresentado antes (e separado) da proposta. Crie a partir de uma reunião de diagnóstico: a transcrição alimenta a IA, você refina à mão, e envia por link. Numeração automática por ano (2026-001...)."
          acaoLabel="Criar primeiro diagnóstico"
          acaoIcon={Plus}
          acaoOnClick={() => setCriando(true)}
        />
        {criando && (
          <NovoDiagnosticoDialog open={criando} onOpenChange={setCriando} clientes={clientes} reunioes={reunioes} />
        )}
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
          {filtrados.length} de {diagnosticos.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={exportar}
          disabled={filtrados.length === 0}
          title="Exportar diagnósticos filtrados pra CSV"
        >
          <Download className="h-4 w-4" /> CSV
        </Button>
        <Button onClick={() => setCriando(true)} size="sm">
          <Plus className="h-4 w-4" /> Novo diagnóstico
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as DiagnosticoStatus | "TODAS")}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t === "TODAS" ? "Todos" : STATUS_LABEL[t as DiagnosticoStatus]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={Search}
          titulo="Nenhum diagnóstico nesse filtro"
          descricao="Ajuste a busca ou troca de aba."
          variante="compact"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {filtrados.map((d) => (
                <li key={d.id}>
                  <DiagnosticoRow diagnostico={d} onCopiarLink={() => copiarLink(d)} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {criando && (
        <NovoDiagnosticoDialog open={criando} onOpenChange={setCriando} clientes={clientes} reunioes={reunioes} />
      )}
    </div>
  );

  function exportar() {
    const colunas: Coluna<Diagnostico>[] = [
      { header: "Número", get: (d) => d.numero },
      { header: "Título", get: (d) => d.titulo },
      { header: "Cliente", get: (d) => d.clienteNome },
      { header: "Status", get: (d) => STATUS_LABEL[d.status] },
      { header: "Reunião", get: (d) => d.reuniaoTitulo ?? "" },
      { header: "Seções ativas", get: (d) => d.secoesVisiveis },
      { header: "Views", get: (d) => d.shareViews },
      {
        header: "Enviado em",
        get: (d) => (d.enviadoEm ? new Date(d.enviadoEm).toLocaleDateString("pt-BR") : ""),
      },
      {
        header: "Última atualização",
        get: (d) => new Date(d.updatedAt).toLocaleDateString("pt-BR"),
      },
    ];
    const sufixo = busca.trim() || tab !== "TODAS" ? "-filtrado" : "";
    exportarCsv(`diagnosticos-sal${sufixo}-${timestampArquivo()}.csv`, filtrados, colunas);
    toast.success(`${filtrados.length} diagnóstico(s) exportado(s)`);
  }

  async function copiarLink(d: Diagnostico) {
    if (!d.shareToken) {
      toast.error("Este diagnóstico ainda não foi enviado. Abra e clique em 'Enviar'.");
      return;
    }
    const url = `${window.location.origin}/p/diagnostico/${d.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado", { description: url });
    } catch {
      toast.error("Falha ao copiar");
    }
  }
}

function DiagnosticoRow({
  diagnostico: d,
  onCopiarLink,
}: {
  diagnostico: Diagnostico;
  onCopiarLink: () => void;
}) {
  const cor = STATUS_COR[d.status];
  const Icon = cor.Icon;

  return (
    <Link
      href={`/diagnosticos/${d.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 transition group"
    >
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums w-20 shrink-0">{d.numero}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{d.titulo}</div>
        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
          <span>{d.clienteNome}</span>
          {d.reuniaoTitulo && (
            <span className="inline-flex items-center gap-1 text-muted-foreground/70" title={`Reunião: ${d.reuniaoTitulo}`}>
              · <Mic className="h-2.5 w-2.5" /> reunião
            </span>
          )}
        </div>
      </div>
      <span className="hidden md:inline text-[10px] text-muted-foreground font-mono shrink-0">
        {d.secoesVisiveis} {d.secoesVisiveis === 1 ? "seção" : "seções"}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
          cor.bg,
          cor.text,
          cor.border
        )}
      >
        <Icon className="h-2.5 w-2.5" />
        {STATUS_LABEL[d.status]}
      </span>
      {d.shareViews > 0 && (
        <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden lg:inline">
          {d.shareViews} {d.shareViews === 1 ? "view" : "views"}
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

function NovoDiagnosticoDialog({
  open,
  onOpenChange,
  clientes,
  reunioes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
  reunioes: Reuniao[];
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNome, setClienteNome] = useState("");
  const [reuniaoId, setReuniaoId] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    if (!clienteNome.trim() && !clienteId) {
      toast.error("Informe o cliente / prospect");
      return;
    }
    setSalvando(true);
    try {
      const cliente = clientes.find((c) => c.id === clienteId);
      const res = await fetch("/api/diagnosticos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          clienteId: clienteId || null,
          clienteNome: cliente?.nome ?? clienteNome.trim(),
          clienteEmail: cliente?.email ?? null,
          reuniaoId: reuniaoId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao criar");
      }
      const novo = await res.json();
      onOpenChange(false);
      router.push(`/diagnosticos/${novo.id}`);
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
          <DialogTitle>Novo diagnóstico</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Diagnóstico estratégico — Clínica X"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente / prospect</Label>
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
              Ou digite o nome de um prospect novo (sem cadastro):
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
          <div className="space-y-1.5">
            <Label>
              Reunião de diagnóstico <span className="text-muted-foreground/60 font-normal">(opcional)</span>
            </Label>
            <Select value={reuniaoId} onValueChange={setReuniaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Vincular gravação/transcrição (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {reunioes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.titulo} · {new Date(r.data).toLocaleDateString("pt-BR")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-muted-foreground/70 mt-1">
              A transcrição da reunião vira contexto pra IA gerar o diagnóstico. Dá pra vincular depois também.
            </p>
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
