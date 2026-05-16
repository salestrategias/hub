"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Trash2, Plus } from "lucide-react";
import { EntitySheet } from "@/components/entity-sheet";
import { InlineField } from "@/components/inline-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { cn } from "@/lib/utils";
import type { EditorBlock as PartialBlock } from "@/components/editor/types";

type CheckItem = { id: string; texto: string; concluido: boolean; ordem: number };

type TarefaFull = {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA";
  dataEntrega: string | null;
  concluida: boolean;
  cliente: { id: string; nome: string } | null;
  projeto: { id: string; nome: string } | null;
  checklist: CheckItem[];
};

const PRIORIDADE_OPTIONS = [
  { value: "URGENTE", label: "Urgente" },
  { value: "ALTA", label: "Alta" },
  { value: "NORMAL", label: "Normal" },
  { value: "BAIXA", label: "Baixa" },
];

const PRIORIDADE_COR: Record<TarefaFull["prioridade"], string> = {
  URGENTE: "#EF4444",
  ALTA: "#F59E0B",
  NORMAL: "#7E30E1",
  BAIXA: "#9696A8",
};

export function TarefaSheet({
  tarefaId,
  open,
  onOpenChange,
  clientes,
  projetos,
}: {
  tarefaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes?: { id: string; nome: string }[];
  projetos?: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [tarefa, setTarefa] = useState<TarefaFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tarefaId || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/tarefas/${tarefaId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao carregar tarefa");
        return r.json();
      })
      .then(setTarefa)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [tarefaId, open]);

  async function recarregar() {
    if (!tarefaId) return;
    const res = await fetch(`/api/tarefas/${tarefaId}`);
    if (res.ok) setTarefa(await res.json());
  }

  async function patchTarefa(patch: Record<string, unknown>) {
    if (!tarefaId) return;
    const res = await fetch(`/api/tarefas/${tarefaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setTarefa((t) => (t ? { ...t, ...updated } : t));
  }

  async function toggleConcluida() {
    if (!tarefa) return;
    await patchTarefa({ concluida: !tarefa.concluida });
  }

  async function excluir() {
    if (!tarefaId || !tarefa) return;
    if (!confirm(`Excluir a tarefa "${tarefa.titulo}"?`)) return;
    const res = await fetch(`/api/tarefas/${tarefaId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Tarefa excluída");
    onOpenChange(false);
    router.refresh();
  }

  const cor = tarefa ? PRIORIDADE_COR[tarefa.prioridade] : "#7E30E1";
  // Converte ISO datetime do banco pra formato `datetime-local` (sem timezone) usado no input
  const dataEntregaInput = tarefa?.dataEntrega ? toLocalInput(tarefa.dataEntrega) : "";

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !tarefa}
      error={error}
      icone={ListChecks}
      iconeCor={cor}
      titulo={
        tarefa && (
          <span className={cn("flex items-center gap-2", tarefa.concluida && "line-through text-muted-foreground")}>
            <input
              type="checkbox"
              checked={tarefa.concluida}
              onChange={toggleConcluida}
              className="accent-sal-600 cursor-pointer"
              aria-label="Marcar como concluída"
            />
            {tarefa.titulo}
          </span>
        )
      }
      subtitulo={
        tarefa && (
          <span className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ color: cor, borderColor: `${cor}55` }}
            >
              {tarefa.prioridade}
            </Badge>
            {tarefa.cliente && <span className="text-muted-foreground">· {tarefa.cliente.nome}</span>}
            {tarefa.projeto && <span className="text-muted-foreground">· {tarefa.projeto.nome}</span>}
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
      {tarefa && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InlineField
              type="text"
              label="Título"
              value={tarefa.titulo}
              onSave={(v) => patchTarefa({ titulo: v })}
              size="sm"
              className="col-span-2"
            />
            <InlineField
              type="select"
              label="Prioridade"
              value={tarefa.prioridade}
              options={PRIORIDADE_OPTIONS}
              onSave={(v) => patchTarefa({ prioridade: v })}
              size="sm"
            />
            <InlineField
              type="datetime-local"
              label="Entrega"
              value={dataEntregaInput}
              onSave={(v) => patchTarefa({ dataEntrega: v ? new Date(v).toISOString() : null })}
              size="sm"
            />
            {clientes && clientes.length > 0 && (
              <InlineField
                type="select"
                label="Cliente"
                value={tarefa.cliente?.id ?? ""}
                options={[{ value: "", label: "—" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
                onSave={(v) => patchTarefa({ clienteId: v || null })}
                size="sm"
              />
            )}
            {projetos && projetos.length > 0 && (
              <InlineField
                type="select"
                label="Projeto"
                value={tarefa.projeto?.id ?? ""}
                options={[{ value: "", label: "—" }, ...projetos.map((p) => ({ value: p.id, label: p.nome }))]}
                onSave={(v) => patchTarefa({ projetoId: v || null })}
                size="sm"
              />
            )}
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Descrição
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <BlockEditor
                value={tarefa.descricao ?? ""}
                onChange={(blocks: PartialBlock[]) => patchTarefa({ descricao: JSON.stringify(blocks) })}
                placeholder="Detalhes, links, briefing..."
                minHeight="100px"
              />
            </div>
          </div>

          <Checklist tarefaId={tarefa.id} items={tarefa.checklist} onChange={recarregar} />

          {tarefaId && <BacklinksPanel type="TAREFA" id={tarefaId} hideWhenEmpty title="Mencionado em" />}
        </div>
      )}
    </EntitySheet>
  );
}

function Checklist({
  tarefaId,
  items,
  onChange,
}: {
  tarefaId: string;
  items: CheckItem[];
  onChange: () => void;
}) {
  const [novo, setNovo] = useState("");
  const concluidos = items.filter((i) => i.concluido).length;

  async function adicionar() {
    if (!novo.trim()) return;
    await fetch("/api/checkitems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tarefaId, texto: novo }),
    });
    setNovo("");
    onChange();
  }

  async function toggleItem(item: CheckItem) {
    await fetch(`/api/checkitems/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concluido: !item.concluido }),
    });
    onChange();
  }

  async function excluir(id: string) {
    await fetch(`/api/checkitems/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
          Checklist
        </div>
        {items.length > 0 && (
          <span className="text-[10.5px] text-muted-foreground/70 font-mono">
            {concluidos}/{items.length}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/40 transition group"
          >
            <input
              type="checkbox"
              checked={it.concluido}
              onChange={() => toggleItem(it)}
              className="accent-sal-600 cursor-pointer"
            />
            <span className={cn("flex-1 text-[12.5px]", it.concluido && "line-through text-muted-foreground")}>
              {it.texto}
            </span>
            <button
              onClick={() => excluir(it.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
              aria-label="Remover"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 mt-2">
        <Input
          placeholder="+ Adicionar item"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
          className="h-8 text-xs"
        />
        {novo.trim() && (
          <Button size="sm" className="h-8 text-xs" onClick={adicionar}>
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Converte uma string ISO (com timezone) pra formato compatível com
 * `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`).
 */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
