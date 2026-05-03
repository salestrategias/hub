"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tag = { id: string; nome: string; cor: string };

const CORES_PADRAO = [
  "#10B981", // emerald (ativo)
  "#EF4444", // red (desativado)
  "#F59E0B", // amber (atenção)
  "#3B82F6", // blue (info)
  "#8B5CF6", // violet (vip)
  "#EC4899", // pink
  "#14B8A6", // teal
  "#64748B", // slate
];

export function TagPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(CORES_PADRAO[0]);

  async function carregar() {
    const r = await fetch("/api/tags");
    const d = await r.json();
    if (Array.isArray(d)) setTags(d);
  }

  useEffect(() => { carregar(); }, []);

  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  }

  async function criarTag() {
    if (!novoNome.trim()) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome.trim(), cor: novaCor }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao criar tag");
      return;
    }
    const nova: Tag = await res.json();
    setTags([...tags, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
    onChange([...selectedIds, nova.id]);
    setNovoNome(""); setCriando(false);
    toast.success("Tag criada");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.map((t) => {
          const sel = selectedIds.includes(t.id);
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => toggle(t.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all",
                sel ? "text-white" : "text-muted-foreground border-border hover:border-foreground/30"
              )}
              style={sel ? { background: t.cor, borderColor: t.cor } : { borderColor: t.cor + "60" }}
            >
              {sel && <Check className="h-3 w-3" />}
              {t.nome}
            </button>
          );
        })}
        {!criando && (
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
          >
            <Plus className="h-3 w-3" /> Nova tag
          </button>
        )}
      </div>

      {criando && (
        <div className="flex flex-col gap-2 p-3 rounded-md border border-border bg-card/50">
          <div className="flex gap-2">
            <Input
              autoFocus
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome da tag"
              className="h-8 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); criarTag(); } }}
            />
            <Button type="button" size="sm" onClick={criarTag}>Criar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setCriando(false); setNovoNome(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Cor:</span>
            {CORES_PADRAO.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setNovaCor(c)}
                className={cn("h-5 w-5 rounded-full border-2 transition-all", novaCor === c ? "border-foreground scale-110" : "border-transparent")}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Versão somente-leitura para mostrar tags em listagens */
export function TagsBadges({ tags }: { tags: Tag[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <Badge key={t.id} className="text-[10px] border-0" style={{ background: t.cor, color: "#fff" }}>
          {t.nome}
        </Badge>
      ))}
    </div>
  );
}
