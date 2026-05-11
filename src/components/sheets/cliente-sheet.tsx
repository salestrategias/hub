"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Trash2, ListChecks, FileText, Link2, BarChart3 } from "lucide-react";
import { EntitySheet } from "@/components/entity-sheet";
import { RelatorioMensalDialog } from "@/components/relatorio-mensal-dialog";
import { InlineField } from "@/components/inline-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { BlockEditor, BlockRenderer } from "@/components/editor";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { MoneyValue } from "@/components/money-value";
import { TagsBadges } from "@/components/tag-picker";
import { formatDate } from "@/lib/utils";
import type { PartialBlock } from "@blocknote/core";

type ClienteFull = {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  status: "ATIVO" | "INATIVO" | "PROSPECT" | "CHURNED";
  valorContratoMensal: string | number;
  notas: string | null;
  googleDriveFolderUrl: string | null;
  tags: { id: string; nome: string; cor: string | null }[];
  posts: { id: string; titulo: string | null; status: string; dataPublicacao: string }[];
  tarefas: { id: string; titulo: string; concluida: boolean; prioridade: string; dataEntrega: string | null }[];
  contratos: { id: string; status: string; dataInicio: string; dataFim: string; valor: string | number }[];
};

const STATUS_OPTIONS = [
  { value: "ATIVO", label: "Ativo" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "INATIVO", label: "Inativo" },
  { value: "CHURNED", label: "Churned" },
];

const STATUS_COLOR: Record<string, string> = {
  ATIVO: "#10B981",
  PROSPECT: "#3B82F6",
  INATIVO: "#9696A8",
  CHURNED: "#EF4444",
};

