"use client";
/**
 * Renderer cliente do dashboard.
 *
 * Recebe TODOS os dados (computados no server) + o layout salvo, e renderiza
 * widgets na ordem definida, escondendo os que estão `visivel: false`.
 *
 * Suporta personalização inline via PersonalizarDashboardSheet (botão no topo
 * direito). Após salvar, refresca a página pra recarregar com layout novo.
 */
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { PersonalizarDashboardSheet } from "@/components/dashboard/personalizar-dashboard-sheet";
import type { Layout, WidgetId } from "@/lib/dashboard-widgets";

export function DashboardRenderer({
  layout,
  widgets,
}: {
  layout: Layout;
  /** Mapa de ID → React node (já renderizado no server). */
  widgets: Partial<Record<WidgetId, ReactNode>>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Renderiza apenas os visíveis, na ordem definida
  const visiveis = layout.widgets.filter((w) => w.visivel);

  return (
    <>
      {/* Botão flutuante de personalização — não ocupa espaço do dashboard */}
      <div className="flex justify-end mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="text-[11px]"
          title="Mostrar/ocultar widgets e reordenar"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Personalizar dashboard
        </Button>
      </div>

      <div className="space-y-4">
        {visiveis.map((item) => {
          const node = widgets[item.id];
          if (!node) return null;
          return <div key={item.id}>{node}</div>;
        })}

        {visiveis.length === 0 && (
          <div className="rounded-lg border border-border bg-card/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Todos os widgets estão ocultos. Clique em &quot;Personalizar dashboard&quot; pra
              reativar.
            </p>
          </div>
        )}
      </div>

      <PersonalizarDashboardSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        layoutInicial={layout}
      />
    </>
  );
}
