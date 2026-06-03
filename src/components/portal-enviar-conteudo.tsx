"use client";
/**
 * Portal v2 — submissão de conteúdo PELO CLIENTE (caminho inverso).
 *
 * Quando `podeEnviarConteudo` está ligado, o cliente pode enviar posts
 * (calendário) e criativos (tráfego) pra SAL revisar. Este arquivo
 * concentra:
 *   - <EnviarConteudoDialog>  — formulário (bottom-sheet) com upload de
 *     arte/vídeo + campos por tipo. Comprime imagens client-side (mesma
 *     mecânica do post-arquivos-editor) e manda como dataURL.
 *   - <MinhasSubmissoes>      — lista das submissões do próprio cliente
 *     com badge de status (Em revisão / Aprovado / Ajuste pedido).
 *   - <BotaoEnviar>           — botão de abrir o form (+ Enviar post/criativo).
 *
 * Mobile-first: touch targets 44px, bottom-sheet, safe-area herdada do
 * shell. Sem <style jsx>.
 */
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Link2,
  Trash2,
  Loader2,
  Send,
  Plus,
  FileText,
  Video,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

const FORMATO_POST = [
  { v: "FEED", l: "Post estático" },
  { v: "CARROSSEL", l: "Carrossel" },
  { v: "REELS", l: "Reels / Vídeo" },
  { v: "STORIES", l: "Stories" },
];

const PLATAFORMA_CRIATIVO = [
  { v: "META_ADS", l: "Meta Ads (Face/Insta)" },
  { v: "GOOGLE_ADS", l: "Google Ads" },
  { v: "TIKTOK_ADS", l: "TikTok Ads" },
  { v: "YOUTUBE_ADS", l: "YouTube Ads" },
  { v: "LINKEDIN_ADS", l: "LinkedIn Ads" },
];

const FORMATO_CRIATIVO = [
  { v: "POST_IMAGEM", l: "Post imagem" },
  { v: "POST_VIDEO", l: "Post vídeo" },
  { v: "CARROSSEL", l: "Carrossel" },
  { v: "STORY", l: "Story" },
  { v: "REELS_AD", l: "Reels Ad" },
  { v: "RESPONSIVE_DISPLAY", l: "Display responsivo" },
  { v: "SEARCH_AD", l: "Search Ad" },
  { v: "PERFORMANCE_MAX", l: "Performance Max" },
];

// ─── Botão de abrir o form ──────────────────────────────────────────
export function BotaoEnviar({ modo, onClick }: { modo: ModoEnvio; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="w-full h-12 sm:h-10 text-sm touch-feedback"
      style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
    >
      <Plus className="h-4 w-4" />
      {modo === "post" ? "Enviar post pra revisão" : "Enviar criativo pra revisão"}
    </Button>
  );
}

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
    <Card className="border-l-4" style={{ borderLeftColor: corStatus(status) }}>
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

function corStatus(status: string): string {
  if (status === "APROVADO") return "#10B981";
  if (status === "AJUSTE") return "#F59E0B";
  return "#3B82F6"; // PENDENTE
}

function BadgeStatus({ status }: { status: string }) {
  if (status === "APROVADO") {
    return (
      <Badge variant="outline" className="text-[10px] shrink-0" style={{ color: "#10B981", borderColor: "#10B98155" }}>
        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Aprovado
      </Badge>
    );
  }
  if (status === "AJUSTE") {
    return (
      <Badge variant="outline" className="text-[10px] shrink-0" style={{ color: "#F59E0B", borderColor: "#F59E0B55" }}>
        <AlertTriangle className="h-3 w-3 mr-0.5" /> Ajuste pedido
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] shrink-0" style={{ color: "#3B82F6", borderColor: "#3B82F655" }}>
      <Clock className="h-3 w-3 mr-0.5" /> Em revisão
    </Badge>
  );
}

