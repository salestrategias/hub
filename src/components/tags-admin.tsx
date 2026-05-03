"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { Plus, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tag = { id: string; nome: string; cor: string; _count?: { clientes: number } };

const CORES = ["#10B981", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"];

export function TagsAdmin() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(CORES[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCor, setEditCor] = useState(CORES[0]);

  async function carregar() {
    const r = await fetch("/api/tags");
    const d = await r.json();
    if (Array.isArray(d)) setTags(d);
  }
  useEffect(() => { carregar(); }, []);

  async function criar() {
    if (!novoNome.trim()) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome.trim(), cor: novaCor }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao criar");
      return;
    }
    toast.success("Tag criada");
    setNovoNome("");
    carregar();
  }

  async function salvarEdicao(id: string) {
    if (!editNome.trim()) return;
    const res = await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: editNome.trim(), cor: editCor }),
    });
    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    toast.success("Tag atualizada");
    setEditId(null);
    carregar();
  }

  async function excluir(t: Tag) {
    if (!confirm(`Excluir a tag "${t.nome}"? ${t._count?.clientes ? `Ela está em ${t._count.clientes} cliente(s).` : ""}`)) return;
    const res = await fetch(`/api/tags/${t.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Erro ao excluir"); return; }
    toast.success("Tag excluída");
    carregar();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Nova tag</div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Cliente Ativo, Em Onboarding..."
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && criar()}
            />
            <ColorSwatches value={novaCor} onChange={setNovaCor} />
            <Button onClick={criar}><Plus className="h-4 w-4" /> Criar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="text-right">Em uso</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {editId === t.id ? (
                      <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-8 max-w-xs" autoFocus />
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                        style={{ background: t.cor }}
                      >
                        {t.nome}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editId === t.id ? (
                      <ColorSwatches value={editCor} onChange={setEditCor} />
                    ) : (
                      <span className="inline-block h-4 w-4 rounded-full" style={{ background: t.cor }} />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{t._count?.clientes ?? 0}</TableCell>
                  <TableCell className="text-right">
                    {editId === t.id ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => salvarEdicao(t.id)}><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditId(t.id); setEditNome(t.nome); setEditCor(t.cor); }}>
                          Editar
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => excluir(t)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tags.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma tag criada ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 items-center">
      {CORES.map((c) => (
        <button
          type="button"
          key={c}
          onClick={() => onChange(c)}
          className={cn("h-6 w-6 rounded-full border-2 transition-all", value === c ? "border-foreground scale-110" : "border-transparent")}
          style={{ background: c }}
          aria-label={`Cor ${c}`}
        />
      ))}
    </div>
  );
}
