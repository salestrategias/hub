"use client";
/**
 * Sheet de personalização do dashboard — toggle de visibilidade + drag-drop
 * pra reordenar widgets.
 *
 * Usa @hello-pangea/dnd (já está no projeto pro Manual). Mesma estética:
 * handle visual, sombra durante drag, animação suave.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { GripVertical, RotateCcw, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  WIDGETS,
  LAYOUT_DEFAULT,
  type Layout,
  type WidgetId,
} from "@/lib/dashboard-widgets";

export function PersonalizarDashboardSheet({
  open,
  onOpenChange,
  layoutInicial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  layoutInicial: Layout;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>(layoutInicial);
  const [salvando, setSalvando] = useState(false);

  // Reset toda vez que abre — pega valor mais recente do server
  useEffect(() => {
    if (open) setLayout(layoutInicial);
  }, [open, layoutInicial]);

  function toggleVisivel(id: WidgetId) {
    setLayout({
      widgets: layout.widgets.map((w) => (w.id === id ? { ...w, visivel: !w.visivel } : w)),
    });
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const widgets = [...layout.widgets];
    const [removido] = widgets.splice(result.source.index, 1);
    widgets.splice(result.destination.index, 0, removido);
    setLayout({ widgets });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha ao salvar");
      }
      toast.success("Layout salvo");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  function restaurarPadrao() {
    setLayout(LAYOUT_DEFAULT);
    toast.success("Layout padrão restaurado — clique em Salvar pra confirmar");
  }

  // Lookup pra mostrar título/descrição
  const meta = (id: WidgetId) => WIDGETS.find((w) => w.id === id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar dashboard</DialogTitle>
          <DialogDescription>
            Arraste pra reordenar, ative/desative widgets. Aplica imediatamente após salvar.
          </DialogDescription>
        </DialogHeader>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="widgets">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {layout.widgets.map((item, idx) => {
                  const m = meta(item.id);
                  if (!m) return null;
                  return (
                    <Draggable key={item.id} draggableId={item.id} index={idx}>
                      {(prov, snap) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className={cn(
                            "rounded-md border px-3 py-2.5 flex items-center gap-3 transition",
                            snap.isDragging
                              ? "border-primary bg-card shadow-lg"
                              : "border-border bg-card",
                            !item.visivel && "opacity-50"
                          )}
                        >
                          <div
                            {...prov.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                            title="Arraste pra reordenar"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold">{m.titulo}</div>
                            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                              {m.descricao}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleVisivel(item.id)}
                            className={cn(
                              "h-8 w-8 shrink-0",
                              item.visivel ? "text-emerald-500" : "text-muted-foreground"
                            )}
                            title={item.visivel ? "Ocultar widget" : "Mostrar widget"}
                          >
                            {item.visivel ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={restaurarPadrao} className="mr-auto">
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </Button>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

