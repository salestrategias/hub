"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Sparkles, UserPlus, Link2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadCard } from "@/components/leads-kanban";

/**
 * Modal de conversão Lead → Cliente.
 *
 * 2 modos:
 *  - "novo": cria Cliente a partir dos dados do lead. Valor mensal
 *    inicialmente pré-preenchido com o valorEstimadoMensal do lead
 *    (editável).
 *  - "existente": vincula a um cliente já cadastrado (típico de upsell —
 *    cliente atual fechou um pacote a mais).
 *
 * Em qualquer modo, o lead vira GANHO e fica linkado ao cliente.
 */
export function ConverterLeadDialog({
  lead,
  clientes,
  onClose,
  onConvertido,
}: {
  lead: LeadCard;
  clientes: Array<{ id: string; nome: string; status: string }>;
  onClose: () => void;
  onConvertido: (cliente: { id: string; nome: string }) => void;
}) {
  const [modo, setModo] = useState<"novo" | "existente">("novo");
  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState(
    lead.valorEstimadoMensal ? String(lead.valorEstimadoMensal) : ""
  );
  const [convertendo, setConvertendo] = useState(false);

  async function converter() {
    if (modo === "existente" && !clienteId) {
      toast.error("Selecione um cliente existente");
      return;
    }
    setConvertendo(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo,
          clienteId: modo === "existente" ? clienteId : null,
          valorContratoMensal: valor ? Number(valor) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      const data = await res.json();
      onConvertido({ id: data.clienteId, nome: data.clienteNome });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setConvertendo(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Converter em cliente
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Lead: <span className="font-medium">{lead.empresa}</span>. Como você quer transformar?
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle de modo — 2 cards radio */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModo("novo")}
              className={cn(
                "rounded-md border p-3 text-left transition",
                modo === "novo"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-border hover:border-muted-foreground"
              )}
            >
              <UserPlus className={cn("h-4 w-4 mb-1.5", modo === "novo" ? "text-emerald-400" : "text-muted-foreground")} />
              <div className="text-[12px] font-semibold">Novo cliente</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Cria cadastro novo com dados do lead
              </div>
            </button>
            <button
              type="button"
              onClick={() => setModo("existente")}
              className={cn(
                "rounded-md border p-3 text-left transition",
                modo === "existente"
                  ? "border-sal-500 bg-sal-500/10"
                  : "border-border hover:border-muted-foreground"
              )}
            >
              <Link2 className={cn("h-4 w-4 mb-1.5", modo === "existente" ? "text-sal-400" : "text-muted-foreground")} />
              <div className="text-[12px] font-semibold">Cliente existente</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Upsell: vincula a cadastro atual
              </div>
            </button>
          </div>

          {modo === "novo" ? (
            <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Dados que viram cliente
              </div>
              <div className="space-y-1 text-[11.5px]">
                <div>
                  <span className="text-muted-foreground">Nome:</span> {lead.empresa}
                </div>
                {lead.contatoEmail && (
                  <div>
                    <span className="text-muted-foreground">Email:</span> {lead.contatoEmail}
                  </div>
                )}
                {lead.contatoTelefone && (
                  <div>
                    <span className="text-muted-foreground">Telefone:</span> {lead.contatoTelefone}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label className="text-[11px]">Valor contratado (mensal)</Label>
                <Input
                  type="number"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="3500"
                  step={100}
                />
                <p className="text-[10px] text-muted-foreground/70">
                  Pré-preenchido com a estimativa do lead. Ajuste com o valor final negociado.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Cliente existente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes
                      .filter((c) => c.status !== "CHURNED")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} <span className="text-[10px] text-muted-foreground ml-1">· {c.status}</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Novo valor mensal (opcional)</Label>
                <Input
                  type="number"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="Deixe vazio pra manter o atual"
                  step={100}
                />
                <p className="text-[10px] text-muted-foreground/70">
                  Se preencher, atualiza o `valorContratoMensal` do cliente. Útil pra upsell.
                </p>
              </div>
            </div>
          )}

          <div className="text-[10.5px] text-muted-foreground/70 bg-emerald-500/5 border-l-2 border-emerald-500/30 rounded-md p-2.5">
            ✓ Lead será marcado como <strong>Ganho</strong> e linkado ao cliente. A relação fica
            registrada (você sempre pode rastrear de qual lead veio cada cliente).
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={convertendo}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={converter} disabled={convertendo} className="bg-emerald-600 hover:bg-emerald-700">
            {convertendo ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Convertendo...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Confirmar conversão
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
