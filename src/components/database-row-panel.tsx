"use client";
/**
 * database-row-panel.tsx — PAINEL DA LINHA (row detail) num Sheet lateral.
 *
 * Abre ao clicar num card do BOARD ou no botão "abrir" da TABELA. Edita TODAS
 * as propriedades da row reusando os editores de célula por tipo do módulo
 * compartilhado (database-cells: CelulaEditavel). A 1ª propriedade vira o
 * título. Botão pra excluir a linha. ZERO <style jsx>.
 *
 * Não tem estado próprio dos valores: lê da row passada (controlada pelo pai,
 * que mantém a cópia otimista) e dispara onSetCelula/onDelete pra cima.
 */
import {
  Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { iconeDoTipo, metaDe, type CellValue } from "@/lib/database";
import {
  type DbProperty, type DbRow, CelulaEditavel, LucideIcon, tituloDaRow,
} from "@/components/database-cells";

export function RowPanel({
  open,
  onOpenChange,
  row,
  propriedades,
  onSetCelula,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: DbRow | null;
  propriedades: DbProperty[];
  onSetCelula: (rowId: string, propId: string, valor: CellValue) => void;
  onDelete: (rowId: string) => void;
}) {
  const props = [...propriedades].sort((a, b) => a.ordem - b.ordem);
  const titulo = row ? tituloDaRow(propriedades, row) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>{titulo || "Linha"}</SheetTitle>
          <SheetDescription>Editar propriedades da linha</SheetDescription>
        </SheetHeader>

        <SheetBody>
          {row ? (
            <div className="space-y-1">
              {props.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[140px_1fr] items-start gap-2 py-1 border-b border-border/50 last:border-0"
                >
                  <div
                    className="flex items-center gap-1.5 pt-1.5 text-[12px] text-muted-foreground min-w-0"
                    title={`${p.nome} · ${metaDe(p.tipo).label}`}
                  >
                    <LucideIcon name={iconeDoTipo(p.tipo)} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.nome}</span>
                  </div>
                  <div className="min-w-0 rounded-md hover:bg-muted/20">
                    <CelulaEditavel
                      prop={p}
                      valor={row.valores[p.id]}
                      onChange={(v) => onSetCelula(row.id, p.id, v)}
                    />
                  </div>
                </div>
              ))}
              {props.length === 0 && (
                <p className="text-[13px] text-muted-foreground italic">
                  Esse database ainda não tem propriedades.
                </p>
              )}
            </div>
          ) : null}
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (!row) return;
              if (confirm("Excluir esta linha?")) {
                onDelete(row.id);
                onOpenChange(false);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir linha
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
