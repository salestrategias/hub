"use client";
/**
 * Portal v4 — envio de conteúdo PELO CLIENTE (caminho inverso).
 *
 * Este arquivo concentra as peças reutilizáveis do fluxo de envio:
 *   - <UploaderArquivos>  — dropzone (arrastar/colar/câmera/galeria) com
 *     compressão client-side de imagem; usado na aba Enviar e no
 *     "Anexar arte" de um post existente.
 *   - <MinhasSubmissoes>  — lista das submissões do próprio cliente
 *     com badge de status (Em revisão / Aprovado / Ajuste pedido).
 *
 * O formulário completo de submissão (v2/v3) foi substituído pela aba
 * Enviar (portal-enviar-tab.tsx) — classificar conteúdo é trabalho da
 * SAL, não do cliente.
 *
 * Mobile-first: touch targets 44px, safe-area herdada do shell.
 * Sem <style jsx>.
 */
import { useRef, useState } from "react";
import {
  Upload,
  Link2,
  Trash2,
  Loader2,
  Send,
  FileText,
  Video,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";

export type ModoEnvio = "post" | "criativo";

export type ArquivoLocal = {
  tipo: "IMAGEM" | "VIDEO" | "DOCUMENTO" | "LINK_EXTERNO";
  url: string; // dataURL ou URL externa
  nome: string | null;
};

export type Submissao = {
  id: string;
  titulo: string;
  revisao: "PENDENTE" | "APROVADO" | "AJUSTE" | null;
  revisaoNota: string | null;
  createdAt: string;
  // Campos extras (post: formato/dataPublicacao; criativo: plataforma)
  formato?: string;
  plataforma?: string;
  dataPublicacao?: string;
  arquivos: { id: string; tipo: string; url: string; nome: string | null }[];
};

// ─── Lista das submissões do próprio cliente ────────────────────────
export function MinhasSubmissoes({ modo, submissoes }: { modo: ModoEnvio; submissoes: Submissao[] }) {
  if (submissoes.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Send className="h-3 w-3" />
        {modo === "post" ? "Posts que você enviou" : "Criativos que você enviou"} ({submissoes.length})
      </h2>
      <div className="space-y-2">
        {submissoes.map((s) => (
          <SubmissaoCard key={s.id} modo={modo} submissao={s} />
        ))}
      </div>
    </section>
  );
}

function SubmissaoCard({ modo, submissao }: { modo: ModoEnvio; submissao: Submissao }) {
  const status = submissao.revisao ?? "PENDENTE";
  const thumb = submissao.arquivos.find((a) => a.tipo === "IMAGEM");

  return (
    <Card className={`border-l-4 ${corBordaStatus(status)}`}>
      <CardContent className="p-3 flex items-start gap-3">
        {thumb ? (
          <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb.url} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-md shrink-0 bg-muted flex items-center justify-center">
            {modo === "post" ? (
              <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
            ) : (
              <Send className="h-5 w-5 text-muted-foreground/50" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-[13px] leading-tight truncate">{submissao.titulo}</h3>
            <BadgeStatus status={status} />
          </div>
          <p className="text-[10.5px] text-muted-foreground">
            Enviado em {new Date(submissao.createdAt).toLocaleDateString("pt-BR")}
          </p>
          {status === "AJUSTE" && submissao.revisaoNota && (
            <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-2 mt-1">
              <div className="flex items-center gap-1.5 text-[10.5px] text-amber-500 font-medium mb-1">
                <AlertTriangle className="h-3 w-3" /> Ajuste pedido pela SAL
              </div>
              <p className="text-[12px] leading-snug whitespace-pre-wrap">{submissao.revisaoNota}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Borda lateral soft do card por status (legível claro+escuro, via tokens). */
function corBordaStatus(status: string): string {
  if (status === "APROVADO") return "border-l-emerald-500/60";
  if (status === "AJUSTE") return "border-l-amber-500/60";
  return "border-l-sky-500/60"; // PENDENTE
}

/** Chip de status soft — fundo translúcido + texto colorido legível nos dois temas. */
function BadgeStatus({ status }: { status: string }) {
  const base =
    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold shrink-0 whitespace-nowrap";
  if (status === "APROVADO") {
    return (
      <span className={`${base} bg-emerald-500/12 text-emerald-600 dark:text-emerald-400`}>
        <CheckCircle2 className="h-3 w-3" /> Aprovado
      </span>
    );
  }
  if (status === "AJUSTE") {
    return (
      <span className={`${base} bg-amber-500/12 text-amber-600 dark:text-amber-400`}>
        <AlertTriangle className="h-3 w-3" /> Ajuste pedido
      </span>
    );
  }
  return (
    <span className={`${base} bg-sky-500/12 text-sky-600 dark:text-sky-400`}>
      <Clock className="h-3 w-3" /> Em revisão
    </span>
  );
}

/**
 * Uploader de artes/vídeo reutilizável — Portal v4.
 *
 * Dropzone de verdade: arrastar & soltar, colar da área de transferência
 * (Ctrl+V), câmera direta no mobile (input capture) e galeria. Arquivos
 * processam em fila com preview progressivo. Owner do estado é o pai
 * (controlled via value/onChange).
 *
 * `processando` é reportado via onProcessandoChange pra o pai desabilitar
 * o botão de submit enquanto uma imagem comprime.
 *
 * `grande` deixa a dropzone em formato hero (usada na aba Enviar).
 * Os limites atuais (vídeo/PDF 5MB, imagem comprimida client-side) vêm do
 * armazenamento em banco — caem quando o storage de arquivos entrar (F2).
 */
export function UploaderArquivos({
  value,
  onChange,
  onProcessandoChange,
  grande = false,
}: {
  value: ArquivoLocal[];
  onChange: (arquivos: ArquivoLocal[]) => void;
  onProcessandoChange?: (processando: boolean) => void;
  grande?: boolean;
}) {
  const [urlExterna, setUrlExterna] = useState("");
  const [filaProcessando, setFilaProcessando] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const inputCameraRef = useRef<HTMLInputElement>(null);
  // `value` muda durante o processamento em fila — ref evita perder itens.
  const valueRef = useRef(value);
  valueRef.current = value;

  function reportarProc(delta: number) {
    setFilaProcessando((n) => {
      const novo = Math.max(0, n + delta);
      onProcessandoChange?.(novo > 0);
      return novo;
    });
  }

  async function processarArquivo(file: File) {
    reportarProc(1);
    try {
      let url: string;
      let tipo: ArquivoLocal["tipo"];
      if (file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)) {
        try {
          url = await comprimirImagem(file);
        } catch {
          // HEIC/HEIF sem suporte no navegador → orienta em vez de falhar mudo
          toast.error(
            `"${file.name}": formato de foto não suportado neste navegador. Tente exportar como JPEG.`
          );
          return;
        }
        tipo = "IMAGEM";
      } else if (file.type.startsWith("video/")) {
        if (file.size > 5_000_000) {
          toast.error("Vídeo acima de 5MB por enquanto: cole um link do Drive/YouTube.");
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
        toast.error(`"${file.name}": tipo de arquivo não suportado`);
        return;
      }
      onChange([...valueRef.current, { tipo, url, nome: file.name }]);
    } finally {
      reportarProc(-1);
    }
  }

  async function processarLista(files: File[]) {
    for (const f of files) await processarArquivo(f);
  }

  function adicionarUrl() {
    const u = urlExterna.trim();
    if (!u) return;
    const low = u.toLowerCase();
    const tipo: ArquivoLocal["tipo"] = /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(low)
      ? "IMAGEM"
      : /\.(mp4|mov|webm)(\?|$)/.test(low)
      ? "VIDEO"
      : "LINK_EXTERNO";
    onChange([...valueRef.current, { tipo, url: u, nome: null }]);
    setUrlExterna("");
  }

  function removerArquivo(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void processarLista(files);
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length > 0) {
      e.preventDefault();
      void processarLista(files);
    }
  }

  const processando = filaProcessando > 0;

  return (
    <div>
      <input
        ref={inputGaleriaRef}
        type="file"
        accept="image/*,video/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void processarLista(files);
          if (inputGaleriaRef.current) inputGaleriaRef.current.value = "";
        }}
      />
      {/* Câmera direta (mobile) — capture abre a câmera em vez da galeria */}
      <input
        ref={inputCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void processarLista(files);
          if (inputCameraRef.current) inputCameraRef.current.value = "";
        }}
      />

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputGaleriaRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputGaleriaRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        aria-label="Adicionar fotos, vídeos ou PDFs"
        className={`touch-feedback w-full cursor-pointer rounded-xl border-2 border-dashed text-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
          arrastando
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
        } ${grande ? "px-4 py-8" : "px-3 py-5"}`}
      >
        {processando ? (
          <Loader2 className={`mx-auto animate-spin text-primary ${grande ? "h-8 w-8" : "h-6 w-6"}`} />
        ) : (
          <Upload className={`mx-auto text-muted-foreground ${grande ? "h-8 w-8" : "h-6 w-6"}`} />
        )}
        <p className={`font-medium mt-2 ${grande ? "text-sm" : "text-[13px]"}`}>
          {processando
            ? `Preparando ${filaProcessando} arquivo${filaProcessando > 1 ? "s" : ""}…`
            : "Solte fotos e vídeos aqui"}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          ou toque pra escolher · dá pra colar (Ctrl+V)
        </p>
      </div>

      {/* Atalhos câmera/galeria — mobile-first */}
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputCameraRef.current?.click()}
          disabled={processando}
          className="h-11 sm:h-10 flex-1 text-[13px] touch-feedback sm:hidden"
        >
          <Camera className="h-4 w-4" /> Câmera
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputGaleriaRef.current?.click()}
          disabled={processando}
          className="h-11 sm:h-10 flex-1 text-[13px] touch-feedback"
        >
          <ImageIcon className="h-4 w-4" /> Galeria
        </Button>
      </div>

      {/* Link externo (vídeos pesados, Drive, YouTube) */}
      <div className="flex gap-1.5 mt-2">
        <Input
          value={urlExterna}
          onChange={(e) => setUrlExterna(e.target.value)}
          placeholder="Ou cole um link (Drive, YouTube...)"
          className="h-11 sm:h-10 text-base sm:text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionarUrl();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={adicionarUrl}
          disabled={!urlExterna.trim()}
          className="h-11 sm:h-10 shrink-0 touch-feedback"
          aria-label="Adicionar link"
        >
          <Link2 className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10.5px] text-muted-foreground mt-1.5">
        Fotos são otimizadas automaticamente. Vídeo acima de 5MB: use link do Drive/YouTube (por enquanto).
      </p>

      {/* Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-2.5">
          {value.map((a, i) => (
            <div key={i} className="relative rounded-md overflow-hidden border border-border bg-muted aspect-square">
              {a.tipo === "IMAGEM" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.nome ?? ""} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1 text-muted-foreground">
                  {a.tipo === "VIDEO" ? (
                    <Video className="h-5 w-5" />
                  ) : a.tipo === "DOCUMENTO" ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <Link2 className="h-5 w-5" />
                  )}
                  <span className="text-[8px] text-center leading-tight line-clamp-2 px-0.5">
                    {a.nome ?? a.tipo}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removerArquivo(i)}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white touch-feedback"
                aria-label="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers de arquivo (mesma mecânica do post-arquivos-editor) ────
export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Resize máx 1600px, JPEG 80% → dataURL pequeno que cabe no @db.Text.
 *  `imageOrientation: "from-image"` respeita o EXIF — foto de celular não
 *  deita mais (fallback sem a opção em navegadores antigos). */
export async function comprimirImagem(file: File, maxLado = 1600, qualidade = 0.8): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }
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
