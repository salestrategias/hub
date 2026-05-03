"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { Plus, File, Folder, FileText, Search, Trash2, Star, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [modo, setModo] = useState<"preview" | "edit" | "split">("preview");
  const router = useRouter();

  const ativa = notas.find((n) => n.id === ativaId);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return notas;
    const q = busca.toLowerCase();
    return notas.filter((n) => n.titulo.toLowerCase().includes(q) || n.conteudo.toLowerCase().includes(q));
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
    const res = await fetch("/api/notas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "Nova nota", pasta: "Inbox", conteudo: "# Nova nota\n\nComece a escrever..." }),
    });
    if (!res.ok) { toast.error("Erro ao criar"); return; }
    const nova: Nota = await res.json();
    setNotas([nova, ...notas]);
    setAtivaId(nova.id);
    setModo("edit");
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
                  {n.conteudo.split("\n").filter((l) => l.trim() && !l.startsWith("#"))[0] ?? ""}
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

        {/* Coluna 3: Editor + Preview */}
        <div className="flex flex-col min-w-0">
          {ativa ? (
            <NotaEditor
              key={ativa.id}
              nota={ativa}
              modo={modo}
              setModo={setModo}
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
  nota, modo, setModo, onChange, onDelete, onTrocaPasta,
}: {
  nota: Nota;
  modo: "preview" | "edit" | "split";
  setModo: (m: "preview" | "edit" | "split") => void;
  onChange: (p: Partial<Nota>) => void;
  onDelete: () => void;
  onTrocaPasta: () => void;
}) {
  const [titulo, setTitulo] = useState(nota.titulo);
  const [conteudo, setConteudo] = useState(nota.conteudo);
  const [tagsInput, setTagsInput] = useState(nota.tags.join(", "));
  const saving = useRef<NodeJS.Timeout | null>(null);

  // Auto-save com debounce 600ms
  useEffect(() => {
    if (saving.current) clearTimeout(saving.current);
    saving.current = setTimeout(async () => {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      await fetch(`/api/notas/${nota.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, conteudo, tags }),
      });
      onChange({ titulo, conteudo, tags, updatedAt: new Date().toISOString() });
    }, 600);
    return () => { if (saving.current) clearTimeout(saving.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, conteudo, tagsInput]);

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
          <div className="inline-flex p-0.5 bg-secondary rounded-md gap-0.5">
            {(["edit", "preview", "split"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={cn(
                  "px-2 py-1 text-[11px] rounded transition",
                  modo === m ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "edit" ? "Edição" : m === "preview" ? "Preview" : "Split"}
              </button>
            ))}
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7"><Bookmark className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className={cn("flex-1 min-h-0 grid", modo === "split" ? "grid-cols-2" : "grid-cols-1")}>
        {modo !== "preview" && (
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            className="w-full h-full bg-transparent p-8 text-[13.5px] leading-relaxed font-mono outline-none resize-none border-r border-border"
            placeholder="# Título da nota&#10;&#10;Comece a escrever em markdown.&#10;Use [[wikilinks]] para conectar e #tags para organizar."
            spellCheck={false}
          />
        )}
        {modo !== "edit" && (
          <div className="overflow-y-auto p-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(conteudo) }} />
        )}
      </div>

      <div className="border-t border-border px-5 py-2 flex items-center justify-between text-[11px] text-muted-foreground gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <span>{conteudo.split(/\s+/).filter(Boolean).length} palavras</span>
          <span>{conteudo.length} caracteres</span>
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

// Markdown renderer simples (subset comum). Escapa HTML do usuário antes de processar.
function renderMarkdown(md: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  // Sanitização de URL: rejeita javascript:/data:/vbscript: que poderiam virar XSS em <a href>
  const safeUrl = (raw: string) => {
    const u = raw.trim().toLowerCase();
    if (u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:")) return "#";
    return escapeHtml(raw);
  };

  // 1) Escapa todo o markdown bruto antes de qualquer transformação — previne <script>, on*=, etc.
  let html = escapeHtml(md);

  // 2) Code blocks (já estão escapados, só envelopa)
  html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre class="bg-secondary border border-border rounded-md p-3 my-3 text-xs font-mono overflow-x-auto"><code>${code}</code></pre>`
  );

  // 3) Block-level
  html = html
    .replace(/^### (.*)$/gm, '<h3 class="font-display text-[16px] font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="font-display text-[20px] font-semibold mt-6 mb-3 tracking-tight">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="font-display text-[28px] font-bold mt-2 mb-4 tracking-tight">$1</h1>')
    .replace(/^&gt; (.*)$/gm, '<blockquote class="border-l-2 border-primary pl-4 py-1 my-3 italic text-muted-foreground">$1</blockquote>')
    .replace(/^- \[ \] (.*)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" class="accent-primary" /> <span>$1</span></div>')
    .replace(/^- \[x\] (.*)$/gim, '<div class="flex items-center gap-2 my-1"><input type="checkbox" checked class="accent-primary" /> <span class="line-through text-muted-foreground">$1</span></div>')
    .replace(/^- (.*)$/gm, '<li class="ml-5 list-disc text-[13.5px] leading-relaxed mb-1">$1</li>')
    .replace(/^(\d+)\. (.*)$/gm, '<li class="ml-5 list-decimal text-[13.5px] leading-relaxed mb-1">$2</li>');

  // 4) Inline
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-secondary px-1.5 py-0.5 rounded font-mono text-xs">$1</code>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a class="note-link">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
      `<a href="${safeUrl(url)}" rel="noopener noreferrer" target="_blank" class="text-sal-400 underline">${label}</a>`
    )
    .replace(/(^|\s)(#[\wÀ-ÿ-]+)/g, '$1<span class="note-tag">$2</span>');

  // 5) Parágrafos
  return html
    .split(/\n\n+/)
    .map((p) => p.startsWith("<") ? p : `<p class="text-[13.5px] leading-relaxed mb-3">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
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
