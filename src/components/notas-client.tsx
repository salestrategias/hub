"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PartialBlock } from "@blocknote/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { Plus, File, Folder, FileText, Search, Trash2, Star, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlockEditor } from "@/components/editor";

type Nota = {
  id: string;
  titulo: string;
  pasta: string;
  conteudo: string;
  tags: string[];
  favorita: boolean;
  updatedAt: string;
};

export function NotasClient({ notas: initial }: { notas: Nota[] }) {
  const [notas, setNotas] = useState(initial);
  const [ativaId, setAtivaId] = useState<string | null>(initial[0]?.id ?? null);
  const [busca, setBusca] = useState("");
  const router = useRouter();

  const ativa = notas.find((n) => n.id === ativaId);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return notas;
    const q = busca.toLowerCase();
    return notas.filter((n) =>
      n.titulo.toLowerCase().includes(q) || extractPreview(n.conteudo, 500).toLowerCase().includes(q)
    );
  }, [notas, busca]);

  const pastas = useMemo(() => {
    const m: Record<string, Nota[]> = {};
    notas.forEach((n) => {
      m[n.pasta] = m[n.pasta] ?? [];
      m[n.pasta].push(n);
    });
    return m;
  }, [notas]);

  async function novaNota() {
    // Conteúdo inicial em formato BlockNote — primeiro bloco vazio é "começa a escrever".
    const initialBlocks: PartialBlock[] = [
      { type: "heading", props: { level: 1 }, content: "Nova nota" } as PartialBlock,
      { type: "paragraph", content: "" } as PartialBlock,
    ];
    const res = await fetch("/api/notas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "Nova nota", pasta: "Inbox", conteudo: JSON.stringify(initialBlocks) }),
    });
    if (!res.ok) { toast.error("Erro ao criar"); return; }
    const nova: Nota = await res.json();
    setNotas([nova, ...notas]);
    setAtivaId(nova.id);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta nota?")) return;
    await fetch(`/api/notas/${id}`, { method: "DELETE" });
    const nova = notas.filter((n) => n.id !== id);
    setNotas(nova);
    setAtivaId(nova[0]?.id ?? null);
    toast.success("Nota excluída");
  }

  function atualizarLocal(patch: Partial<Nota>) {
    if (!ativa) return;
    setNotas(notas.map((n) => (n.id === ativa.id ? { ...n, ...patch } : n)));
  }

  return (
    <Card className="overflow-hidden p-0" style={{ height: "calc(100vh - 200px)" }}>
      <div className="grid grid-cols-[220px_300px_1fr] h-full">
        {/* Coluna 1: Pastas */}
        <div className="border-r border-border bg-card/40 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <Button onClick={novaNota} className="w-full" size="sm"><Plus className="h-3.5 w-3.5" /> Nova nota</Button>
          </div>
          <div className="p-2">
            {Object.entries(pastas).map(([pasta, ns]) => (
              <div key={pasta} className="mb-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <Folder className="h-3 w-3" /> {pasta}
                  <span className="ml-auto text-muted-foreground/50 normal-case tracking-normal">{ns.length}</span>
                </div>
                {ns.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => setAtivaId(n.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 ml-3 text-[12px] rounded-md cursor-pointer truncate",
                      ativaId === n.id ? "bg-sal-600/15 text-sal-400" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <File className="h-3 w-3 shrink-0" />
                    <span className="truncate">{n.titulo}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 2: Lista */}
        <div className="border-r border-border overflow-y-auto">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="pl-7 h-8 text-xs" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {filtradas.map((n) => (
              <div
                key={n.id}
                onClick={() => setAtivaId(n.id)}
                className={cn(
                  "px-4 py-3 cursor-pointer transition",
                  ativaId === n.id ? "bg-sal-600/10 border-l-2 border-l-primary" : "hover:bg-secondary/60"
                )}
              >
                <div className="font-medium text-[13px] truncate flex items-center gap-1.5">
                  {n.favorita && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
                  <span className="truncate">{n.titulo}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {extractPreview(n.conteudo, 140)}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted-foreground/60 font-mono">{relTime(n.updatedAt)}</span>
                  {n.tags.slice(0, 2).map((t) => <span key={t} className="text-[10px] note-tag">#{t}</span>)}
                </div>
              </div>
            ))}
            {filtradas.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma nota.</div>
            )}
          </div>
        </div>

        {/* Coluna 3: Editor (WYSIWYG, dispensa toggle preview/split — Notion-style) */}
        <div className="flex flex-col min-w-0">
          {ativa ? (
            <NotaEditor
              key={ativa.id}
              nota={ativa}
              onChange={atualizarLocal}
              onDelete={() => excluir(ativa.id)}
              onTrocaPasta={() => router.refresh()}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Selecione ou crie uma nota</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function NotaEditor({
  nota, onChange, onDelete,
}: {
  nota: Nota;
  onChange: (p: Partial<Nota>) => void;
  onDelete: () => void;
  onTrocaPasta: () => void;
}) {
  const [titulo, setTitulo] = useState(nota.titulo);
  const [tagsInput, setTagsInput] = useState(nota.tags.join(", "));
  const [favorita, setFavorita] = useState(nota.favorita);
  const conteudoRef = useRef<string>(nota.conteudo);
  const [stats, setStats] = useState(() => computeStats(nota.conteudo));
  const saving = useRef<NodeJS.Timeout | null>(null);

  // Auto-save com debounce 600ms — escopo: titulo, tags, favorita, conteudo (ref)
  useEffect(() => {
    if (saving.current) clearTimeout(saving.current);
    saving.current = setTimeout(async () => {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      await fetch(`/api/notas/${nota.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, conteudo: conteudoRef.current, tags, favorita }),
      });
      onChange({ titulo, conteudo: conteudoRef.current, tags, favorita, updatedAt: new Date().toISOString() });
    }, 600);
    return () => { if (saving.current) clearTimeout(saving.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, tagsInput, favorita]);

  function handleEditorChange(blocks: PartialBlock[]) {
    const json = JSON.stringify(blocks);
    conteudoRef.current = json;
    setStats(computeStats(json));
    // Mesma janela de debounce que o resto
    if (saving.current) clearTimeout(saving.current);
    saving.current = setTimeout(async () => {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      await fetch(`/api/notas/${nota.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, conteudo: json, tags, favorita }),
      });
      onChange({ titulo, conteudo: json, tags, favorita, updatedAt: new Date().toISOString() });
    }, 600);
  }

  return (
    <>
      <div className="px-5 py-2.5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="bg-transparent font-medium text-[14px] outline-none w-full"
          />
          <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">{relTime(nota.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setFavorita(!favorita)}
            title={favorita ? "Remover dos favoritos" : "Marcar como favorita"}
          >
            <Star className={cn("h-3.5 w-3.5", favorita ? "fill-amber-400 text-amber-400" : "")} />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7"><Bookmark className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6">
          <BlockEditor
            value={nota.conteudo}
            onChange={handleEditorChange}
            placeholder="Comece a escrever ou digite / para abrir o menu de blocos..."
            minHeight="60vh"
          />
        </div>
      </div>

      <div className="border-t border-border px-5 py-2 flex items-center justify-between text-[11px] text-muted-foreground gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <span>{stats.words} palavras</span>
          <span>{stats.chars} caracteres</span>
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="text-muted-foreground">tags:</span>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="separadas, por, vírgula"
            className="bg-transparent outline-none flex-1 max-w-xs note-tag text-[11px]"
          />
        </div>
      </div>
    </>
  );
}

/**
 * Extrai texto puro para preview/busca. Funciona com 3 formatos:
 *  - JSON BlockNote (string que começa com `[`)
 *  - markdown legado (qualquer outra string)
 *  - vazio
 *
 * Pula títulos (linhas começadas com `#`) na heurística de markdown,
 * para que o snippet seja o primeiro parágrafo de fato.
 */
function extractPreview(conteudo: string, maxLen: number): string {
  if (!conteudo) return "";
  const trimmed = conteudo.trim();
  if (trimmed.startsWith("[")) {
    try {
      const blocks = JSON.parse(trimmed) as PartialBlock[];
      const text = blocks
        .filter((b) => b.type !== "heading")
        .map(extractBlockText)
        .filter(Boolean)
        .join(" ")
        .trim();
      return text.slice(0, maxLen);
    } catch {
      // cai pra markdown
    }
  }
  return (
    conteudo
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))[0] ?? ""
  ).slice(0, maxLen);
}

function extractBlockText(block: PartialBlock): string {
  const c = (block as { content?: unknown }).content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((seg) => {
        if (typeof seg === "string") return seg;
        const t = (seg as { text?: string }).text;
        return typeof t === "string" ? t : "";
      })
      .join("");
  }
  return "";
}

function computeStats(conteudo: string): { words: number; chars: number } {
  const text = extractPreview(conteudo, 100000);
  return {
    words: text.split(/\s+/).filter(Boolean).length,
    chars: text.length,
  };
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
