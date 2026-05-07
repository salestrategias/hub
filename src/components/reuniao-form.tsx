"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reuniaoSchema, type ReuniaoInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { Mic } from "lucide-react";
import { TemplatePicker } from "@/components/template-picker";

export function ReuniaoFormButton({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm<ReuniaoInput>({
    resolver: zodResolver(reuniaoSchema),
    defaultValues: {
      data: new Date(),
      status: "GRAVADA",
      participantes: [],
      tagsLivres: [],
    },
  });
  const [participantes, setParticipantes] = useState("");
  const [tags, setTags] = useState("");

  async function onSubmit(values: ReuniaoInput) {
    const payload = {
      ...values,
      participantes: participantes.split(",").map((s) => s.trim()).filter(Boolean),
      tagsLivres: tags.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const res = await fetch("/api/reunioes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { toast.error("Erro ao criar reunião"); return; }
    const created = await res.json();
    toast.success("Reunião criada");
    reset(); setParticipantes(""); setTags(""); setFormOpen(false);
    router.push(`/reunioes/${created.id}`);
  }

  return (
    <>
      <Button onClick={() => setPickerOpen(true)}>
        <Mic className="h-4 w-4" /> Nova reunião
      </Button>

      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tipos={["REUNIAO"]}
        onBlank={() => setFormOpen(true)}
        blankLabel="Reunião em branco"
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Nova reunião</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Título*"><Input {...register("titulo")} placeholder="Ex: Renovação contratual — Pipeline Services" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data e hora*"><Input type="datetime-local" {...register("data")} /></Field>
              <Field label="Duração (minutos)"><Input type="number" min={0} {...register("duracaoSeg", { setValueAs: (v) => v ? Number(v) * 60 : null })} /></Field>
            </div>
            <Field label="Cliente">
              <Select onValueChange={(v) => setValue("clienteId", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (interna)</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Participantes (separados por vírgula)">
              <Input value={participantes} onChange={(e) => setParticipantes(e.target.value)} placeholder="Marcelo, Ana, Roberto" />
            </Field>
            <Field label="Tags (separadas por vírgula)">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Briefing, Renovação" />
            </Field>
            <Field label="Resumo / observações iniciais">
              <Textarea rows={3} {...register("notasLivres")} />
            </Field>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
