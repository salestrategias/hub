"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { EntitySheet } from "@/components/entity-sheet";
import { InlineField } from "@/components/inline-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import { BacklinksPanel } from "@/components/backlinks-panel";
import type { PartialBlock } from "@blocknote/core";

type PostFull = {
  id: string;
  titulo: string;
  legenda: string | null;
  pilar: string | null;
  formato: "FEED" | "STORIES" | "REELS" | "CARROSSEL";
  status: "RASCUNHO" | "COPY_PRONTA" | "DESIGN_PRONTO" | "AGENDADO" | "PUBLICADO";
  dataPublicacao: string;
  googleEventId: string | null;
  cliente: { id: string; nome: string } | null;
};

const FORMATO_OPTIONS = [
  { value: "FEED", label: "Feed" },
  { value: "STORIES", label: "Stories" },
  { value: "REELS", label: "Reels" },
  { value: "CARROSSEL", label: "Carrossel" },
];

const STATUS_OPTIONS = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "COPY_PRONTA", label: "Copy pronta" },
  { value: "DESIGN_PRONTO", label: "Design pronto" },
  { value: "AGENDADO", label: "Agendado" },
  { value: "PUBLICADO", label: "Publicado" },
];

const STATUS_COR: Record<PostFull["status"], string> = {
  RASCUNHO: "#9696A8",
  COPY_PRONTA: "#F59E0B",
  DESIGN_PRONTO: "#3B82F6",
  AGENDADO: "#7E30E1",
  PUBLICADO: "#10B981",
};

export function PostSheet({
  postId,
  open,
  onOpenChange,
  clientes,
}: {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes?: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [post, setPost] = useState<PostFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/posts/${postId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao carregar post");
        return r.json();
      })
      .then(setPost)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [postId, open]);

  async function patchPost(patch: Record<string, unknown>) {
    if (!postId) return;
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setPost((p) => (p ? { ...p, ...updated } : p));
  }

  async function excluir() {
    if (!postId || !post) return;
    if (!confirm(`Excluir o post "${post.titulo}"?`)) return;
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Post excluído");
    onOpenChange(false);
    router.refresh();
  }

  const cor = post ? STATUS_COR[post.status] : "#7E30E1";
  const dataPubInput = post?.dataPublicacao ? toLocalInput(post.dataPublicacao) : "";

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !post}
      error={error}
      icone={FileText}
      iconeCor={cor}
      titulo={post?.titulo ?? "Carregando..."}
      subtitulo={
        post && (
          <span className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
              {post.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{post.formato}</Badge>
            {post.cliente && <span className="text-muted-foreground">· {post.cliente.nome}</span>}
            {post.googleEventId && <span className="text-emerald-400 text-[10px]">📅 agendado</span>}
          </span>
        )
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={excluir} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <span className="text-[10.5px] text-muted-foreground/70">Edição salva automaticamente</span>
        </>
      }
    >
      {post && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InlineField
              type="text"
              label="Título"
              value={post.titulo}
              onSave={(v) => patchPost({ titulo: v })}
              size="sm"
              className="col-span-2"
            />
            <InlineField
              type="select"
              label="Status"
              value={post.status}
              options={STATUS_OPTIONS}
              onSave={(v) => patchPost({ status: v })}
              size="sm"
            />
            <InlineField
              type="select"
              label="Formato"
              value={post.formato}
              options={FORMATO_OPTIONS}
              onSave={(v) => patchPost({ formato: v })}
              size="sm"
            />
            <InlineField
              type="datetime-local"
              label="Publicação"
              value={dataPubInput}
              onSave={(v) => patchPost({ dataPublicacao: v ? new Date(v).toISOString() : null })}
              size="sm"
            />
            <InlineField
              type="text"
              label="Pilar"
              value={post.pilar ?? ""}
              onSave={(v) => patchPost({ pilar: v || null })}
              placeholder="Educacional, vendas, bastidor..."
              size="sm"
            />
            {clientes && clientes.length > 0 && (
              <InlineField
                type="select"
                label="Cliente"
                value={post.cliente?.id ?? ""}
                options={[{ value: "", label: "—" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
                onSave={(v) => patchPost({ clienteId: v || null })}
                size="sm"
                className="col-span-2"
              />
            )}
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Legenda
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <BlockEditor
                value={post.legenda ?? ""}
                onChange={(blocks: PartialBlock[]) => patchPost({ legenda: JSON.stringify(blocks) })}
                placeholder="Copy do post. / abre menu de blocos, @ menciona cliente/reunião/post relacionado."
                minHeight="180px"
              />
            </div>
          </div>

          {postId && <BacklinksPanel type="POST" id={postId} hideWhenEmpty title="Mencionado em" />}
        </div>
      )}
    </EntitySheet>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
