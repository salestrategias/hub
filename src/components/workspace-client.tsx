"use client";
/**
 * WorkspaceClient — páginas livres do workspace (estilo Notion).
 *
 * Layout 2 zonas:
 *  - ESQUERDA: árvore de páginas aninhada e colapsável. Ações:
 *      "+ nova página" no topo, "+ subpágina" e "excluir" por item,
 *      reordenar com ↑↓. Ícone (emoji) + título por item. Clicar abre
 *      a página no editor (navega /workspace/[id]).
 *  - CENTRO: editor da página ativa — breadcrumb dos pais + ícone +
 *      título inline + capa opcional + <BlockEditor> no conteúdo com
 *      auto-save (debounce 700ms) e indicador salvando/salvo.
 *
 * Espelha o padrão do Manual (ManualClient): mesma família de auto-save,
 * mesma estética de sidebar/editor. Diferença: hierarquia ilimitada
 * (recursiva) e navegação por rota /workspace/[id] em vez de slug.
 *
 * A árvore é montada no cliente a partir da lista flat (`pages`) — o
 * servidor só entrega os registros; o front agrupa por parentId.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EditorBlock } from "@/components/editor/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { BlockEditor } from "@/components/editor";
import {
  Plus, Trash2, Loader2, FileText, ChevronRight, ChevronDown,
  ArrowUp, ArrowDown, NotebookPen, ImagePlus, X,
} from "lucide-react";

export type PageFlat = {
  id: string;
  titulo: string;
  icone: string | null;
  ordem: number;
  parentId: string | null;
};

export type PageFull = {
  id: string;
  titulo: string;
  icone: string | null;
  capaUrl: string | null;
  conteudo: string;
  parentId: string | null;
  atualizadoEm: string;
};

type TreeNode = PageFlat & { filhas: TreeNode[] };

/** Monta árvore aninhada (recursiva) a partir da lista flat. */
function montarArvore(pages: PageFlat[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const p of pages) byId.set(p.id, { ...p, filhas: [] });
  const raizes: TreeNode[] = [];
  for (const p of pages) {
    const node = byId.get(p.id)!;
    if (p.parentId && byId.has(p.parentId)) {
      byId.get(p.parentId)!.filhas.push(node);
    } else {
      raizes.push(node);
    }
  }
  const ordenar = (arr: TreeNode[]) => {
    arr.sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));
    arr.forEach((n) => ordenar(n.filhas));
  };
  ordenar(raizes);
  return raizes;
}

/** Caminho de ancestrais (do topo até o pai direto) de uma página. */
function caminhoAncestrais(pages: PageFlat[], id: string): PageFlat[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const trilha: PageFlat[] = [];
  let atual = byId.get(id);
  const visto = new Set<string>();
  while (atual?.parentId && byId.has(atual.parentId) && !visto.has(atual.parentId)) {
    visto.add(atual.parentId);
    const pai = byId.get(atual.parentId)!;
    trilha.unshift(pai);
    atual = pai;
  }
  return trilha;
}

