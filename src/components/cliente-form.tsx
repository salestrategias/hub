"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clienteSchema, type ClienteInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { Plus } from "lucide-react";
import { TagPicker } from "@/components/tag-picker";

export function ClienteFormButton({ initial, id }: { initial?: Partial<ClienteInput>; id?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!id;

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome: initial?.nome ?? "",
      cnpj: initial?.cnpj ?? "",
      email: initial?.email ?? "",
      telefone: initial?.telefone ?? "",
      endereco: initial?.endereco ?? "",
      status: (initial?.status as "ATIVO" | "INATIVO" | "PROSPECT" | "CHURNED") ?? "ATIVO",
      valorContratoMensal: Number(initial?.valorContratoMensal ?? 0),
      notas: initial?.notas ?? "",
      tagIds: initial?.tagIds ?? [],
    },
  });

  const tagIds = watch("tagIds") ?? [];

  async function onSubmit(values: ClienteInput) {
    const url = isEdit ? `/api/clientes/${id}` : "/api/clientes";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao salvar");
      return;
    }
    toast.success(isEdit ? "Cliente atualizado" : "Cliente criado");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{isEdit ? "Editar" : <><Plus className="h-4 w-4" /> Novo cliente</>}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome*" error={errors.nome?.message}>
              <Input {...register("nome")} />
            </Field>
            <Field label="CNPJ">
              <Input {...register("cnpj")} placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Email">
              <Input type="email" {...register("email")} />
            </Field>
            <Field label="Telefone">
              <Input {...register("telefone")} placeholder="(51) 99999-9999" />
            </Field>
            <Field label="Status" className="col-span-1">
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "ATIVO" | "INATIVO" | "PROSPECT" | "CHURNED")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="PROSPECT">Prospect</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                  <SelectItem value="CHURNED">Churned</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valor mensal (R$)">
              <Input type="number" step="0.01" {...register("valorContratoMensal")} />
            </Field>
            <Field label="Endereço" className="col-span-2">
              <Input {...register("endereco")} />
            </Field>
            <Field label="Notas" className="col-span-2">
              <Textarea rows={3} {...register("notas")} />
            </Field>
            <Field label="Tags" className="col-span-2">
              <TagPicker selectedIds={tagIds} onChange={(ids) => setValue("tagIds", ids, { shouldDirty: true })} />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className, error }: { label: string; children: React.ReactNode; className?: string; error?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
