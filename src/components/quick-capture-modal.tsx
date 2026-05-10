"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PartialBlock } from "@blocknote/core";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import { Zap, Folder, Loader2, ArrowRight } from "lucide-react";
import { QUICK_CAPTURE_DRAFT_KEY } from "@/lib/quick-capture";

type Draft = {
  titulo: string;
  conteudo: string; // JSON BlockNote
  pasta: string;
  tags: string;
};

const PASTAS_SUGERIDAS = ["Inbox", "Ideias", "Briefings", "Estratégia", "Operacional"];

/**
 * Modal de captura rápida — pequeno, focado, atalhos visíveis.
 *
 * - Foco automático no título quando abre
 * - Rascunho salva em localStorage a cada 600ms (debounce)
 * - Cmd/Ctrl+Enter salva e fecha
 * - Cmd/Ctrl+Shift+Enter salva e navega pra nota
 */
export function QuickCaptureModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [pasta, setPasta] = useState("Inbox");
  const [tags, setTags] = useState("");
  const [salvando, setSalvando] = useState(false);
  const conteudoKey = useRef(0); // força remount do BlockEditor quando draft restaura
  const draftTimer = useRef<NodeJS.Timeout | null>(null);

  // Restaura rascunho ao abrir
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(QUICK_CAPTURE_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Draft>;
        setTitulo(d.titulo ?? "");
        setConteudo(d.conteudo ?? "");
        setPasta(d.pasta ?? "Inbox");
        setTags(d.tags ?? "");
        conteudoKey.current += 1;
      } else {
        setTitulo("");
        setConteudo("");
        setPasta("Inbox");
        setTags("");
      }
    } catch {
      // ignore
    }
  }, [open]);

  // Auto-save rascunho com debounce
  useEffect(() => {
    if (!open) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const draft: Draft = { titulo, conteudo, pasta, tags };
      const vazio = !titulo.trim() && !conteudo.trim() && !tags.trim();
      try {
        if (vazio) {
          localStorage.removeItem(QUICK_CAPTURE_DRAFT_KEY);
        } else {
          localStorage.setItem(QUICK_CAPTURE_DRAFT_KEY, JSON.stringify(draft));
        }
      } catch {
        // ignore
      }
    }, 600);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [open, titulo, conteudo, pasta, tags]);

  const limparDraft = useCallback(() => {
    try {
      localStorage.removeItem(QUICK_CAPTURE_DRAFT_KEY);
    } catch {
      // ignore
    }
  }, []);

  const salvar = useCallback(
    async (abrirNota: boolean): Promise<void> => {
      const tituloFinal = titulo.trim() || derivarTituloDoConteudo(conteudo) || "Nota rápida";
      const tagsArr = tags.split(",").map((t) => t.trim()).filter(Boolean);

      setSalvando(true);
      try {
        const res = await fetch("/api/notas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: tituloFinal,
            pasta,
            conteudo,
            tags: tagsArr,
          }),
        });
        if (!res.ok) throw new Error("Falha ao salvar");
        const nova = await res.json();
        limparDraft();
        onOpenChange(false);
        toast.success(`Salvo em ${pasta}`, {
          description: tituloFinal.slice(0, 60),
        });
        if (abrirNota) {
          router.push(`/notas?nota=${nova.id}`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar");
      } finally {
        setSalvando(false);
      }
    },
    [titulo, conteudo, pasta, tags, onOpenChange, router, limparDraft]
  );

  // Atalhos dentro do modal
  function onKeyDown(e: React.KeyboardEvent) {
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void salvar(e.shiftKey);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0" onKeyDown={onKeyDown}>
        {/* Header */}
        <div className="px-5 pt-4 pb-2 border-b border-border flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold leading-tight">Captura rápida</div>
            <div className="text-[10.5px] text-muted-foreground">
              Sua ideia, decisão ou anotação solta. Cai no <span className="font-mono">{pasta}</span>.
            </div>
          </div>
        </div>

        {/* Título */}
        <div className="px-5 pt-3">
          <Input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (opcional — vira primeira linha do conteúdo se vazio)"
            className="h-9 text-[13.5px] border-transparent shadow-none bg-transparent px-0 focus-visible:ring-0 focus-visible:border-transparent font-medium"
          />
        </div>

        {/* Body */}
        <div className="px-5 pb-3">
          <BlockEditor
            key={conteudoKey.current}
            value={conteudo}
            onChange={(blocks: PartialBlock[]) => setConteudo(JSON.stringify(blocks))}
            placeholder="Anote algo... / abre blocos, @ menciona cliente/reunião/post."
            minHeight="140px"
          />
        </div>

        {/* Chips: pasta e tags */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
          <Folder className="h-3 w-3 text-muted-foreground shrink-0" />
          <div className="flex gap-1 flex-wrap flex-1">
            {PASTAS_SUGERIDAS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPasta(p)}
                className={
                  "px-2 py-0.5 rounded-full text-[11px] font-medium border transition " +
                  (pasta === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground")
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-3 flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            Tags
          </span>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="separadas, por, vírgula"
            className="h-7 text-[11px] flex-1"
          />
        </div>

        {/* Footer com atalhos */}
        <div className="px-5 py-2.5 border-t border-border flex items-center justify-between gap-2 bg-background/40">
          <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground/70">
            <KbdHint k="⌘↵" label="salvar" />
            <span className="text-muted-foreground/40">·</span>
            <KbdHint k="⌘⇧↵" label="salvar + abrir" />
            <span className="text-muted-foreground/40">·</span>
            <KbdHint k="esc" label="fechar" />
          </div>
          <div className="flex items-center gap-1.5">
            {(titulo || conteudo) && (
              <Badge variant="outline" className="text-[9.5px] font-mono">
                rascunho salvo
              </Badge>
            )}
            <Button
              size="sm"
              onClick={() => void salvar(false)}
              disabled={salvando || (!titulo.trim() && !conteudo.trim())}
              className="h-7 text-xs"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> salvando
                </>
              ) : (
                <>
                  Salvar <ArrowRight className="h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KbdHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="kbd-key">{k}</kbd>
      <span>{label}</span>
    </span>
  );
}

/**
 * Se o usuário não preencheu título, tenta extrair a primeira linha do JSON
 * BlockNote como título (até 80 chars).
 */
function derivarTituloDoConteudo(conteudoJson: string): string {
  if (!conteudoJson) return "";
  const trimmed = conteudoJson.trim();
  if (!trimmed.startsWith("[")) return "";
  try {
    const blocks = JSON.parse(trimmed) as Array<{ content?: unknown }>;
    for (const b of blocks) {
      const c = b.content;
      let text = "";
      if (typeof c === "string") {
        text = c;
      } else if (Array.isArray(c)) {
        text = c
          .map((seg) => (typeof seg === "string" ? seg : (seg as { text?: string }).text ?? ""))
          .join("");
      }
      text = text.trim();
      if (text) return text.slice(0, 80);
    }
  } catch {
    // ignore
  }
  return "";
}
