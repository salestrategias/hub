"use client";
/**
 * Hub 2.0 — tela da Lixeira + Arquivados.
 *
 * Aba Lixeira: itens excluídos (snapshot) com Restaurar / Excluir de vez /
 * Esvaziar. Retenção de 30 dias (purge automático no load).
 * Aba Arquivados: tarefas e páginas arquivadas, com Desarquivar.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";
import {
  Trash2, ArchiveRestore, RotateCcw, Loader2, Archive, AlertTriangle,
} from "lucide-react";

type ItemLixeira = {
  id: string;
  tipo: string;
  tipoLabel: string;
  titulo: string;
  apagadoEm: string;
};

type ItemArquivado = {
  id: string;
  tipo: "TAREFA" | "PAGE";
  tipoLabel: string;
  titulo: string;
  detalhe: string | null;
  arquivadoEm: string;
};

const TIPO_EMOJI: Record<string, string> = {
  TAREFA: "✅",
  NOTA: "📝",
  POST: "📣",
  LEAD: "📈",
  PROJETO: "📁",
  PAGE: "📄",
  PROPOSTA: "📨",
};

export function LixeiraClient() {
  const router = useRouter();
  const [tab, setTab] = useState<"lixeira" | "arquivados">("lixeira");
  const [lixeira, setLixeira] = useState<ItemLixeira[]>([]);
  const [arquivados, setArquivados] = useState<ItemArquivado[]>([]);
  const [retencao, setRetencao] = useState(30);
  const [loading, setLoading] = useState(true);
  const [agindo, setAgindo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lixeira");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLixeira(Array.isArray(data.lixeira) ? data.lixeira : []);
      setArquivados(Array.isArray(data.arquivados) ? data.arquivados : []);
      if (data.retencaoDias) setRetencao(data.retencaoDias);
    } catch {
      toast.error("Falha ao carregar a lixeira");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function restaurar(item: ItemLixeira) {
    setAgindo(item.id);
    try {
      const res = await fetch(`/api/lixeira/${item.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao restaurar");
        return;
      }
      toast.success(`${item.tipoLabel} restaurad${item.tipo === "PAGE" || item.tipo === "TAREFA" || item.tipo === "NOTA" || item.tipo === "PROPOSTA" ? "a" : "o"}: ${item.titulo}`, {
        description: "Abrindo...",
      });
      setLixeira((prev) => prev.filter((i) => i.id !== item.id));
      if (data.href) router.push(data.href);
      router.refresh();
    } finally {
      setAgindo(null);
    }
  }

  async function excluirDeVez(item: ItemLixeira) {
    if (!confirm(`Excluir "${item.titulo}" DE VEZ? Sem volta — o snapshot é apagado.`)) return;
    setAgindo(item.id);
    try {
      const res = await fetch(`/api/lixeira/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Falha ao excluir");
        return;
      }
      setLixeira((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Excluído definitivamente");
    } finally {
      setAgindo(null);
    }
  }

  async function esvaziar() {
    if (lixeira.length === 0) return;
    if (!confirm(`Esvaziar a lixeira? Os ${lixeira.length} itens somem DE VEZ, sem volta.`)) return;
    const res = await fetch("/api/lixeira", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao esvaziar");
      return;
    }
    setLixeira([]);
    toast.success("Lixeira esvaziada");
  }

  async function desarquivar(item: ItemArquivado) {
    setAgindo(item.id);
    try {
      const endpoint =
        item.tipo === "TAREFA"
          ? `/api/tarefas/${item.id}/arquivar`
          : `/api/pages/${item.id}/arquivar`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arquivar: false }),
      });
      if (!res.ok) {
        toast.error("Falha ao desarquivar");
        return;
      }
      setArquivados((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(`Desarquivad${item.tipo === "TAREFA" || item.tipo === "PAGE" ? "a" : "o"}: ${item.titulo}`);
      if (item.tipo === "PAGE") {
        window.dispatchEvent(new Event("sal-hub:paginas-fixadas-mudou"));
      }
      router.refresh();
    } finally {
      setAgindo(null);
    }
  }

  const quando = (iso: string) => {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (dias === 0) return "hoje";
    if (dias === 1) return "ontem";
    return `há ${dias} dias`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="lixeira">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Lixeira ({lixeira.length})
            </TabsTrigger>
            <TabsTrigger value="arquivados">
              <Archive className="h-3.5 w-3.5 mr-1.5" /> Arquivados ({arquivados.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {tab === "lixeira" && lixeira.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={esvaziar}
            className="ml-auto text-destructive border-destructive/40 hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Esvaziar lixeira
          </Button>
        )}
      </div>

      {tab === "lixeira" && (
        <>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11.5px] text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            Itens ficam aqui por {retencao} dias e depois são apagados de vez. Restaurar recria o
            item onde ele estava (vínculos com registros já apagados viram vazios).
          </div>
          {!loading && lixeira.length === 0 ? (
            <EmptyState
              icon={Trash2}
              titulo="Lixeira vazia"
              descricao="Tarefas, notas, posts, leads, projetos, páginas e propostas excluídos aparecem aqui por 30 dias."
              variante="compact"
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {lixeira.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-[16px]">{TIPO_EMOJI[item.tipo] ?? "🗑️"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">{item.titulo}</div>
                        <div className="text-[11px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] mr-1.5">{item.tipoLabel}</Badge>
                          excluído {quando(item.apagadoEm)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restaurar(item)}
                        disabled={agindo === item.id}
                      >
                        {agindo === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Restaurar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => excluirDeVez(item)}
                        disabled={agindo === item.id}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Excluir de vez (sem volta)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "arquivados" && (
        <>
          {!loading && arquivados.length === 0 ? (
            <EmptyState
              icon={Archive}
              titulo="Nada arquivado"
              descricao="Arquive tarefas (na sheet da tarefa) e páginas (no editor) pra tirá-las da frente sem apagar."
              variante="compact"
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {arquivados.map((item) => (
                    <li key={`${item.tipo}-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-[16px]">{TIPO_EMOJI[item.tipo] ?? "📦"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">{item.titulo}</div>
                        <div className="text-[11px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] mr-1.5">{item.tipoLabel}</Badge>
                          {item.detalhe && <span className="mr-1.5">{item.detalhe} ·</span>}
                          arquivado {quando(item.arquivadoEm)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => desarquivar(item)}
                        disabled={agindo === item.id}
                      >
                        {agindo === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        )}
                        Desarquivar
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
