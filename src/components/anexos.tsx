"use client";
/**
 * <Anexos entidadeTipo entidadeId /> — bloco reutilizável de anexos
 * polimórficos (Fase 2). Pendura arquivos em QUALQUER entidade
 * (REUNIAO/LEAD/CLIENTE/...).
 *
 * 2 caminhos pra adicionar (mesmo padrão do post-arquivos-editor):
 *  1. Upload local — imagens comprimidas (resize 1600px, JPEG 80%);
 *     PDF/vídeo/planilha/etc até 5MB como dataURL.
 *  2. Cole URL — Drive/Figma/Canva/link externo → tipo LINK.
 *
 * Lista: thumbnail (IMAGEM) ou ícone por tipo, abrir/baixar, renomear
 * (blur), excluir (confirm), reordenar simples (▲▼).
 *
 * ZERO <style jsx> — só Tailwind.
 */
import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  FileText,
  Link2,
  Trash2,
  Upload,
  Loader2,
  Plus,
  Video,
  Table2,
  Presentation,
  File,
  ExternalLink,
  Download,
  ArrowUp,
  ArrowDown,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type AnexoTipo = "IMAGEM" | "VIDEO" | "DOCUMENTO" | "PLANILHA" | "APRESENTACAO" | "LINK" | "OUTRO";

type Anexo = {
  id: string;
  nome: string;
  url: string;
  tipo: AnexoTipo;
  tamanhoBytes: number | null;
  ordem: number;
};