export function WorkspaceClient({
  pages: pagesInicial,
  activePage,
}: {
  pages: PageFlat[];
  activePage: PageFull | null;
}) {
  const router = useRouter();

  // State local da lista pra optimistic update (reordenar/criar/excluir).
  // Sincroniza quando o servidor re-renderiza (router.refresh / navegação).
  const [pages, setPages] = useState<PageFlat[]>(pagesInicial);
  useEffect(() => setPages(pagesInicial), [pagesInicial]);

  const [criandoTop, setCriandoTop] = useState(false);
  const arvore = useMemo(() => montarArvore(pages), [pages]);
  const ancestrais = activePage ? caminhoAncestrais(pages, activePage.id) : [];

  // ── Criar página ──────────────────────────────────────────────────
  async function criarPagina(parentId: string | null) {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId }),
    });
    if (!res.ok) {
      toast.error("Falha ao criar página");
      return;
    }
    const nova = await res.json();
    toast.success("Página criada");
    router.push(`/workspace/${nova.id}`);
    router.refresh();
  }

  async function excluirPagina(p: PageFlat) {
    const temFilhas = pages.some((x) => x.parentId === p.id);
    const aviso = temFilhas
      ? `Excluir "${p.titulo}" e TODAS as subpáginas? Não tem volta.`
      : `Excluir "${p.titulo}"? Não tem volta.`;
    if (!confirm(aviso)) return;
    const res = await fetch(`/api/pages/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Excluída");
    // Se a página ativa (ou um ancestral dela) foi apagada, volta ao índice.
    const ativaAfetada =
      activePage &&
      (activePage.id === p.id || caminhoAncestrais(pages, activePage.id).some((a) => a.id === p.id));
    if (ativaAfetada) {
      router.push("/workspace");
    }
    router.refresh();
  }

  /**
   * Reordena uma página dentro do seu nível (entre irmãs). `dir` = -1 (sobe)
   * ou +1 (desce). Recalcula ordens das irmãs em múltiplos de 10 e persiste
   * via PATCH individual (poucos itens — sem necessidade de batch).
   */
  async function mover(p: PageFlat, dir: -1 | 1) {
    const irmas = pages
      .filter((x) => x.parentId === p.parentId)
      .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));
    const idx = irmas.findIndex((x) => x.id === p.id);
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= irmas.length) return;
    // Swap na lista
    const reordenada = [...irmas];
    [reordenada[idx], reordenada[alvo]] = [reordenada[alvo], reordenada[idx]];
    const novosItens = reordenada.map((x, i) => ({ id: x.id, ordem: (i + 1) * 10 }));

    // Optimistic
    setPages((prev) =>
      prev.map((x) => {
        const novo = novosItens.find((n) => n.id === x.id);
        return novo ? { ...x, ordem: novo.ordem } : x;
      })
    );
    try {
      await Promise.all(
        novosItens.map((n) =>
          fetch(`/api/pages/${n.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordem: n.ordem }),
          }).then((r) => {
            if (!r.ok) throw new Error();
          })
        )
      );
    } catch {
      toast.error("Falha ao reordenar — recarregando");
      router.refresh();
    }
  }

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-5">
      {/* ── Árvore (esquerda) ── */}
      <aside className="space-y-2 md:sticky md:top-[72px] md:self-start md:h-[calc(100vh-100px)] md:overflow-y-auto pr-1">
        <div className="flex items-center gap-2 pt-1">
          <NotebookPen className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold text-sm">Páginas</h2>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={async () => {
              setCriandoTop(true);
              await criarPagina(null);
              setCriandoTop(false);
            }}
            disabled={criandoTop}
            title="Nova página"
          >
            {criandoTop ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            nova
          </Button>
        </div>

        <nav className="space-y-0.5 pt-1">
          {arvore.map((node) => (
            <ItemArvore
              key={node.id}
              node={node}
              nivel={0}
              activeId={activePage?.id ?? null}
              ancestralIds={ancestrais.map((a) => a.id)}
              onNovaSub={(id) => criarPagina(id)}
              onExcluir={excluirPagina}
              onMover={mover}
            />
          ))}
          {arvore.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic px-2 py-3">
              Nenhuma página ainda — crie uma com o + acima
            </p>
          )}
        </nav>
      </aside>

      {/* ── Editor / estado vazio (centro) ── */}
      <div className="space-y-3 min-w-0">
        {activePage ? (
          <PaginaEditor
            key={activePage.id}
            page={activePage}
            ancestrais={ancestrais}
            onTituloSalvo={() => router.refresh()}
          />
        ) : (
          <EstadoVazio onCriar={() => criarPagina(null)} temPaginas={pages.length > 0} />
        )}
      </div>
    </div>
  );
}

