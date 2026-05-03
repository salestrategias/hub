"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { contratoSchema, type ContratoInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { formatBRL, formatDate, diffDias } from "@/lib/utils";
import { Plus, Trash2, FileText, ExternalLink } from "lucide-react";
import { DriveFilePicker } from "@/components/drive-file-picker";

type Contrato = {
  id: string;
  clienteId: string;
  clienteNome: string;
  valor: number;
  dataInicio: string;
  dataFim: string;
  status: "ATIVO" | "ENCERRADO" | "EM_RENOVACAO" | "CANCELADO";
  multaRescisoria: string | null;
  reajuste: string | null;
  observacoes: string | null;
  googleDriveFileId: string | null;
  googleDriveFileUrl: string | null;
};

export function ContratosClient({
  contratos, clientes,
}: { contratos: Contrato[]; clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NovoContrato clientes={clientes} /></div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vence em</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratos.map((c) => {
                const dias = diffDias(c.dataFim);
                const badge =
                  c.status === "ATIVO" && dias <= 30 ? "destructive" :
                  c.status === "ATIVO" && dias <= 60 ? "warning" :
                  c.status === "ATIVO" && dias <= 90 ? "secondary" :
                  c.status === "ATIVO" ? "success" :
                  "muted";
                async function excluir() {
                  if (!confirm("Excluir contrato?")) return;
                  await fetch(`/api/contratos/${c.id}`, { method: "DELETE" });
                  toast.success("Excluído");
                  router.refresh();
                }
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.clienteNome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {formatDate(c.dataInicio)} → {formatDate(c.dataFim)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(c.valor)}</TableCell>
                    <TableCell><Badge variant={c.status === "ATIVO" ? "success" : c.status === "EM_RENOVACAO" ? "warning" : "muted"}>{c.status.toLowerCase()}</Badge></TableCell>
                    <TableCell><Badge variant={badge}>{dias > 0 ? `${dias}d` : `expirado`}</Badge></TableCell>
                    <TableCell>
                      {c.googleDriveFileUrl ? (
                        <a href={c.googleDriveFileUrl} target="_blank" rel="noreferrer" className="text-primary text-xs flex items-center gap-1 hover:underline">
                          <FileText className="h-3 w-3" /> Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={excluir}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {contratos.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem contratos.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NovoContrato({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false);
  const [arquivo, setArquivo] = useState<{ id: string; url: string; name: string } | null>(null);
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<ContratoInput>({
    resolver: zodResolver(contratoSchema),
    defaultValues: { status: "ATIVO", reajuste: "IGP-M", clienteId: clientes[0]?.id ?? "" },
  });

  async function onSubmit(values: ContratoInput) {
    const payload = {
      ...values,
      googleDriveFileId: arquivo?.id ?? null,
      googleDriveFileUrl: arquivo?.url ?? null,
    };
    const res = await fetch("/api/contratos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { toast.error("Erro"); return; }
    toast.success("Contrato criado");
    reset(); setArquivo(null); setOpen(false); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Novo contrato</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente*</Label>
            <Select value={watch("clienteId")} onValueChange={(v) => setValue("clienteId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Valor mensal*</Label><Input type="number" step="0.01" {...register("valor")} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as ContratoInput["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="EM_RENOVACAO">Em renovação</SelectItem>
                  <SelectItem value="ENCERRADO">Encerrado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Início*</Label><Input type="date" {...register("dataInicio")} /></div>
            <div className="space-y-1.5"><Label>Fim*</Label><Input type="date" {...register("dataFim")} /></div>
            <div className="space-y-1.5"><Label>Multa rescisória</Label><Input {...register("multaRescisoria")} placeholder="Ex: 50% do remanescente" /></div>
            <div className="space-y-1.5"><Label>Reajuste</Label><Input {...register("reajuste")} placeholder="IGP-M" /></div>
            <div className="space-y-1.5 col-span-2"><Label>Observações</Label><Textarea rows={2} {...register("observacoes")} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Arquivo PDF no Drive (opcional)</Label>
            <DriveFilePicker onPick={(f) => setArquivo({ id: f.id, url: f.webViewLink ?? "", name: f.name })} />
            {arquivo && <p className="text-xs text-muted-foreground">Selecionado: {arquivo.name}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