// ─── Dialog do formulário de submissão ──────────────────────────────
export function EnviarConteudoDialog({
  modo,
  token,
  onClose,
  onSuccess,
}: {
  modo: ModoEnvio;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [legenda, setLegenda] = useState(""); // post: legenda; criativo: textoPrincipal
  const [headline, setHeadline] = useState(""); // só criativo
  const [hashtags, setHashtags] = useState(""); // só post (texto separado por espaço/vírgula)
  const [formato, setFormato] = useState(modo === "post" ? "FEED" : "POST_IMAGEM");
  const [plataforma, setPlataforma] = useState("META_ADS"); // só criativo
  const [dataPublicacao, setDataPublicacao] = useState(""); // só post (YYYY-MM-DD)
  const [arquivos, setArquivos] = useState<ArquivoLocal[]>([]);
  const [processando, setProcessando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!titulo.trim()) {
      toast.error("Dê um título pra SAL identificar");
      return;
    }
    if (modo === "post" && !dataPublicacao) {
      toast.error("Escolha uma data sugerida de publicação");
      return;
    }
    setEnviando(true);
    try {
      const body =
        modo === "post"
          ? {
              titulo: titulo.trim(),
              legenda: legenda.trim() || null,
              formato,
              dataPublicacao,
              hashtags: parseHashtags(hashtags),
              arquivos: arquivos.map((a, i) => ({ ...a, ordem: (i + 1) * 10 })),
            }
          : {
              titulo: titulo.trim(),
              textoPrincipal: legenda.trim() || null,
              headline: headline.trim() || null,
              plataforma,
              formato,
              arquivos: arquivos.map((a, i) => ({ ...a, ordem: (i + 1) * 10 })),
            };

      const endpoint = modo === "post" ? "posts" : "criativos-enviar";
      const res = await fetch(`/api/p/cliente/${token}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao enviar");
        return;
      }
      toast.success(
        modo === "post" ? "Post enviado! SAL vai revisar." : "Criativo enviado! SAL vai revisar."
      );
      onSuccess();
    } finally {
      setEnviando(false);
    }
  }

  const formatos = modo === "post" ? FORMATO_POST : FORMATO_CRIATIVO;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dialog-bottom-sheet max-h-[90dvh] overflow-y-auto">
        <div className="sm:hidden flex justify-center -mt-1 mb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-base">
            {modo === "post" ? "Enviar post pra revisão" : "Enviar criativo pra revisão"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            A SAL recebe pra revisar. Você acompanha o status aqui mesmo.
          </p>
        </DialogHeader>

        <div className="space-y-3.5">
          {/* Título */}
          <Campo label="Título">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={modo === "post" ? "Ex: Promoção de inverno" : "Ex: Anúncio coleção nova"}
              className="h-11 text-base sm:text-sm"
              autoFocus
            />
          </Campo>

          {/* Plataforma (só criativo) */}
          {modo === "criativo" && (
            <Campo label="Plataforma">
              <SelectNativo value={plataforma} onChange={setPlataforma} options={PLATAFORMA_CRIATIVO} />
            </Campo>
          )}

          {/* Formato */}
          <Campo label="Formato">
            <SelectNativo value={formato} onChange={setFormato} options={formatos} />
          </Campo>

          {/* Data sugerida (só post) */}
          {modo === "post" && (
            <Campo label="Data sugerida de publicação">
              <Input
                type="date"
                value={dataPublicacao}
                onChange={(e) => setDataPublicacao(e.target.value)}
                className="h-11 text-base sm:text-sm"
              />
            </Campo>
          )}

          {/* Headline (só criativo) */}
          {modo === "criativo" && (
            <Campo label="Headline (opcional)">
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Título curto do anúncio"
                className="h-11 text-base sm:text-sm"
              />
            </Campo>
          )}

          {/* Legenda / texto */}
          <Campo label={modo === "post" ? "Legenda / texto (opcional)" : "Texto do anúncio (opcional)"}>
            <Textarea
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder={
                modo === "post"
                  ? "Escreva a legenda ou uma ideia do que quer comunicar."
                  : "Texto principal do anúncio (Primary Text)."
              }
              rows={4}
              className="text-base sm:text-sm min-h-[96px]"
            />
          </Campo>

          {/* Hashtags (só post) */}
          {modo === "post" && (
            <Campo label="Hashtags (opcional)">
              <Input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#promo #inverno (separe por espaço)"
                className="h-11 text-base sm:text-sm"
              />
            </Campo>
          )}

          {/* Upload de arquivos */}
          <Campo label="Artes / vídeo (opcional)">
            <UploaderArquivos
              value={arquivos}
              onChange={setArquivos}
              onProcessandoChange={setProcessando}
            />
          </Campo>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 sm:h-9 touch-feedback">
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={enviando || processando || !titulo.trim()}
            className="h-11 sm:h-9 touch-feedback"
            style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar pra SAL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Uploader de artes/vídeo reutilizável (upload comprimido + paste de URL +
 * previews com remover). Mesma mecânica usada no envio de post novo e no
 * "Anexar arte" num post existente. Owner do estado é o pai (controlled via
 * value/onChange) pra o caller poder enviar pro endpoint que quiser.
 *
 * `processando` é reportado via onProcessandoChange pra o pai desabilitar o
 * botão de submit enquanto uma imagem comprime.
 */
export function UploaderArquivos({
  value,
  onChange,
  onProcessandoChange,
}: {
  value: ArquivoLocal[];
  onChange: (arquivos: ArquivoLocal[]) => void;
  onProcessandoChange?: (processando: boolean) => void;
}) {
  const [urlExterna, setUrlExterna] = useState("");
  const [processando, setProcessando] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);

  function setProc(v: boolean) {
    setProcessando(v);
    onProcessandoChange?.(v);
  }

  async function processarArquivo(file: File) {
    setProc(true);
    try {
      let url: string;
      let tipo: ArquivoLocal["tipo"];
      if (file.type.startsWith("image/")) {
        url = await comprimirImagem(file);
        tipo = "IMAGEM";
      } else if (file.type.startsWith("video/")) {
        if (file.size > 5_000_000) {
          toast.error("Vídeo grande demais (max 5MB). Cole um link do Drive/YouTube.");
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
      onChange([...value, { tipo, url, nome: file.name }]);
    } finally {
      setProc(false);
    }
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
    onChange([...value, { tipo, url: u, nome: null }]);
    setUrlExterna("");
  }

  function removerArquivo(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <input
        ref={inputFileRef}
        type="file"
        accept="image/*,video/*,application/pdf"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          for (const f of files) await processarArquivo(f);
          if (inputFileRef.current) inputFileRef.current.value = "";
        }}
      />
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputFileRef.current?.click()}
          disabled={processando}
          className="h-11 sm:h-10 text-sm touch-feedback w-full"
        >
          {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Enviar do dispositivo
        </Button>
        <div className="flex gap-1.5">
          <Input
            value={urlExterna}
            onChange={(e) => setUrlExterna(e.target.value)}
            placeholder="Ou cole link (Drive, YouTube...)"
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
          >
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-[10.5px] text-muted-foreground mt-1.5">
        Imagens são otimizadas automaticamente. Vídeos pesados: use link do Drive/YouTube.
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

/**
 * Select nativo estilizado como Input. Melhor pra mobile/touch que um
 * dropdown custom dentro de bottom-sheet (evita conflito de portais).
 */
function SelectNativo({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-11 sm:h-10 w-full items-center rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

// ─── Helpers de arquivo (mesma mecânica do post-arquivos-editor) ────
function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 60);
}

export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Resize máx 1600px, JPEG 80% → dataURL pequeno que cabe no @db.Text. */
export async function comprimirImagem(file: File, maxLado = 1600, qualidade = 0.8): Promise<string> {
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
