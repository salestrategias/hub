"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { Trash2 } from "lucide-react";

export function ClienteDeleteButton({ id, nome }: { id: string; nome: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const router = useRouter();

  async function excluir() {
    setLoading(true);
    const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao excluir");
      return;
    }
    toast.success("Cliente excluído");
    setOpen(false);
    router.push("/clientes");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" /> Excluir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir cliente</DialogTitle>
          <DialogDescription>
            Esta ação remove <strong>{nome}</strong> e tudo o que está vinculado: posts, projetos,
            tarefas, contratos, lançamentos financeiros e métricas. <strong>Não pode ser desfeita.</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm">Para confirmar, digite o nome do cliente:</p>
          <input
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            placeholder={nome}
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={loading || confirmacao.trim() !== nome.trim()}
            onClick={excluir}
          >
            {loading ? "Excluindo..." : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
