"use client";
/**
 * Dialog pra escolher mês/ano e gerar o relatório mensal PDF de um
 * cliente. Usado tanto no <ClienteSheet> quanto em quick action da
 * lista de clientes.
 *
 * Fluxo:
 *  1. Escolhe mês/ano (default: mês corrente)
 *  2. Clica "Visualizar" → abre o PDF em nova aba (inline)
 *  3. Ou "Baixar" → download forçado com filename amigável
 *
 * Sem persistência — cada geração roda a API on-demand. Dados sempre
 * frescos. Se ainda não tem métrica daquele mês, o PDF gera com
 * resumo executivo "Sem métricas registradas".
 */
import { useState } from "react";
import { FileText, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export function RelatorioMensalDialog({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clienteId: string;
  clienteNome: string;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [ano, setAno] = useState<number>(hoje.getFullYear());

  // Anos: 2 anos atrás até ano corrente (atualiza dinamicamente)
  const anos = Array.from({ length: 3 }, (_, i) => hoje.getFullYear() - i);

  function urlBase() {
    return `/api/clientes/${clienteId}/relatorio-mensal?ano=${ano}&mes=${mes}`;
  }

  function visualizar() {
    window.open(urlBase(), "_blank");
    onOpenChange(false);
  }

  function baixar() {
    window.open(`${urlBase()}&download=1`, "_blank");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Relatório mensal — {clienteNome}
          </DialogTitle>
          <DialogDescription>
            Gera PDF consolidado com métricas das redes, SEO, tráfego pago,
            conteúdo publicado e operacional. Comparativo automático com o mês anterior.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <strong className="text-foreground">Dica:</strong> rode pra mês passado depois de fechar
          todas as métricas. Se o mês ainda tá rolando, espera fim do período pra ter
          comparativo MoM completo.
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={baixar}>
            <Download className="h-3.5 w-3.5" /> Baixar
          </Button>
          <Button onClick={visualizar}>
            <Eye className="h-3.5 w-3.5" /> Visualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
