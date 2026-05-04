"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TagsBadges, type Tag } from "@/components/tag-picker";
import { EmptyState } from "@/components/empty-state";
import { formatBRL, cn } from "@/lib/utils";
import { Search, X, Users, FilterX } from "lucide-react";

type Cliente = {
  id: string;
  nome: string;
  email: string | null;
  status: "ATIVO" | "INATIVO" | "PROSPECT" | "CHURNED";
  valorContratoMensal: number;
  tags: Tag[];
};

const STATUS_COLORS: Record<Cliente["status"], "success" | "muted" | "warning" | "destructive"> = {
  ATIVO: "success", PROSPECT: "warning", INATIVO: "muted", CHURNED: "destructive",
};

const STATUS_LABEL: Record<Cliente["status"], string> = {
  ATIVO: "Ativo", PROSPECT: "Prospect", INATIVO: "Inativo", CHURNED: "Churned",
};

export function ClientesList({ clientes, tags }: { clientes: Cliente[]; tags: Tag[] }) {
  const [busca, setBusca] = useState("");
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
  const [statusSelecionados, setStatusSelecionados] = useState<Cliente["status"][]>([]);
  const [modoTag, setModoTag] = useState<"qualquer" | "todas">("qualquer");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q) && !(c.email ?? "").toLowerCase().includes(q)) return false;
      if (statusSelecionados.length && !statusSelecionados.includes(c.status)) return false;
      if (tagsSelecionadas.length) {
        const ids = c.tags.map((t) => t.id);
        if (modoTag === "todas") {
          if (!tagsSelecionadas.every((tid) => ids.includes(tid))) return false;
        } else {
          if (!tagsSelecionadas.some((tid) => ids.includes(tid))) return false;
        }
      }
      return true;
    });
  }, [clientes, busca, tagsSelecionadas, statusSelecionados, modoTag]);

  const algumFiltro = busca || tagsSelecionadas.length || statusSelecionados.length;

  function toggleTag(id: string) {
    setTagsSelecionadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleStatus(s: Cliente["status"]) {
    setStatusSelecionados((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }
  function limpar() { setBusca(""); setTagsSelecionadas([]); setStatusSelecionados([]); }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="pl-9"
              />
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtrados.length} de {clientes.length}
            </span>
            {algumFiltro && (
              <Button size="sm" variant="ghost" onClick={limpar}>
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["ATIVO", "PROSPECT", "INATIVO", "CHURNED"] as const).map((s) => {
                const sel = statusSelecionados.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStatus(s)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors",
                      sel ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/40"
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tags</span>
                {tagsSelecionadas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setModoTag(modoTag === "qualquer" ? "todas" : "qualquer")}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    {modoTag === "qualquer" ? "Qualquer (clique p/ exigir todas)" : "Todas (clique p/ qualquer)"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const sel = tagsSelecionadas.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all",
                        sel ? "text-white" : "text-muted-foreground hover:text-foreground"
                      )}
                      style={sel ? { background: t.cor, borderColor: t.cor } : { borderColor: t.cor + "60" }}
                    >
                      {t.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Mensal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clientes/${c.id}`} className="hover:text-primary">{c.nome}</Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[c.status]}>{c.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell><TagsBadges tags={c.tags} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatBRL(c.valorContratoMensal)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/clientes/${c.id}`} className="text-primary text-sm hover:underline">Detalhes →</Link>
                  </TableCell>
                </TableRow>
              ))}
              {filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    {algumFiltro ? (
                      <EmptyState
                        icon={FilterX}
                        titulo="Nenhum cliente bate com os filtros"
                        descricao="Ajuste os filtros ou limpe-os para ver todos os clientes cadastrados."
                        acaoLabel="Limpar filtros"
                        acaoOnClick={limpar}
                        variante="compact"
                      />
                    ) : (
                      <EmptyState
                        icon={Users}
                        titulo="Nenhum cliente cadastrado"
                        descricao="Comece criando o primeiro cliente da sua agência. Você pode adicionar clientes ativos, prospects e organizar com tags."
                      />
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