// ─── Item recursivo da árvore ──────────────────────────────────────
function ItemArvore({
  node,
  nivel,
  activeId,
  ancestralIds,
  onNovaSub,
  onExcluir,
  onMover,
}: {
  node: TreeNode;
  nivel: number;
  activeId: string | null;
  ancestralIds: string[];
  onNovaSub: (parentId: string) => void;
  onExcluir: (p: PageFlat) => void;
  onMover: (p: PageFlat, dir: -1 | 1) => void;
}) {
  const router = useRouter();
  const temFilhas = node.filhas.length > 0;
  const ativo = node.id === activeId;
  const noCaminho = ancestralIds.includes(node.id);
  // Expande por padrão se um descendente está ativo (mostra o caminho).
  const [aberto, setAberto] = useState(temFilhas && (noCaminho || ativo));
  // Ao navegar pra uma página, revela o caminho até ela (abre ancestrais).
  // Não força fechar — usuário pode manter outros ramos abertos.
  useEffect(() => {
    if (noCaminho) setAberto(true);
  }, [noCaminho]);

  return (
    <div>
      <div
        className={`group flex items-center gap-0.5 rounded-md pr-1 transition-colors ${
          ativo ? "bg-primary/15" : "hover:bg-secondary/50"
        }`}
        style={{ paddingLeft: `${nivel * 14}px` }}
      >
        {/* Chevron de expandir/colapsar (placeholder se não tem filhas) */}
        {temFilhas ? (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="h-5 w-5 shrink-0 flex items-center justify-center text-muted-foreground/60 hover:text-foreground"
            aria-label={aberto ? "Recolher" : "Expandir"}
          >
            {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}

        {/* Abre a página no editor */}
        <button
          type="button"
          onClick={() => router.push(`/workspace/${node.id}`)}
          className={`flex items-center gap-1.5 flex-1 min-w-0 py-1 text-left text-[12.5px] ${
            ativo ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="shrink-0 text-sm leading-none">
            {node.icone ? node.icone : <FileText className="h-3.5 w-3.5" />}
          </span>
          <span className="truncate flex-1">{node.titulo || "Sem título"}</span>
        </button>

        {/* Ações por item — aparecem no hover */}
        <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition shrink-0">
          <button
            type="button"
            onClick={() => onMover(node, -1)}
            className="h-5 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-foreground"
            title="Subir"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onMover(node, 1)}
            className="h-5 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-foreground"
            title="Descer"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              onNovaSub(node.id);
              setAberto(true);
            }}
            className="h-5 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-foreground"
            title="Nova subpágina"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onExcluir(node)}
            className="h-5 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-destructive"
            title="Excluir"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Filhas (recursivo) */}
      {temFilhas && aberto && (
        <div className="mt-0.5 space-y-0.5">
          {node.filhas.map((f) => (
            <ItemArvore
              key={f.id}
              node={f}
              nivel={nivel + 1}
              activeId={activeId}
              ancestralIds={ancestralIds}
              onNovaSub={onNovaSub}
              onExcluir={onExcluir}
              onMover={onMover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Editor da página ativa ────────────────────────────────────────
function PaginaEditor({
  page,
  ancestrais,
  onTituloSalvo,
}: {
  page: PageFull;
  ancestrais: PageFlat[];
  onTituloSalvo: () => void;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [capaUrl, setCapaUrl] = useState<string | null>(page.capaUrl);
  const saving = useRef<NodeJS.Timeout | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Auto-save do conteúdo (debounce 700ms — padrão dos outros editores).
  function handleEditorChange(blocks: EditorBlock[]) {
    const json = JSON.stringify(blocks);
    if (saving.current) clearTimeout(saving.current);
    saving.current = setTimeout(async () => {
      try {
        setSalvando(true);
        const res = await fetch(`/api/pages/${page.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo: json }),
        });
        if (res.ok) setSavedAt(new Date().toISOString());
      } finally {
        setSalvando(false);
      }
    }, 700);
  }

  async function patch(campos: Record<string, unknown>) {
    setSalvando(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      });
      if (res.ok) setSavedAt(new Date().toISOString());
      return res.ok;
    } finally {
      setSalvando(false);
    }
  }

  async function salvarTitulo(novo: string) {
    const limpo = novo.trim();
    if (limpo === page.titulo) return;
    await patch({ titulo: limpo || "Sem título" });
    onTituloSalvo(); // refaz a árvore (título mudou na sidebar)
  }

  async function salvarIcone(novo: string) {
    const ico = novo.trim();
    if (ico === (page.icone ?? "")) return;
    await patch({ icone: ico });
    onTituloSalvo(); // ícone aparece na árvore
  }

  function escolherCapa() {
    fileRef.current?.click();
  }

  async function onCapaArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    if (file.size > 2_400_000) {
      toast.error("Imagem muito grande (máx ~2.4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setCapaUrl(dataUrl);
      const ok = await patch({ capaUrl: dataUrl });
      if (!ok) {
        toast.error("Falha ao salvar capa");
        setCapaUrl(page.capaUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  async function removerCapa() {
    setCapaUrl(null);
    await patch({ capaUrl: "" });
  }

  return (
    <>
      {/* Breadcrumb dos pais */}
      {ancestrais.length > 0 && (
        <nav className="flex items-center gap-1 flex-wrap text-[11px] text-muted-foreground">
          {ancestrais.map((a, i) => (
            <span key={a.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground/40">/</span>}
              <button
                type="button"
                onClick={() => router.push(`/workspace/${a.id}`)}
                className="hover:text-foreground transition truncate max-w-[180px] inline-flex items-center gap-1"
              >
                {a.icone && <span>{a.icone}</span>}
                {a.titulo || "Sem título"}
              </button>
            </span>
          ))}
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground/70">{page.titulo || "Sem título"}</span>
        </nav>
      )}

      {/* Capa opcional */}
      {capaUrl ? (
        <div className="relative group rounded-lg overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capaUrl} alt="" className="w-full h-40 sm:h-52 object-cover" />
          <button
            type="button"
            onClick={removerCapa}
            className="absolute top-2 right-2 h-7 w-7 rounded-md bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-black/70"
            title="Remover capa"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-start gap-2">
            {/* Ícone (emoji) — input simples */}
            <IconeInput inicial={page.icone ?? ""} onSave={salvarIcone} />
            <TituloEditavel inicial={page.titulo} onSave={salvarTitulo} />
            <div className="ml-auto flex items-center gap-1 pt-1 shrink-0">
              {salvando ? (
                <span className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> salvando
                </span>
              ) : savedAt ? (
                <span className="text-[10.5px] text-muted-foreground/70 font-mono">
                  salvo às{" "}
                  {new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-border/40">
            {!capaUrl && (
              <Button size="sm" variant="ghost" onClick={escolherCapa}>
                <ImagePlus className="h-3.5 w-3.5" /> Adicionar capa
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onCapaArquivo}
            className="hidden"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <BlockEditor
            key={page.id}
            value={page.conteudo}
            onChange={handleEditorChange}
            placeholder="Comece a escrever... Use / pra menu de blocos · @ pra mencionar entidades"
            minHeight="60vh"
          />
        </CardContent>
      </Card>
    </>
  );
}

function TituloEditavel({
  inicial,
  onSave,
}: {
  inicial: string;
  onSave: (novo: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(inicial);

  useEffect(() => setValor(inicial), [inicial]);

  if (editando) {
    return (
      <Input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          setEditando(false);
          onSave(valor);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setValor(inicial);
            setEditando(false);
          }
        }}
        className="h-9 font-display text-xl font-semibold flex-1"
        placeholder="Sem título"
      />
    );
  }

  return (
    <h1
      className="font-display text-lg md:text-2xl font-semibold flex-1 cursor-text leading-tight pt-0.5"
      onClick={() => setEditando(true)}
      title="Clique pra editar"
    >
      {valor || <span className="text-muted-foreground/50">Sem título</span>}
    </h1>
  );
}

/** Ícone da página — botão que abre input de emoji simples. */
function IconeInput({
  inicial,
  onSave,
}: {
  inicial: string;
  onSave: (novo: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(inicial);

  useEffect(() => setValor(inicial), [inicial]);

  if (editando) {
    return (
      <Input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          setEditando(false);
          onSave(valor);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setValor(inicial);
            setEditando(false);
          }
        }}
        placeholder="🙂"
        maxLength={4}
        className="h-9 w-12 text-center text-xl shrink-0"
        aria-label="Ícone da página (emoji)"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="h-9 w-9 shrink-0 flex items-center justify-center text-2xl rounded-md hover:bg-secondary/60 transition"
      title="Clique pra escolher um emoji"
    >
      {valor || "📄"}
    </button>
  );
}

function EstadoVazio({ onCriar, temPaginas }: { onCriar: () => void; temPaginas: boolean }) {
  return (
    <Card>
      <CardContent className="p-10 sm:p-14 flex flex-col items-center text-center gap-4">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#7E30E1 0%,#54199F 100%)" }}
        >
          <NotebookPen className="h-7 w-7 text-white" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold">
            {temPaginas ? "Escolha uma página" : "Suas páginas, do seu jeito"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {temPaginas
              ? "Selecione uma página na árvore à esquerda — ou crie uma nova."
              : "Documentos livres estilo Notion: anote, organize em subpáginas e escreva com blocos ricos. Comece criando sua primeira página."}
          </p>
        </div>
        <Button onClick={onCriar} className="gap-1.5">
          <Plus className="h-4 w-4" /> Criar primeira página
        </Button>
      </CardContent>
    </Card>
  );
}
