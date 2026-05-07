"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Trash2, ListChecks, ExternalLink } from "lucide-react";
import { EntitySheet } from "@/components/entity-sheet";
import { InlineField } from "@/components/inline-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { cn } from "@/lib/utils";
import type { PartialBlock } from "@blocknote/core";

type TarefaResumo = {
  id: string;
  titulo: string;
  concluida: boolean;
  prioridade: string;
  dataEntrega: string | null;
};

type ProjetoFull = {
  id: string;
  nome: string;
  descricao: string | null;
  status: "BRIEFING" | "PRODUCAO" | "REVISAO" | "APROVACAO" | "ENTREGUE";
  prioridade: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA";
  dataEntrega: string | null;
  googleDriveFolderUrl: string | null;
  cliente: { id: string; nome: string } | null;
  tarefas: TarefaResumo[];
};

const STATUS_OPTIONS = [
  { value: "BRIEFING", label: "Briefing" },
  { value: "PRODUCAO", label: "Produção" },
  { value: "REVISAO", label: "Revisão" },
  { value: "APROVACAO", label: "Aprovação" },
  { value: "ENTREGUE", label: "Entregue" },
];

const PRIORIDADE_OPTIONS = [
  { value: "URGENTE", label: "Urgente" },
  { value: "ALTA", label: "Alta" },
  { value: "NORMAL", label: "Normal" },
  { value: "BAIXA", label: "Baixa" },
];

const STATUS_COR: Record<ProjetoFull["status"], string> = {
  BRIEFING: "#3B82F6",
  PRODUCAO: "#7E30E1",
  REVISAO: "#F59E0B",
  APROVACAO: "#EC4899",
  ENTREGUE: "#10B981",
};

export function ProjetoSheet({
  projetoId,
  open,
  onOpenChange,
  clientes,
}: {
  projetoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes?: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [projeto, setProjeto] = useState<ProjetoFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projetoId || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/projetos/${projetoId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao carregar projeto");
        return r.json();
      })
      .then(setProjeto)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [projetoId, open]);

  async function patchProjeto(patch: Record<string, unknown>) {
    if (!projetoId) return;
    const res = await fetch(`/api/projetos/${projetoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setProjeto((p) => (p ? { ...p, ...updated } : p));
  }

  async function excluir() {
    if (!projetoId || !projeto) return;
    if (!confirm(`Excluir o projeto "${projeto.nome}"?`)) return;
    const res = await fetch(`/api/projetos/${projetoId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Projeto excluído");
    onOpenChange(false);
    router.refresh();
  }

  const cor = projeto ? STATUS_COR[projeto.status] : "#7E30E1";
  const dataEntregaInput = projeto?.dataEntrega ? toLocalInput(projeto.dataEntrega) : "";

  const tarefasAbertas = projeto?.tarefas.filter((t) => !t.concluida).length ?? 0;
  const tarefasConcluidas = projeto?.tarefas.filter((t) => t.concluida).length ?? 0;

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !projeto}
      error={error}
      icone={FolderKanban}
      iconeCor={cor}
      titulo={projeto?.nome ?? "Carregando..."}
      subtitulo={
        projeto && (
          <span className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
              {projeto.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{projeto.prioridade}</Badge>
            {projeto.cliente && <span className="text-muted-foreground">· {projeto.cliente.nome}</span>}
          </span>
        )
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={excluir} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <span className="text-[10.5px] text-muted-foreground/70">Edição salva automaticamente</span>
        </>
      }
    >
      {projeto && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InlineField
              type="text"
              label="Nome"
              value={projeto.nome}
              onSave={(v) => patchProjeto({ nome: v })}
              size="sm"
              className="col-span-2"
            />
            <InlineField
              type="select"
              label="Status"
              value={projeto.status}
              options={STATUS_OPTIONS}
              onSave={(v) => patchProjeto({ status: v })}
              size="sm"
            />
            <InlineField
              type="select"
              label="Prioridade"
              value={projeto.prioridade}
              options={PRIORIDADE_OPTIONS}
              onSave={(v) => patchProjeto({ prioridade: v })}
              size="sm"
            />
            <InlineField
              type="datetime-local"
              label="Entrega"
              value={dataEntregaInput}
              onSave={(v) => patchProjeto({ dataEntrega: v ? new Date(v).toISOString() : null })}
              size="sm"
            />
            {clientes && clientes.length > 0 && (
              <InlineField
                type="select"
                label="Cliente"
                value={projeto.cliente?.id ?? ""}
                options={[{ value: "", label: "—" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
                onSave={(v) => patchProjeto({ clienteId: v || null })}
                size="sm"
              />
            )}
          </div>

          {projeto.googleDriveFolderUrl && (
            <a
              href={projeto.googleDriveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-sal-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Pasta no Google Drive
            </a>
          )}

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Descrição
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <BlockEditor
                value={projeto.descricao ?? ""}
                onChange={(blocks: PartialBlock[]) => patchProjeto({ descricao: JSON.stringify(blocks) })}
                placeholder="Escopo, briefing, deliverables..."
                minHeight="120px"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <ListChecks className="h-3 w-3" /> Tarefas
              </div>
              <span className="text-[10.5px] text-muted-foreground/70 font-mono">
                {tarefasConcluidas}/{tarefasConcluidas + tarefasAbertas}
              </span>
            </div>

            {projeto.tarefas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Nenhuma tarefa vinculada.
              </p>
            ) : (
              <ul className="space-y-1">
                {projeto.tarefas.slice(0, 20).map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/tarefas?tarefa=${t.id}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition"
                    >
                      <input
                        type="checkbox"
                        checked={t.concluida}
                        readOnly
                        className="accent-sal-600 pointer-events-none"
                      />
                      <span
                        className={cn(
                          "flex-1 text-[12.5px] truncate",
                          t.concluida && "line-through text-muted-foreground"
                        )}
                      >
                        {t.titulo}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{t.prioridade}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {projetoId && <BacklinksPanel type="PROJETO" id={projetoId} hideWhenEmpty title="Mencionado em" />}
        </div>
      )}
    </EntitySheet>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
