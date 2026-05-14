"use client";
/**
 * Editor de artes/anexos do post (usado no post-sheet).
 *
 * 2 caminhos pra adicionar:
 *  1. Upload local — drag-drop ou clique. Imagens são comprimidas
 *     antes de salvar (resize máx 1600px, qualidade 80%, JPEG) pra
 *     não estourar o banco com arquivos brutos da câmera (5MB+).
 *  2. Cole URL — útil pra Drive/Figma/Canva (LINK_EXTERNO).
 *
 * Lista mostra thumbnails (IMAGEM/VIDEO) ou ícone (DOCUMENTO/LINK).
 * Drag-drop reordena.
 */
import { useEffect, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Image as ImageIcon, FileText, Link2, Trash2, GripVertical, Upload, Loader2, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

type Arquivo = {
  id: string;
  tipo: "IMAGEM" | "VIDEO" | "DOCUMENTO" | "LINK_EXTERNO";
  url: string;
  nome: string | null;
  legenda: string | null;
  ordem: number;
};

export function PostArquivosEditor({ postId }: { postId: string }) {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [urlExterna, setUrlExterna] = useState("");
  const inputFileRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await fetch(`/api/posts/${postId}/arquivos`);
      const data = await res.json();
      if (Array.isArray(data)) setArquivos(data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function uploadArquivo(file: File) {
    setEnviando(true);
    try {
      let url: string;
      let tipo: Arquivo["tipo"];
      if (file.type.startsWith("image/")) {
        url = await comprimirImagem(file);
        tipo = "IMAGEM";
      } else if (file.type.startsWith("video/")) {
        // Vídeos não comprimimos (precisaria ffmpeg). Permite até 5MB raw.
        if (file.size > 5_000_000) {
          toast.error("Vídeo grande demais (max 5MB). Use link externo do Drive.");
          return;
        }
        url = await fileToDataURL(file);
        tipo = "VIDEO";
      } else if (file.type === "application/pdf") {
        if (file.size > 5_000_000) {
          toast.error("PDF grande demais (max 5MB).");
          return;
        }
        url = await fileToDataURL(file);
        tipo = "DOCUMENTO";
      } else {
        toast.error("Tipo de arquivo não suportado");
        return;
      }

      const res = await fetch(`/api/posts/${postId}/arquivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          url,
          nome: file.name,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao enviar");
        return;
      }
      toast.success("Arte adicionada");
      await carregar();
    } finally {
      setEnviando(false);
    }
  }

  async function adicionarUrl() {
    if (!urlExterna.trim()) return;
    setEnviando(true);
    try {
      // Detecta tipo pela URL (heurística simples)
      const u = urlExterna.toLowerCase();
      const tipo: Arquivo["tipo"] = /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(u)
        ? "IMAGEM"
        : /\.(mp4|mov|webm)(\?|$)/.test(u)
        ? "VIDEO"
        : "LINK_EXTERNO";

      const res = await fetch(`/api/posts/${postId}/arquivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, url: urlExterna.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha");
        return;
      }
      setUrlExterna("");
      toast.success("Link adicionado");
      await carregar();
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este anexo?")) return;
    const res = await fetch(`/api/posts/arquivos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    setArquivos((arr) => arr.filter((a) => a.id !== id));
  }

  async function atualizarLegenda(id: string, legenda: string) {
    await fetch(`/api/posts/arquivos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legenda }),
    });
  }

  async function onDragEnd(r: DropResult) {
    if (!r.destination || r.source.index === r.destination.index) return;
    const lista = [...arquivos];
    const [moved] = lista.splice(r.source.index, 1);
    lista.splice(r.destination.index, 0, moved);
    // Recalcula ordens
    const novosItens = lista.map((a, i) => ({ id: a.id, ordem: (i + 1) * 10 }));
    setArquivos(lista.map((a, i) => ({ ...a, ordem: (i + 1) * 10 })));

    try {
      await fetch(`/api/posts/${postId}/arquivos/reordenar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens: novosItens }),
      });
    } catch {
      toast.error("Falha ao reordenar — recarregando");
      carregar();
    }
  }

  return (
    <div className="space-y-3">
      {/* Botões de adicionar */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputFileRef}
          type="file"
          accept="image/*,video/*,application/pdf"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            for (const f of files) await uploadArquivo(f);
            if (inputFileRef.current) inputFileRef.current.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputFileRef.current?.click()}
          disabled={enviando}
        >
          {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload (imagem/vídeo/PDF)
        </Button>
        <div className="flex gap-1 flex-1 min-w-[200px]">
          <Input
            value={urlExterna}
            onChange={(e) => setUrlExterna(e.target.value)}
            placeholder="Cole URL do Drive, Figma, Canva..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && adicionarUrl()}
          />
          <Button size="sm" onClick={adicionarUrl} disabled={!urlExterna.trim() || enviando}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </div>

      <p className="text-[10.5px] text-muted-foreground">
        Imagens grandes são comprimidas automaticamente (max 1600px, ~200KB).
        Pra vídeos pesados, use link externo do Drive.
      </p>

      {/* Lista */}
      {carregando ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : arquivos.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nenhuma arte anexada ainda.
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="arquivos">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {arquivos.map((a, idx) => (
                  <Draggable key={a.id} draggableId={a.id} index={idx}>
                    {(prov, snap) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={`flex items-start gap-2 p-2 rounded-md border border-border bg-card/40 ${
                          snap.isDragging ? "shadow-lg" : ""
                        }`}
                      >
                        <span
                          {...prov.dragHandleProps}
                          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing mt-2"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <Thumb arquivo={a} />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="font-medium truncate">{a.nome ?? a.tipo}</span>
                            <span className="text-muted-foreground/60">#{idx + 1}</span>
                          </div>
                          <Input
                            defaultValue={a.legenda ?? ""}
                            placeholder="Legenda deste slide (opcional, ex: 'Slide 1 — Capa')"
                            className="h-7 text-[11px]"
                            onBlur={(e) => atualizarLegenda(a.id, e.target.value)}
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => excluir(a.id)}
                          className="text-destructive hover:text-destructive h-7 w-7"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}

function Thumb({ arquivo }: { arquivo: Arquivo }) {
  if (arquivo.tipo === "IMAGEM") {
    return (
      <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={arquivo.url} alt={arquivo.nome ?? ""} className="w-full h-full object-cover" />
      </div>
    );
  }
  if (arquivo.tipo === "VIDEO") {
    return (
      <div className="w-14 h-14 rounded-md bg-muted shrink-0 flex items-center justify-center">
        <Video className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
  if (arquivo.tipo === "DOCUMENTO") {
    return (
      <div className="w-14 h-14 rounded-md bg-muted shrink-0 flex items-center justify-center">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 rounded-md bg-muted shrink-0 flex items-center justify-center">
      <Link2 className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resize máx 1600px (lado maior), JPEG 80%. Volta dataURL pequeno
 * (~100-300KB pra fotos típicas) que cabe bem no Postgres @db.Text.
 */
async function comprimirImagem(file: File, maxLado = 1600, qualidade = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", qualidade);
}
