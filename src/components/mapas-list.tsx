"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GitBranch, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/empty-state";

type MapaResumo = {
  id: string;
  titulo: string;
  descricao: string | null;
  thumbnail: string | null;
  updatedAt: string;
};

const TEMPLATE_INICIAL = {
  nodes: [
    { id: "n1", x: 480, y: 200, w: 160, h: 80, tipo: "rect" as const, texto: "Tema central", cor: "#7E30E1" },
    { id: "n2", x: 200, y: 100, w: 140, h: 60, tipo: "rect" as const, texto: "Ideia 1", cor: "#10B981" },
    { id: "n3", x: 200, y: 300, w: 140, h: 60, tipo: "rect" as const, texto: "Ideia 2", cor: "#10B981" },
    { id: "n4", x: 800, y: 200, w: 140, h: 60, tipo: "rect" as const, texto: "Resultado", cor: "#F59E0B" },
  ],
  edges: [
    { id: "e1", from: "n2", to: "n1", estilo: "solid" as const, cor: "#9696A8" },
    { id: "e2", from: "n3", to: "n1", estilo: "solid" as const, cor: "#9696A8" },
    { id: "e3", from: "n1", to: "n4", estilo: "solid" as const, cor: "#9696A8" },
  ],
};

export function MapasList({ mapas }: { mapas: MapaResumo[] }) {
  const router = useRouter();

  async function novoMapa() {
    const res = await fetch("/api/mapas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "Novo mapa mental", data: TEMPLATE_INICIAL }),
    });
    if (!res.ok) { toast.error("Erro ao criar"); return; }
    const novo = await res.json();
    router.push(`/mapas/${novo.id}`);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este mapa mental?")) return;
    await fetch(`/api/mapas/${id}`, { method: "DELETE" });
    toast.success("Mapa excluído");
    router.refresh();
  }

  if (mapas.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        titulo="Nenhum mapa mental criado ainda"
        descricao="Faça brainstorming visual estilo Excalidraw: arrasta caixinhas, conecta com setas, organiza ideias. Útil pra planejar campanhas, sessões com cliente ou mapear pilares de conteúdo."
        acaoLabel="Criar primeiro mapa"
        acaoIcon={Plus}
        acaoOnClick={novoMapa}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={novoMapa}><Plus className="h-4 w-4" /> Novo mapa mental</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mapas.map((m) => (
          <Card key={m.id} className="overflow-hidden hover:border-primary/40 transition group">
            <Link href={`/mapas/${m.id}`}>
              <div className="relative h-44 bg-secondary/40 flex items-center justify-center" style={{ backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
                {m.thumbnail ? (
                  <img src={m.thumbnail} alt={m.titulo} className="w-full h-full object-cover" />
                ) : (
                  <GitBranch className="h-12 w-12 text-muted-foreground/30" />
                )}
              </div>
            </Link>
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link href={`/mapas/${m.id}`} className="font-medium text-sm hover:text-primary transition truncate block">{m.titulo}</Link>
                {m.descricao && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.descricao}</div>}
                <div className="text-[10.5px] text-muted-foreground/60 mt-2 font-mono">
                  Atualizado {new Date(m.updatedAt).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => excluir(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
