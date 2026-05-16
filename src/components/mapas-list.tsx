"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GitBranch, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MIND_MAP_TEMPLATES, type MindMapTemplate } from "./mind-map-templates";

type MapaResumo = {
  id: string;
  titulo: string;
  descricao: string | null;
  thumbnail: string | null;
  updatedAt: string;
};

export function MapasList({ mapas }: { mapas: MapaResumo[] }) {
  const router = useRouter();
  const [seletorAberto, setSeletorAberto] = useState(false);

  async function criarComTemplate(t: MindMapTemplate) {
    setSeletorAberto(false);
    const res = await fetch("/api/mapas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: t.id === "blank" ? "Novo mapa mental" : t.titulo,
        descricao: t.id === "blank" ? null : t.descricao,
        data: { nodes: t.nodes, edges: t.edges },
      }),
    });
    if (!res.ok) {
      toast.error("Erro ao criar");
      return;
    }
    const novo = await res.json();
    router.push(`/mapas/${novo.id}`);
  }

  async function excluir(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Excluir este mapa mental?")) return;
    await fetch(`/api/mapas/${id}`, { method: "DELETE" });
    toast.success("Mapa excluído");
    router.refresh();
  }

  if (mapas.length === 0) {
    return (
      <>
        <EmptyState
          icon={GitBranch}
          titulo="Nenhum mapa mental criado ainda"
          descricao="Faça brainstorming visual: arrasta caixas, conecta com setas, organiza ideias. Útil pra planejar campanhas, sessões com cliente, fluxos, FOFA, jornada do cliente, fishbone, pilares de conteúdo."
          acaoLabel="Criar primeiro mapa"
          acaoIcon={Plus}
          acaoOnClick={() => setSeletorAberto(true)}
        />
        <SeletorTemplate
          open={seletorAberto}
          onOpenChange={setSeletorAberto}
          onPick={criarComTemplate}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setSeletorAberto(true)}>
          <Plus className="h-4 w-4" /> Novo mapa mental
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mapas.map((m) => (
          <Card key={m.id} className="overflow-hidden hover:border-primary/40 transition group">
            <Link href={`/mapas/${m.id}`}>
              <div
                className="relative h-44 bg-secondary/40 flex items-center justify-center overflow-hidden"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              >
                {m.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.thumbnail}
                    alt={m.titulo}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <GitBranch className="h-12 w-12 text-muted-foreground/30" />
                )}
              </div>
            </Link>
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/mapas/${m.id}`}
                  className="font-medium text-sm hover:text-primary transition truncate block"
                >
                  {m.titulo}
                </Link>
                {m.descricao && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.descricao}</div>
                )}
                <div className="text-[10.5px] text-muted-foreground/60 mt-2 font-mono">
                  Atualizado {new Date(m.updatedAt).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={(e) => excluir(e, m.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <SeletorTemplate
        open={seletorAberto}
        onOpenChange={setSeletorAberto}
        onPick={criarComTemplate}
      />
    </div>
  );
}

/**
 * Dialog com cards de templates pra começar um novo mapa.
 */
function SeletorTemplate({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (t: MindMapTemplate) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl dialog-bottom-sheet">
        <div className="sm:hidden flex justify-center -mt-1 mb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <DialogHeader>
          <DialogTitle>Começar com um template</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha um modelo pré-pronto ou comece em branco.
          </p>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-[60vh] overflow-y-auto">
          {MIND_MAP_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="text-left p-3 rounded-md border border-border bg-card hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] transition touch-feedback"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-2xl shrink-0 leading-none mt-0.5">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight">{t.titulo}</div>
                  <div className="text-[11.5px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                    {t.descricao}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
