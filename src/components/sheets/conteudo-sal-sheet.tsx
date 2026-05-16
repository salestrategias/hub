"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PostStatus, FormatoSAL } from "@prisma/client";
import type { EditorBlock as PartialBlock } from "@/components/editor/types";
import { Sparkles, Trash2, ExternalLink } from "lucide-react";
import { EntitySheet } from "@/components/entity-sheet";
import { InlineField } from "@/components/inline-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import { useDebouncedSave } from "@/lib/use-debounced-save";

type ConteudoSALFull = {
  id: string;
  titulo: string;
  copy: string | null;
  briefing: string | null;
  formato: FormatoSAL;
  status: PostStatus;
  pilar: string | null;
  dataPublicacao: string;
  url: string | null;
  googleEventId: string | null;
};

const FORMATO_OPTIONS = [
  { value: "INSTAGRAM_FEED", label: "Instagram Feed" },
  { value: "INSTAGRAM_STORIES", label: "Instagram Stories" },
  { value: "INSTAGRAM_REELS", label: "Instagram Reels" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "NEWSLETTER", label: "Newsletter" },
  { value: "BLOG_POST", label: "Blog post" },
  { value: "AD_CREATIVE", label: "Ad creative" },
];

const STATUS_OPTIONS = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "COPY_PRONTA", label: "Copy pronta" },
  { value: "DESIGN_PRONTO", label: "Design pronto" },
  { value: "AGENDADO", label: "Agendado" },
  { value: "PUBLICADO", label: "Publicado" },
];

const STATUS_COR: Record<PostStatus, string> = {
  RASCUNHO: "#64748B",
  COPY_PRONTA: "#3B82F6",
  DESIGN_PRONTO: "#8B5CF6",
  AGENDADO: "#F59E0B",
  PUBLICADO: "#10B981",
};

export function ConteudoSalSheet({
  conteudoId,
  open,
  onOpenChange,
}: {
  conteudoId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [conteudo, setConteudo] = useState<ConteudoSALFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conteudoId || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/conteudo-sal/${conteudoId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao carregar");
        return r.json();
      })
      .then((data) =>
        setConteudo({
          ...data,
          dataPublicacao: data.dataPublicacao,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [conteudoId, open]);

  async function patchConteudo(patch: Record<string, unknown>) {
    if (!conteudoId) return;
    const res = await fetch(`/api/conteudo-sal/${conteudoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    // Preserva campos do patch que o user acabou de digitar — evita que
    // respostas fora de ordem sobrescrevam edição corrente
    setConteudo((c) => {
      if (!c) return c;
      const merged = { ...c, ...updated };
      if (typeof patch.copy === "string") merged.copy = patch.copy;
      return merged;
    });
  }

  // Debounce do save da copy — onChange do BlockEditor dispara em toda
  // tecla, então sem debounce vários PATCHes concorrentes causam race
  // condition
  const { trigger: salvarCopy, flush: flushCopy } = useDebouncedSave<string>(
    (copy) => patchConteudo({ copy }),
    700
  );

  // Flush save pendente quando sheet fecha
  useEffect(() => {
    if (!open) flushCopy();
  }, [open, flushCopy]);

  async function excluir() {
    if (!conteudoId || !conteudo) return;
    if (!confirm(`Excluir "${conteudo.titulo}"?`)) return;
    const res = await fetch(`/api/conteudo-sal/${conteudoId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Peça excluída");
    onOpenChange(false);
    router.refresh();
  }

  const cor = conteudo ? STATUS_COR[conteudo.status] : "#7E30E1";
  const dataPubInput = conteudo?.dataPublicacao ? toLocalInput(conteudo.dataPublicacao) : "";

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !conteudo}
      error={error}
      icone={Sparkles}
      iconeCor={cor}
      titulo={conteudo?.titulo ?? "Carregando..."}
      subtitulo={
        conteudo && (
          <span className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
              {STATUS_OPTIONS.find((s) => s.value === conteudo.status)?.label ?? conteudo.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {FORMATO_OPTIONS.find((f) => f.value === conteudo.formato)?.label ?? conteudo.formato}
            </Badge>
            {conteudo.pilar && (
              <span className="text-muted-foreground">· {conteudo.pilar}</span>
            )}
            {conteudo.googleEventId && (
              <span className="text-emerald-400 text-[10px]">📅 agendado</span>
            )}
          </span>
        )
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={excluir} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          {conteudo?.url && (
            <Button asChild variant="outline" size="sm">
              <a href={conteudo.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir peça
              </a>
            </Button>
          )}
          <span className="text-[10.5px] text-muted-foreground/70">Edição salva automaticamente</span>
        </>
      }
    >
      {conteudo && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InlineField
              type="text"
              label="Título"
              value={conteudo.titulo}
              onSave={(v) => patchConteudo({ titulo: v })}
              size="sm"
              className="col-span-2"
            />
            <InlineField
              type="select"
              label="Status"
              value={conteudo.status}
              options={STATUS_OPTIONS}
              onSave={(v) => patchConteudo({ status: v })}
              size="sm"
            />
            <InlineField
              type="select"
              label="Formato"
              value={conteudo.formato}
              options={FORMATO_OPTIONS}
              onSave={(v) => patchConteudo({ formato: v })}
              size="sm"
            />
            <InlineField
              type="datetime-local"
              label="Publicação"
              value={dataPubInput}
              onSave={(v) => patchConteudo({ dataPublicacao: v ? new Date(v).toISOString() : null })}
              size="sm"
            />
            <InlineField
              type="text"
              label="Pilar"
              value={conteudo.pilar ?? ""}
              onSave={(v) => patchConteudo({ pilar: v || null })}
              placeholder="Autoridade, Educacional..."
              size="sm"
            />
            <InlineField
              type="url"
              label="URL publicada (opcional)"
              value={conteudo.url ?? ""}
              onSave={(v) => patchConteudo({ url: v || null })}
              placeholder="https://instagram.com/..."
              size="sm"
              className="col-span-2"
            />
          </div>

          {/* Briefing */}
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Briefing
            </div>
            <InlineField
              type="textarea"
              value={conteudo.briefing ?? ""}
              onSave={(v) => patchConteudo({ briefing: v || null })}
              placeholder="O que motivou esse conteúdo? Referências, contexto, links inspiradores..."
              rows={3}
            />
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Copy / roteiro
            </div>
            <BlockEditor
              key={conteudoId}
              value={conteudo.copy ?? ""}
              onChange={(blocks: PartialBlock[]) => salvarCopy(JSON.stringify(blocks))}
              placeholder={
                conteudo.formato === "NEWSLETTER"
                  ? "Texto da newsletter — assunto + corpo + CTA."
                  : conteudo.formato === "BLOG_POST"
                  ? "Conteúdo do blog post — pode usar Markdown leve no texto."
                  : "Copy da peça — texto que vai junto da arte. Quebras de linha + emojis funcionam normal."
              }
              minHeight="240px"
            />
            <p className="text-[10.5px] text-muted-foreground/70 mt-1.5">
              Salvamento automático (~1s após parar de digitar).
            </p>
          </div>
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