export function Anexos({
  entidadeTipo,
  entidadeId,
  titulo = "Anexos",
  compact = false,
}: {
  entidadeTipo: string;
  entidadeId: string;
  titulo?: string;
  compact?: boolean;
}) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [urlExterna, setUrlExterna] = useState("");
  const inputFileRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await fetch(
        `/api/anexos?entidadeTipo=${encodeURIComponent(entidadeTipo)}&entidadeId=${encodeURIComponent(entidadeId)}`
      );
      const data = await res.json();
      if (Array.isArray(data)) setAnexos(data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidadeTipo, entidadeId]);

  async function criar(body: { nome: string; url: string; tipo: AnexoTipo; tamanhoBytes?: number | null }) {
    const res = await fetch("/api/anexos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, entidadeTipo, entidadeId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? "Falha ao anexar");
      return false;
    }
    return true;
  }

  async function uploadArquivo(file: File) {
    setEnviando(true);
    try {
      let url: string;
      let tipo: AnexoTipo;
      if (file.type.startsWith("image/")) {
        url = await comprimirImagem(file);
        tipo = "IMAGEM";
      } else if (file.size > 5_000_000) {
        toast.error(`"${file.name}" é grande demais (max 5MB). Use link externo do Drive.`);
        return;
      } else {
        url = await fileToDataURL(file);
        tipo = tipoPorMime(file.type, file.name);
      }
      const ok = await criar({ nome: file.name, url, tipo, tamanhoBytes: file.size });
      if (ok) {
        toast.success("Anexo adicionado");
        await carregar();
      }
    } finally {
      setEnviando(false);
    }
  }

  async function adicionarUrl() {
    const u = urlExterna.trim();
    if (!u) return;
    setEnviando(true);
    try {
      const tipo = tipoPorUrl(u);
      const nome = nomePorUrl(u);
      const ok = await criar({ nome, url: u, tipo });
      if (ok) {
        setUrlExterna("");
        toast.success("Link anexado");
        await carregar();
      }
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este anexo?")) return;
    const res = await fetch(`/api/anexos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    setAnexos((arr) => arr.filter((a) => a.id !== id));
  }

  async function renomear(id: string, nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    await fetch(`/api/anexos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: limpo }),
    });
  }

  // Reordenar simples: troca com vizinho e persiste ordem dos dois.
  async function mover(index: number, dir: -1 | 1) {
    const alvo = index + dir;
    if (alvo < 0 || alvo >= anexos.length) return;
    const lista = [...anexos];
    [lista[index], lista[alvo]] = [lista[alvo], lista[index]];
    // Recalcula ordens sequenciais
    const renumerados = lista.map((a, i) => ({ ...a, ordem: (i + 1) * 10 }));
    setAnexos(renumerados);
    try {
      await Promise.all(
        [renumerados[index], renumerados[alvo]].map((a) =>
          fetch(`/api/anexos/${a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordem: a.ordem }),
          })
        )
      );
    } catch {
      toast.error("Falha ao reordenar — recarregando");
      carregar();
    }
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Paperclip className="h-3 w-3" /> {titulo}
          {anexos.length > 0 && <span className="text-muted-foreground/60">({anexos.length})</span>}
        </div>
      )}

      {/* Botões de adicionar */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputFileRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            for (const f of files) await uploadArquivo(f);
            if (inputFileRef.current) inputFileRef.current.value = "";
          }}
        />
        <Button size="sm" variant="outline" onClick={() => inputFileRef.current?.click()} disabled={enviando}>
          {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
        </Button>
        <div className="flex gap-1 flex-1 min-w-[200px]">
          <Input
            value={urlExterna}
            onChange={(e) => setUrlExterna(e.target.value)}
            placeholder="Cole link do Drive, Figma, Canva..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && adicionarUrl()}
          />
          <Button size="sm" onClick={adicionarUrl} disabled={!urlExterna.trim() || enviando}>
            <Plus className="h-3.5 w-3.5" /> Anexar
          </Button>
        </div>
      </div>

      <p className="text-[10.5px] text-muted-foreground">
        Imagens são comprimidas automaticamente. Para arquivos pesados (vídeo, PDF grande), use link do Drive.
      </p>

      {/* Lista */}
      {carregando ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : anexos.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nenhum anexo ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {anexos.map((a, idx) => (
            <div
              key={a.id}
              className="flex items-start gap-2 p-2 rounded-md border border-border bg-card/40"
            >
              <Thumb anexo={a} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Input
                  defaultValue={a.nome}
                  className="h-7 text-[11px] font-medium"
                  onBlur={(e) => renomear(a.id, e.target.value)}
                />
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="uppercase tracking-wide">{TIPO_LABEL[a.tipo]}</span>
                  {a.tamanhoBytes ? <span>· {fmtBytes(a.tamanhoBytes)}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={idx === 0}
                  onClick={() => mover(idx, -1)}
                  title="Mover para cima"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={idx === anexos.length - 1}
                  onClick={() => mover(idx, 1)}
                  title="Mover para baixo"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" asChild title="Abrir / baixar">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" download={a.tipo === "LINK" ? undefined : a.nome}>
                    {a.tipo === "LINK" ? <ExternalLink className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => excluir(a.id)}
                  className="text-destructive hover:text-destructive h-6 w-6"
                  title="Excluir"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ anexo }: { anexo: Anexo }) {
  if (anexo.tipo === "IMAGEM") {
    return (
      <a
        href={anexo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-12 h-12 rounded-md overflow-hidden shrink-0 bg-muted block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={anexo.url} alt={anexo.nome} className="w-full h-full object-cover" />
      </a>
    );
  }
  const Icon = TIPO_ICON[anexo.tipo];
  return (
    <div className={cn("w-12 h-12 rounded-md bg-muted shrink-0 flex items-center justify-center")}>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

// ─── Catálogos ──────────────────────────────────────────────────────

const TIPO_ICON: Record<AnexoTipo, typeof FileText> = {
  IMAGEM: ImageIcon,
  VIDEO: Video,
  DOCUMENTO: FileText,
  PLANILHA: Table2,
  APRESENTACAO: Presentation,
  LINK: Link2,
  OUTRO: File,
};

const TIPO_LABEL: Record<AnexoTipo, string> = {
  IMAGEM: "Imagem",
  VIDEO: "Vídeo",
  DOCUMENTO: "Documento",
  PLANILHA: "Planilha",
  APRESENTACAO: "Apresentação",
  LINK: "Link",
  OUTRO: "Arquivo",
};

// ─── Helpers ────────────────────────────────────────────────────────

function tipoPorMime(mime: string, nome: string): AnexoTipo {
  if (mime.startsWith("image/")) return "IMAGEM";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime === "application/pdf") return "DOCUMENTO";
  const n = nome.toLowerCase();
  if (/\.(xlsx?|csv|ods|numbers)$/.test(n) || mime.includes("spreadsheet") || mime.includes("excel")) return "PLANILHA";
  if (/\.(pptx?|key|odp)$/.test(n) || mime.includes("presentation") || mime.includes("powerpoint")) return "APRESENTACAO";
  if (/\.(docx?|odt|rtf|txt|md)$/.test(n) || mime.includes("word") || mime.startsWith("text/")) return "DOCUMENTO";
  return "OUTRO";
}

function tipoPorUrl(url: string): AnexoTipo {
  const u = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/.test(u)) return "IMAGEM";
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(u)) return "VIDEO";
  if (/\.(pdf|docx?|odt|txt|md)(\?|$)/.test(u)) return "DOCUMENTO";
  if (/\.(xlsx?|csv|ods)(\?|$)/.test(u) || u.includes("/spreadsheets/")) return "PLANILHA";
  if (/\.(pptx?|key|odp)(\?|$)/.test(u) || u.includes("/presentation/")) return "APRESENTACAO";
  return "LINK";
}

function nomePorUrl(url: string): string {
  try {
    const u = new URL(url);
    // Links conhecidos do Google: nome amigável
    if (u.hostname.includes("docs.google.com") || u.hostname.includes("drive.google.com")) {
      if (u.pathname.includes("/spreadsheets/")) return "Planilha (Google)";
      if (u.pathname.includes("/presentation/")) return "Apresentação (Google)";
      if (u.pathname.includes("/document/")) return "Documento (Google)";
      return "Arquivo do Drive";
    }
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last && last.length > 1) return decodeURIComponent(last);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resize máx 1600px (lado maior), JPEG 80%. Volta dataURL pequeno que
 * cabe bem no Postgres @db.Text.
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