export function ClienteSheet({
  clienteId,
  open,
  onOpenChange,
}: {
  clienteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [cliente, setCliente] = useState<ClienteFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relatorioOpen, setRelatorioOpen] = useState(false);

  useEffect(() => {
    if (!clienteId || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/clientes/${clienteId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao carregar cliente");
        return r.json();
      })
      .then((data) => setCliente(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [clienteId, open]);

  async function patchCliente(patch: Record<string, unknown>) {
    if (!clienteId) return;
    const res = await fetch(`/api/clientes/${clienteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setCliente((c) => (c ? { ...c, ...updated } : c));
  }

  async function excluir() {
    if (!clienteId || !cliente) return;
    if (!confirm(`Excluir o cliente "${cliente.nome}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/clientes/${clienteId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Cliente excluído");
    onOpenChange(false);
    router.refresh();
  }

  const status = cliente?.status ?? "ATIVO";
  const statusColor = STATUS_COLOR[status];

  return (
    <>
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !cliente}
      error={error}
      icone={Users}
      iconeCor={statusColor}
      titulo={cliente?.nome ?? "Carregando..."}
      subtitulo={
        cliente && (
          <span className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]" style={{ color: statusColor, borderColor: `${statusColor}55` }}>
              {status}
            </Badge>
            <MoneyValue value={Number(cliente.valorContratoMensal)} className="text-[11px] font-mono" />
            <span className="text-muted-foreground">/mês</span>
          </span>
        )
      }
      linkPaginaCompleta={clienteId ? `/clientes/${clienteId}` : undefined}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={excluir} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRelatorioOpen(true)}>
            <BarChart3 className="h-3.5 w-3.5" /> Relatório do mês
          </Button>
          <span className="text-[10.5px] text-muted-foreground/70">
            Edição salva automaticamente
          </span>
        </>
      }
    >
      {cliente && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="posts">Posts ({cliente.posts.length})</TabsTrigger>
            <TabsTrigger value="tarefas">Tarefas ({cliente.tarefas.length})</TabsTrigger>
            <TabsTrigger value="backlinks">Refs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <InlineField
                type="text"
                label="Nome"
                value={cliente.nome}
                onSave={(v) => patchCliente({ nome: v })}
                size="sm"
                className="col-span-2"
              />
              <InlineField
                type="select"
                label="Status"
                value={cliente.status}
                onSave={(v) => patchCliente({ status: v })}
                options={STATUS_OPTIONS}
                size="sm"
              />
              <InlineField
                type="number"
                label="Valor mensal"
                value={Number(cliente.valorContratoMensal)}
                onSave={(v) => patchCliente({ valorContratoMensal: Number(v) })}
                prefix="R$"
                step={50}
                size="sm"
              />
              <InlineField
                type="text"
                label="CNPJ"
                value={cliente.cnpj ?? ""}
                onSave={(v) => patchCliente({ cnpj: v || null })}
                placeholder="00.000.000/0000-00"
                size="sm"
              />
              <InlineField
                type="email"
                label="Email"
                value={cliente.email ?? ""}
                onSave={(v) => patchCliente({ email: v || null })}
                placeholder="contato@cliente.com"
                size="sm"
              />
              <InlineField
                type="tel"
                label="Telefone"
                value={cliente.telefone ?? ""}
                onSave={(v) => patchCliente({ telefone: v || null })}
                size="sm"
              />
              <InlineField
                type="text"
                label="Endereço"
                value={cliente.endereco ?? ""}
                onSave={(v) => patchCliente({ endereco: v || null })}
                size="sm"
                className="col-span-2"
              />
            </div>

            {cliente.tags.length > 0 && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Tags
                </div>
                <TagsBadges tags={cliente.tags} />
              </div>
            )}

            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Notas
              </div>
              <div className="rounded-md border border-border bg-background/40 p-3">
                <BlockEditor
                  value={cliente.notas ?? ""}
                  onChange={(blocks: PartialBlock[]) => patchCliente({ notas: JSON.stringify(blocks) })}
                  placeholder="Histórico, contexto, decisões importantes..."
                  minHeight="120px"
                />
              </div>
            </div>

            <ContratosBox contratos={cliente.contratos} />
          </TabsContent>

          <TabsContent value="posts" className="mt-4">
            {cliente.posts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum post ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {cliente.posts.slice(0, 20).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/editorial?post=${p.id}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/60 transition"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] truncate">{p.titulo ?? "(sem título)"}</div>
                        <div className="text-[10.5px] text-muted-foreground font-mono">
                          {formatDate(p.dataPublicacao)}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="tarefas" className="mt-4">
            {cliente.tarefas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma tarefa.</p>
            ) : (
              <ul className="space-y-1.5">
                {cliente.tarefas.slice(0, 20).map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tarefas?tarefa=${t.id}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/60 transition"
                    >
                      <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12.5px] truncate ${t.concluida ? "line-through text-muted-foreground" : ""}`}>
                          {t.titulo}
                        </div>
                        {t.dataEntrega && (
                          <div className="text-[10.5px] text-muted-foreground font-mono">
                            {formatDate(t.dataEntrega)}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{t.prioridade}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="backlinks" className="mt-4">
            {clienteId && (
              <BacklinksPanel type="CLIENTE" id={clienteId} title="Mencionado em" />
            )}
          </TabsContent>
        </Tabs>
      )}
    </EntitySheet>

    {cliente && (
      <RelatorioMensalDialog
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        clienteId={cliente.id}
        clienteNome={cliente.nome}
      />
    )}
    </>
  );
}

function ContratosBox({ contratos }: { contratos: ClienteFull["contratos"] }) {
  if (contratos.length === 0) return null;
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
        <Link2 className="h-3 w-3" /> Contratos
      </div>
      <ul className="space-y-1">
        {contratos.slice(0, 5).map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary/40 text-[12px]"
          >
            <span className="text-muted-foreground font-mono">
              {formatDate(c.dataInicio)} → {formatDate(c.dataFim)}
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
              <MoneyValue value={Number(c.valor)} className="font-mono text-xs" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
