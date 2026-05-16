"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { postSchema, type PostInput } from "@/lib/schemas";
import { toast } from "@/components/ui/toast";
import { Plus } from "lucide-react";
import { RichTextField } from "@/components/editor";
import { PostSheet } from "@/components/sheets/post-sheet";
import { useEntitySheet } from "@/components/entity-sheet";
import type { EditorBlock as PartialBlock } from "@/components/editor/types";

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

type Post = {
  id: string;
  titulo: string;
  legenda: string | null;
  pilar: string | null;
  formato: "FEED" | "STORIES" | "REELS" | "CARROSSEL";
  status: "RASCUNHO" | "COPY_PRONTA" | "DESIGN_PRONTO" | "AGENDADO" | "PUBLICADO";
  dataPublicacao: string;
  clienteId: string;
  clienteNome: string;
  googleEventId: string | null;
};

const STATUS_COR: Record<Post["status"], string> = {
  RASCUNHO: "#64748B",
  COPY_PRONTA: "#3B82F6",
  DESIGN_PRONTO: "#8B5CF6",
  AGENDADO: "#F59E0B",
  PUBLICADO: "#10B981",
};

export function EditorialCalendarClient({
  posts, clientes,
}: { posts: Post[]; clientes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  // Edição via Sheet (peek mode) — URL state via ?post=<id>
  const sheet = useEntitySheet("post");

  const filtrados = posts.filter((p) =>
    (!filtroCliente || p.clienteId === filtroCliente) &&
    (!filtroStatus || p.status === filtroStatus)
  );

  const eventos: Event[] = useMemo(
    () =>
      filtrados.map((p) => ({
        title: `${p.clienteNome} · ${p.titulo}`,
        start: new Date(p.dataPublicacao),
        end: new Date(p.dataPublicacao),
        resource: p,
      })),
    [filtrados]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Select value={filtroCliente} onValueChange={(v) => setFiltroCliente(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="RASCUNHO">Rascunho</SelectItem>
              <SelectItem value="COPY_PRONTA">Copy pronta</SelectItem>
              <SelectItem value="DESIGN_PRONTO">Design pronto</SelectItem>
              <SelectItem value="AGENDADO">Agendado</SelectItem>
              <SelectItem value="PUBLICADO">Publicado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setDefaultDate(new Date()); setCreating(true); }}>
          <Plus className="h-4 w-4" /> Novo post
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-4" style={{ height: 680 }}>
        <Calendar
          localizer={localizer}
          events={eventos}
          startAccessor="start"
          endAccessor="end"
          culture="pt-BR"
          messages={{
            next: "Próximo", previous: "Anterior", today: "Hoje",
            month: "Mês", week: "Semana", day: "Dia", agenda: "Agenda", noEventsInRange: "Sem posts no período",
          }}
          onSelectEvent={(e) => sheet.open((e.resource as Post).id)}
          onSelectSlot={(slot) => { setDefaultDate(slot.start as Date); setCreating(true); }}
          selectable
          eventPropGetter={(e) => {
            const p = e.resource as Post;
            return { style: { backgroundColor: STATUS_COR[p.status], borderRadius: 6, border: 0, fontSize: 11 } };
          }}
        />
      </div>

      {creating && (
        <NovoPostDialog
          open={creating}
          onOpenChange={setCreating}
          clientes={clientes}
          defaultDate={defaultDate}
        />
      )}

      <PostSheet
        postId={sheet.id}
        open={sheet.isOpen}
        onOpenChange={(o) => {
          if (!o) sheet.close();
          // Refresh ao fechar — calendário precisa refletir mudanças de
          // status, data, etc
          if (!o) router.refresh();
        }}
        clientes={clientes}
      />
    </div>
  );
}

/**
 * Dialog de criação de post.
 * Edição vive no PostSheet (peek mode) — esse dialog é só pra criar.
 */
function NovoPostDialog({
  open, onOpenChange, clientes, defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientes: { id: string; nome: string }[];
  defaultDate?: Date | null;
}) {
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<PostInput>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      titulo: "",
      legenda: "",
      pilar: "",
      formato: "FEED",
      status: "RASCUNHO",
      clienteId: clientes[0]?.id ?? "",
      dataPublicacao: defaultDate ?? new Date(),
    },
  });

  async function onSubmit(values: PostInput) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    toast.success("Post criado");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Novo post</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5"><Label>Título*</Label><Input {...register("titulo")} /></div>
          <div className="space-y-1.5">
            <Label>Legenda</Label>
            <RichTextField
              value={watch("legenda") ?? ""}
              onChange={(blocks: PartialBlock[]) => setValue("legenda", JSON.stringify(blocks))}
              placeholder="Copy do post — / abre blocos, @ menciona entidades..."
              minHeight="100px"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Pilar</Label><Input {...register("pilar")} placeholder="Ex: Educacional, Vendas" /></div>
            <div className="space-y-1.5">
              <Label>Cliente*</Label>
              <Select value={watch("clienteId")} onValueChange={(v) => setValue("clienteId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select value={watch("formato")} onValueChange={(v) => setValue("formato", v as PostInput["formato"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEED">Feed</SelectItem>
                  <SelectItem value="STORIES">Stories</SelectItem>
                  <SelectItem value="REELS">Reels</SelectItem>
                  <SelectItem value="CARROSSEL">Carrossel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as PostInput["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                  <SelectItem value="COPY_PRONTA">Copy pronta</SelectItem>
                  <SelectItem value="DESIGN_PRONTO">Design pronto</SelectItem>
                  <SelectItem value="AGENDADO">Agendado</SelectItem>
                  <SelectItem value="PUBLICADO">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Data de publicação*</Label>
              <Input type="datetime-local" {...register("dataPublicacao")} />
            </div>
          </div>
          {watch("status") === "AGENDADO" && (
            <p className="text-xs text-muted-foreground">Ao salvar como Agendado, um evento será criado na sua Google Agenda.</p>
          )}
          <DialogFooter className="justify-between">
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
