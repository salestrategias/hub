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
import { Plus, Search, ClipboardList, Link2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TEMPLATES_PADRAO,
  BRIEFING_STATUS_META,
  type BriefingStatusUi,
} from "@/lib/briefing";

type BriefingResumo = {
  id: string;
  titulo: string;
  status: BriefingStatusUi;
  clienteId: string | null;
  clienteNome: string | null;
  totalPerguntas: number;
  temRespostas: boolean;
  shareToken: string | null;
  enviadoEm: string | null;
  respondidoEm: string | null;
  updatedAt: string;
};

type Cliente = { id: string; nome: string };

const TABS: Array<BriefingStatusUi | "TODOS"> = [
  "TODOS",
  "RASCUNHO",
  "ENVIADO",
  "RESPONDIDO",
  "ARQUIVADO",
];

export function BriefingsList({
  initial,
  clientes,
}: {
  initial: BriefingResumo[];
  clientes: Cliente[];
}) {
  const [briefings] = useState(initial);
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<BriefingStatusUi | "TODOS">("TODOS");
  const [criando, setCriando] = useState(false);

  const filtrados = useMemo(() => {
    return briefings.filter((b) => {
      if (tab !== "TODOS" && b.status !== tab) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return (
          b.titulo.toLowerCase().includes(q) ||
          (b.clienteNome ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [briefings, tab, busca]);

  if (briefings.length === 0) {
    return (
      <>
        <EmptyState
          icon={ClipboardList}
          titulo="Nenhum briefing ainda"
          descricao="Briefings são formulários nativos que o cliente preenche por um link — sem Google Forms, sem Notion. Comece de um dos 5 modelos prontos (completo, redes, tráfego, SEO, branding) ou em branco, ajuste as perguntas e envie. As respostas voltam pra cá."
          acaoLabel="Criar primeiro briefing"
          acaoIcon={Plus}
          acaoOnClick={() => setCriando(true)}
        />
        {criando && (
          <NovoBriefingDialog open={criando} onOpenChange={setCriando} clientes={clientes} />
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
            placeholder="Buscar por título ou cliente..."
            className="pl-8 h-9"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtrados.length} de {briefings.length}
        </span>
        <Button onClick={() => setCriando(true)} size="sm">
          <Plus className="h-4 w-4" /> Novo briefing
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as BriefingStatusUi | "TODOS")}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t === "TODOS" ? "Todos" : BRIEFING_STATUS_META[t as BriefingStatusUi].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={Search}
          titulo="Nenhum briefing nesse filtro"
          descricao="Ajuste a busca ou troque de aba."
          variante="compact"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {filtrados.map((b) => (
                <li key={b.id}>
                  <BriefingRow briefing={b} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {criando && (
        <NovoBriefingDialog open={criando} onOpenChange={setCriando} clientes={clientes} />
      )}
    </div>
  );
}

function BriefingRow({ briefing: b }: { briefing: BriefingResumo }) {
  const cor = BRIEFING_STATUS_META[b.status];
  return (
    <Link
      href={`/briefings/${b.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 transition group"
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{b.titulo}</div>
        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
          <span>{b.clienteNome ?? "Sem cliente"}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{b.totalPerguntas} {b.totalPerguntas === 1 ? "pergunta" : "perguntas"}</span>
        </div>
      </div>
      {b.respondidoEm && (
        <span className="hidden md:inline text-[10px] text-muted-foreground font-mono shrink-0">
          respondido {new Date(b.respondidoEm).toLocaleDateString("pt-BR")}
        </span>
      )}
      {!b.respondidoEm && b.enviadoEm && (
        <span className="hidden md:inline text-[10px] text-muted-foreground font-mono shrink-0">
          enviado {new Date(b.enviadoEm).toLocaleDateString("pt-BR")}
        </span>
      )}
      {b.shareToken && (
        <Link2 className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Link público ativo" />
      )}
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
          cor.bg,
          cor.text,
          cor.border
        )}
      >
        {cor.label}
      </span>
    </Link>
  );
}

function NovoBriefingDialog({
  open,
  onOpenChange,
  clientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
}) {
  const router = useRouter();
  // "" = em branco; senão é o slug de um TEMPLATES_PADRAO.
  const [templateSlug, setTemplateSlug] = useState<string>(TEMPLATES_PADRAO[0]?.slug ?? "");
  const [clienteId, setClienteId] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const tplSelecionado = TEMPLATES_PADRAO.find((t) => t.slug === templateSlug);

  async function criar() {
    setSalvando(true);
    try {
      const res = await fetch("/api/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateSlug: templateSlug || null,
          clienteId: clienteId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao criar");
      }
      const novo = await res.json();
      onOpenChange(false);
      router.push(`/briefings/${novo.id}`);
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
          <DialogTitle>Novo briefing</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Modelo</Label>
            <Select value={templateSlug || "__blank__"} onValueChange={(v) => setTemplateSlug(v === "__blank__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES_PADRAO.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.nome}
                  </SelectItem>
                ))}
                <SelectItem value="__blank__">Em branco (sem perguntas)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10.5px] text-muted-foreground/70 mt-1 min-h-[1.5em]">
              {tplSelecionado
                ? tplSelecionado.descricao
                : "Começa vazio — você monta as perguntas do zero no editor."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>
              Cliente <span className="text-muted-foreground/60 font-normal">(opcional)</span>
            </Label>
            <Select value={clienteId || "__none__"} onValueChange={(v) => setClienteId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Vincular a um cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum / prospect —</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
