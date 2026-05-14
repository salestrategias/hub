"use client";
/**
 * Dialog pra vincular um Criativo a uma CampanhaPaga existente do mesmo
 * cliente. Marcelo aciona pelo botão "Vincular campanha" na sheet do
 * criativo. Lista só campanhas do mesmo cliente, ordenadas por ano/mês
 * desc (mais recentes primeiro).
 *
 * Permite também desvincular (selecionar "—").
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";

type Campanha = {
  id: string;
  nome: string;
  ano: number;
  mes: number;
  plataforma: string;
};

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function VincularCampanhaDialog({
  criativoId,
  clienteId,
  campanhaAtualId,
  open,
  onOpenChange,
  onVinculada,
}: {
  criativoId: string;
  clienteId: string;
  campanhaAtualId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onVinculada?: () => void;
}) {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [selecionada, setSelecionada] = useState<string>(campanhaAtualId ?? "");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCarregando(true);
    fetch(`/api/relatorios/trafego?clienteId=${clienteId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCampanhas(
            data
              .map((c: any) => ({
                id: c.id,
                nome: c.nome,
                ano: c.ano,
                mes: c.mes,
                plataforma: c.plataforma,
              }))
              .sort((a: Campanha, b: Campanha) => b.ano - a.ano || b.mes - a.mes)
          );
        }
      })
      .catch(() => toast.error("Falha ao carregar campanhas"))
      .finally(() => setCarregando(false));
  }, [open, clienteId]);

  useEffect(() => {
    setSelecionada(campanhaAtualId ?? "");
  }, [campanhaAtualId]);

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch(`/api/criativos/${criativoId}/vincular-campanha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campanhaPagaId: selecionada || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha");
        return;
      }
      toast.success(selecionada ? "Campanha vinculada" : "Vínculo removido");
      onVinculada?.();
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular a uma campanha paga</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Vincule este criativo a uma campanha já cadastrada em Relatórios &gt; Tráfego Pago.
            Permite depois cruzar performance da campanha com o criativo.
          </p>

          {carregando ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : campanhas.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhuma campanha cadastrada pra este cliente em Relatórios &gt; Tráfego Pago.
            </div>
          ) : (
            <Select value={selecionada || "_none"} onValueChange={(v) => setSelecionada(v === "_none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Sem vínculo</SelectItem>
                {campanhas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} · {MESES[c.mes]}/{c.ano} · {c.plataforma.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">Cancelar</Button>
          </DialogClose>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
