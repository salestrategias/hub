"use client";
/**
 * Canvas de mapa mental — SVG infinito com nós + arestas.
 *
 * Features:
 *  - 7 ferramentas: select, pan, rect, circle, text, arrow, sticky
 *  - Drag nodes, pan canvas (shift+drag ou ferramenta), zoom (scroll/pinch/botões)
 *  - Conectar nós com bezier curves
 *  - Edição inline (duplo-click no nó)
 *  - Snap-to-grid 20px (Alt segura pra desligar)
 *  - Atalhos: Del/Backspace = excluir, Ctrl+D = duplicar, Esc = deselecionar
 *    V/H/R/C/T/A/S = trocar ferramenta
 *  - Auto-save 800ms debounce + geração de thumbnail real
 *  - Export SVG e PNG
 *  - Touch básico (drag/pan/pinch zoom) pra mobile
 *
 * Modo mapa-mental (hierarquia, em cima do whiteboard livre):
 *  - Node ganha parentId? (pai) e collapsed? (recolher) — retrocompatível,
 *    sem migração (data fica como JSON em MindMap.data).
 *  - Tab cria FILHO (à direita, conectado, edita); Enter cria IRMÃO (abaixo).
 *    Só disparam com nó selecionado e fora da edição inline.
 *  - "Organizar" (ícone GitFork) faz tree-layout horizontal de cada árvore;
 *    nós livres (sem parentId e sem filhos) não são tocados.
 *  - Nós com filhos têm toggle ±/chevron pra recolher/expandar a subárvore.
 *  - Excluir um nó RE-PARENTA os filhos pro avô (não cascateia exclusão).
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import {
  MousePointer2, Hand, Square, Circle, Type, MoveRight, StickyNote,
  Plus, Minus as MinusIcon, Maximize, Maximize2, Minimize2, Copy, Trash2, Download, Image as ImageIcon,
  GitFork, Undo2, Redo2, Share2, Link2, Check, Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FontScale = "sm" | "md" | "lg";

type Node = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tipo: "rect" | "circle" | "sticky" | "text";
  texto: string;
  subtexto?: string;
  cor: string;
  /** Modo mapa-mental: id do nó pai (null/undefined = nó livre do whiteboard). Retrocompatível. */
  parentId?: string | null;
  /** Modo mapa-mental: se true, esconde toda a subárvore (filhos + edges). */
  collapsed?: boolean;
  /** Fase 2: escala de fonte (peq/méd/grande). Default = médio. Vai no JSON. */
  fontScale?: FontScale;
};

type Edge = {
  id: string;
  from: string;
  to: string;
  estilo: "solid" | "dashed" | "dotted";
  cor: string;
  /** Fase 2: desenha seta (marker) na ponta. Default tratado como true. */
  arrow?: boolean;
  /** Fase 2: rótulo curto desenhado no midpoint do bezier. */
  label?: string;
};

type Tool = "select" | "pan" | "rect" | "circle" | "text" | "arrow" | "sticky";

const CORES = ["#7E30E1", "#3B82F6", "#14B8A6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#64748B"];
const GRID = 20; // snap step em unidades de canvas
// Fase 2: tamanho de fonte por escala (px no espaço de canvas). md = padrão antigo (13).
const FONT_PX: Record<FontScale, number> = { sm: 11, md: 13, lg: 17 };
const fontePx = (n: Node) => FONT_PX[n.fontScale ?? "md"];
// Fonte dos nós (balões) — Plus Jakarta (display da marca) via CSS var, com fallbacks.
const NODE_FONT = "var(--font-jakarta), 'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif";

// Ponto na BORDA do nó na direção de (tx,ty) — pra conexão ancorar na borda
// (retângulo ou elipse), estilo Miro/MindMeister, em vez de ir até o centro.
function bordaNo(n: Node, tx: number, ty: number): { x: number; y: number } {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const rx = n.w / 2, ry = n.h / 2;
  if (n.tipo === "circle") {
    const k = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return { x: cx + dx * k, y: cy + dy * k };
  }
  const sx = dx === 0 ? Infinity : rx / Math.abs(dx);
  const sy = dy === 0 ? Infinity : ry / Math.abs(dy);
  const k = Math.min(sx, sy);
  return { x: cx + dx * k, y: cy + dy * k };
}
// Fase 2: tolerância de snap dos guias de alinhamento (unidades de canvas).
const ALIGN_SNAP = 6;
const STICKY_COR = "#FCD34D"; // amarelo "papel" pra sticky notes
const STICKY_INK = "#3A2E05"; // texto escuro quente pro sticky (contraste no amarelo)

// ─── Modo mapa-mental (hierarquia) ────────────────────────────────────
const CHILD_NODE_W = 140; // largura padrão de um nó criado por Tab/Enter
const CHILD_NODE_H = 56; // altura padrão idem
const TREE_GAP_X = 80; // gap horizontal pai→filho (entre borda direita do pai e borda esquerda do filho)
const TREE_GAP_Y = 28; // gap vertical mínimo entre subárvores irmãs

export function MindMapCanvas({
  id,
  titulo: tituloInicial,
  data: dataInicial,
  readOnly = false,
}: {
  id: string;
  titulo: string;
  descricao: string | null;
  data: { nodes: unknown[]; edges: unknown[] };
  /**
   * Modo somente-leitura (usado pela página pública /p/mapa/[token]). Quando true:
   * esconde toolbar de ferramentas, painel de propriedades, edição de título e
   * undo/redo; desliga TODA edição (criar/editar/excluir/arrastar/conectar/
   * atalhos) e o auto-save (nenhum PATCH). MANTÉM pan/zoom, recolher/expandir,
   * tela cheia e export PNG/SVG.
   */
  readOnly?: boolean;
}) {
  const [titulo, setTitulo] = useState(tituloInicial);
  const [nodes, setNodes] = useState<Node[]>((dataInicial.nodes as Node[]) ?? []);
  const [edges, setEdges] = useState<Edge[]>((dataInicial.edges as Edge[]) ?? []);
  const [tool, setTool] = useState<Tool>("select");
  // Fase 2: multi-seleção (substitui o antigo selectedId único). Aresta selecionada à parte.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  // Fase 2: retângulo de marquee (em coordenadas de canvas) enquanto arrasta no vazio.
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // Fase 2 (bônus): guias de alinhamento ativos durante o drag.
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);
  // Drag de nó(s): guarda o offset de CADA nó selecionado pro centro do cursor,
  // pra mover o grupo inteiro mantendo posições relativas.
  const dragState = useRef<{
    primaryId: string;
    offsets: { id: string; dx: number; dy: number }[];
    moved: boolean;
  } | null>(null);
  const panState = useRef<{ startX: number; startY: number; pX: number; pY: number } | null>(null);
  const pinchState = useRef<{ initialDist: number; initialZoom: number } | null>(null);
  // Marquee em andamento (mousedown no vazio com a ferramenta select).
  const marqueeState = useRef<{ x1: number; y1: number } | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // ─── Compartilhamento público (read-only) ──────────────────────────
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/p/mapa/${shareToken}`
      : "";

  // ─── Fase 2: histórico undo/redo ───────────────────────────────────
  // Pilhas de snapshots { nodes, edges }. Empilhamos ANTES de cada mutação
  // significativa (commitHist). Drags/edições contínuas são coalescidas: o
  // snapshot é tirado no INÍCIO da interação (commitHist) e a mutação contínua
  // (setNodes direto) não empilha de novo. Limite ~50.
  const undoStack = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const redoStack = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  // Contadores só pra forçar re-render dos botões (habilitar/desabilitar).
  const [histTick, setHistTick] = useState(0);

  /** Empilha o estado ATUAL no undo (e limpa o redo). Chamar ANTES de mutar. */
  const commitHist = useCallback(() => {
    undoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setHistTick((t) => t + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setEditingNodeId(null);
    setSelectedEdgeId(null);
    setSelectedIds((ids) => ids.filter((id) => prev.nodes.some((n) => n.id === id)));
    setHistTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setNodes(next.nodes);
    setEdges(next.edges);
    setEditingNodeId(null);
    setSelectedEdgeId(null);
    setSelectedIds((ids) => ids.filter((id) => next.nodes.some((n) => n.id === id)));
    setHistTick((t) => t + 1);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  // Nó "ativo" pro painel: quando há exatamente 1 selecionado, mostra detalhes
  // (texto/subtexto). Com vários, o painel vira modo "lote" (cor/fonte/estilo).
  const selected = selectedIds.length === 1 ? nodes.find((n) => n.id === selectedIds[0]) : undefined;
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : undefined;

  // ─── Derivados do modo mapa-mental ─────────────────────────────────
  // filhosMap (pai→filhos) e o conjunto de nós escondidos por um ancestral
  // recolhido. Recalculados só quando os nós mudam. Edges/hit-test usam isso.
  const filhosMap = useMemo(() => construirFilhosMap(nodes), [nodes]);
  const hiddenIds = useMemo(() => calcularEscondidos(nodes, filhosMap), [nodes, filhosMap]);

  // ─── Theme-aware: resolve cores do canvas SVG (claro/escuro) ───────
  // Como o SVG não herda tokens CSS automaticamente em todos os contextos
  // (e o export/thumbnail serializa cores explícitas), resolvemos cores
  // concretas via next-themes. Default = claro (app é claro por padrão).
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted ? resolvedTheme === "dark" : false;
  const T = useMemo(
    () =>
      dark
        ? {
            canvasBg: "#15151E", // fundo do quadro (escuro calmo)
            dot: "rgba(255,255,255,0.07)", // grid pontilhado
            edge: "#5B5B6E", // aresta default
            edgeArrow: "#6E6E82",
            nodeText: "#E7E7F0", // texto de nó rect/circle/text
            nodeSub: "#A0A0B4", // subtexto
          }
        : {
            canvasBg: "#FAFAFC",
            dot: "rgba(40,30,90,0.10)",
            edge: "#C7C7D4",
            edgeArrow: "#A8A8BC",
            nodeText: "#2B2540",
            nodeSub: "#6B6B82",
          },
    [dark]
  );

  // ─── Auto-save com debounce + thumbnail ────────────────────────────
  // Em modo read-only NUNCA persiste (nenhum PATCH) — só visualização.
  useEffect(() => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const thumbnail = await gerarThumbnail(svgRef.current, T.canvasBg);
      const res = await fetch(`/api/mapas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, data: { nodes, edges }, thumbnail }),
      });
      if (res.ok) setSavedAt(new Date());
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [titulo, nodes, edges, id, readOnly]);

  // ─── Modo mapa-mental: criar filho / irmão por teclado ─────────────
  // Ref do nó recém-criado: o setNodes é assíncrono, então no próximo render
  // (effect abaixo) selecionamos + abrimos edição + ligamos a Edge pai→filho.
  const novoNoPendente = useRef<string | null>(null);

  // Cria um nó filho (Tab) à direita do pai, conectado por uma Edge, e já
  // abre edição inline. Se o pai estava recolhido, expande pra mostrar o novo.
  const criarFilho = useCallback(
    (paiId: string) => {
      commitHist();
      setNodes((ns) => {
        const pai = ns.find((n) => n.id === paiId);
        if (!pai) return ns;
        // irmãos já existentes (mesmo pai) pra empilhar abaixo
        const irmaos = ns.filter((n) => n.parentId === paiId);
        const baseY = irmaos.length
          ? Math.max(...irmaos.map((s) => s.y + s.h)) + TREE_GAP_Y
          : pai.y;
        const novo: Node = {
          id: `n${Date.now()}`,
          x: pai.x + pai.w + TREE_GAP_X,
          y: baseY,
          w: CHILD_NODE_W,
          h: CHILD_NODE_H,
          tipo: "rect",
          texto: "",
          cor: pai.cor,
          parentId: paiId,
        };
        novoNoPendente.current = novo.id;
        // expande o pai se estava recolhido (senão o filho nasceria invisível)
        return [...ns.map((n) => (n.id === paiId && n.collapsed ? { ...n, collapsed: false } : n)), novo];
      });
    },
    [commitHist]
  );

  // Cria um irmão (Enter): mesmo parentId do selecionado, posicionado abaixo,
  // conectado ao mesmo pai. Se o selecionado é raiz/livre (sem parentId),
  // o irmão também é livre (parentId null) e nasce logo abaixo.
  const criarIrmao = useCallback(
    (refId: string) => {
      commitHist();
      setNodes((ns) => {
        const ref = ns.find((n) => n.id === refId);
        if (!ref) return ns;
        const novo: Node = {
          id: `n${Date.now()}`,
          x: ref.x,
          y: ref.y + ref.h + TREE_GAP_Y,
          w: ref.w,
          h: CHILD_NODE_H,
          tipo: ref.tipo === "circle" || ref.tipo === "sticky" ? ref.tipo : "rect",
          texto: "",
          cor: ref.cor,
          parentId: ref.parentId ?? null,
        };
        novoNoPendente.current = novo.id;
        return [...ns, novo];
      });
    },
    [commitHist]
  );

  // Após criar filho/irmão, comita o novo nó: seleciona, abre edição inline e
  // (no caso de filho) liga a Edge pai→filho. Roda no próximo render via ref.
  useEffect(() => {
    const novoId = novoNoPendente.current;
    if (!novoId) return;
    const novo = nodes.find((n) => n.id === novoId);
    if (!novo) return; // ainda não comitou
    novoNoPendente.current = null;
    // Liga a edge pai→filho (só pra filhos; irmãos livres não têm pai)
    if (novo.parentId) {
      setEdges((es) =>
        es.some((e) => e.from === novo.parentId && e.to === novo.id)
          ? es
          : [...es, { id: `e${Date.now()}`, from: novo.parentId!, to: novo.id, estilo: "solid", cor: T.edge }]
      );
    }
    setSelectedIds([novoId]);
    setSelectedEdgeId(null);
    setEditingNodeId(novoId);
  }, [nodes, T.edge]);

  // ─── Modo mapa-mental: organizar (auto-layout) + recolher ──────────
  const organizarArvore = useCallback(() => {
    const arrumado = autoLayoutArvores(nodesRef.current);
    const mudou = arrumado.some((n, i) => n.x !== nodesRef.current[i].x || n.y !== nodesRef.current[i].y);
    if (!mudou) {
      toast.info("Nada para organizar (sem árvores com filhos)");
      return;
    }
    commitHist(); // snapshot ANTES do auto-layout (undo restaura posições)
    setNodes(arrumado);
    toast.success("Árvore organizada");
  }, [commitHist]);

  const toggleCollapse = useCallback((nodeId: string) => {
    commitHist();
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n)));
  }, [commitHist]);

  // Exclui um nó tratando os filhos por RE-PARENTING: os filhos diretos do nó
  // excluído sobem para o avô (parentId do excluído). Se o nó era raiz/livre,
  // os filhos viram livres (parentId null). Edges são religadas avô→filhos.
  // Escolhemos re-parent (em vez de apagar a subárvore) pra nunca destruir
  // trabalho do usuário sem querer — nada de exclusão em cascata silenciosa.
  const excluirNo = useCallback((nodeId: string) => {
    commitHist();
    setNodes((ns) => {
      const alvo = ns.find((n) => n.id === nodeId);
      if (!alvo) return ns;
      const avoId = alvo.parentId ?? null;
      return ns
        .filter((n) => n.id !== nodeId)
        .map((n) => (n.parentId === nodeId ? { ...n, parentId: avoId } : n));
    });
    setEdges((es) => {
      // remove edges que tocavam o nó; religa o avô (se houver) aos órfãos.
      const filhosOrfaos = nodes.filter((n) => n.parentId === nodeId).map((n) => n.id);
      const avoId = nodes.find((n) => n.id === nodeId)?.parentId ?? null;
      const semNo = es.filter((e) => e.from !== nodeId && e.to !== nodeId);
      if (!avoId || filhosOrfaos.length === 0) return semNo;
      const novas: Edge[] = filhosOrfaos
        .filter((fid) => !semNo.some((e) => e.from === avoId && e.to === fid))
        .map((fid, i) => ({ id: `e${Date.now() + i}`, from: avoId, to: fid, estilo: "solid", cor: T.edge }));
      return [...semNo, ...novas];
    });
    setSelectedIds((ids) => ids.filter((id) => id !== nodeId));
  }, [nodes, T.edge, commitHist]);

  // Fase 2: exclui TODOS os nós selecionados (com re-parenting de cada um) num
  // único snapshot de histórico. Edges órfãs são removidas; avô religa aos netos.
  const excluirSelecionados = useCallback(() => {
    if (selectedIds.length === 0) return;
    const alvos = new Set(selectedIds);
    commitHist();
    setNodes((ns) => {
      const parentDe = (id: string) => ns.find((n) => n.id === id)?.parentId ?? null;
      // sobe pro 1º ancestral vivo (fora da seleção) — re-parent em cadeia.
      const avoVivo = (id: string): string | null => {
        let p = parentDe(id);
        while (p && alvos.has(p)) p = parentDe(p);
        return p ?? null;
      };
      return ns
        .filter((n) => !alvos.has(n.id))
        .map((n) => (n.parentId && alvos.has(n.parentId) ? { ...n, parentId: avoVivo(n.parentId) } : n));
    });
    setEdges((es) => es.filter((e) => !alvos.has(e.from) && !alvos.has(e.to)));
    setSelectedIds([]);
    setSelectedEdgeId(null);
  }, [selectedIds, commitHist]);

  // Fase 2: duplica todos os selecionados juntos (offset +24/+24), preservando
  // os vínculos pai→filho INTERNOS ao grupo (remapeia ids); vínculos pra fora
  // viram livres. Seleciona as cópias.
  const duplicarSelecionados = useCallback(() => {
    if (selectedIds.length === 0) return;
    commitHist();
    const sel = nodesRef.current.filter((n) => selectedIds.includes(n.id));
    const idMap = new Map<string, string>();
    sel.forEach((n, i) => idMap.set(n.id, `n${Date.now()}_${i}`));
    const copias: Node[] = sel.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      x: n.x + 24,
      y: n.y + 24,
      // mantém parentId só se o pai também foi copiado; senão vira livre.
      parentId: n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId)! : null,
    }));
    // edges internas ao grupo são duplicadas com ids remapeados.
    const edgesInternas = edgesRef.current.filter(
      (e) => idMap.has(e.from) && idMap.has(e.to)
    );
    const copiasEdges: Edge[] = edgesInternas.map((e, i) => ({
      ...e,
      id: `e${Date.now()}_${i}`,
      from: idMap.get(e.from)!,
      to: idMap.get(e.to)!,
    }));
    setNodes((ns) => [...ns, ...copias]);
    if (copiasEdges.length) setEdges((es) => [...es, ...copiasEdges]);
    setSelectedIds(copias.map((c) => c.id));
    setSelectedEdgeId(null);
  }, [selectedIds, commitHist]);

  // ─── Atalhos de teclado ────────────────────────────────────────────
  useEffect(() => {
    if (readOnly) return; // sem atalhos de edição/ferramenta na visualização pública
    function onKey(e: KeyboardEvent) {
      // Ignora se estiver editando texto (input, textarea, contenteditable).
      // ESSE guard impede Ctrl+Z/Ctrl+A/Tab/Enter/Shift de vazarem do textarea.
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;
      // ── Undo / Redo ──
      if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (ctrl && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      // ── Selecionar tudo (visível) ──
      if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(nodesRef.current.filter((n) => !hiddenIds.has(n.id)).map((n) => n.id));
        setSelectedEdgeId(null);
        return;
      }

      if (e.key === "Escape") {
        setSelectedIds([]);
        setSelectedEdgeId(null);
        setEditingNodeId(null);
        setLinkingFrom(null);
        setMarquee(null);
        marqueeState.current = null;
        return;
      }

      // ── Modo mapa-mental (só com 1 nó selecionado e NÃO editando) ──
      // O guard de INPUT/TEXTAREA/contentEditable acima garante que Tab/Enter
      // dentro do textarea de edição NÃO chegam aqui. Com múltiplos selecionados,
      // Tab/Enter ficam ambíguos → no-op (não cria filho/irmão).
      const soloId = selectedIds.length === 1 ? selectedIds[0] : null;
      if (e.key === "Tab" && soloId) {
        e.preventDefault();
        criarFilho(soloId);
        return;
      }
      if (e.key === "Enter" && soloId && !e.shiftKey) {
        e.preventDefault();
        criarIrmao(soloId);
        return;
      }

      // ── Excluir / duplicar (operam sobre TODOS os selecionados) ──
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        excluirSelecionados();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "d" && selectedIds.length) {
        e.preventDefault();
        duplicarSelecionados();
        return;
      }

      // Ferramentas: V H R C T A S
      const toolMap: Record<string, Tool> = {
        v: "select", h: "pan", r: "rect", c: "circle",
        t: "text", a: "arrow", s: "sticky",
      };
      const next = toolMap[e.key.toLowerCase()];
      if (next && !ctrl) {
        e.preventDefault();
        setTool(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, selectedIds, hiddenIds, criarFilho, criarIrmao, excluirSelecionados, duplicarSelecionados, undo, redo]);

  // ─── Click no canvas — cria nó se ferramenta de criação ────────────
  // Com select/pan, o clique no vazio é tratado pelo fluxo de marquee
  // (mousedown→mouseup) que desseleciona quando não houve arrasto. Aqui só
  // tratamos as ferramentas de criação.
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (readOnly) return; // não cria nós no modo público
      if (e.target !== svgRef.current && !(e.target as Element).id?.startsWith("bg-")) return;
      if (tool === "select" || tool === "pan") return;
      const pt = svgPoint(e);
      if (!pt) return;
      const nid = `n${Date.now()}`;
      const x = snap(pt.x - 70, e.altKey);
      const y = snap(pt.y - 30, e.altKey);
      const novo: Node = {
        id: nid,
        x, y,
        w: tool === "sticky" ? 120 : tool === "circle" ? 100 : 140,
        h: tool === "sticky" ? 120 : tool === "circle" ? 100 : 60,
        tipo: tool === "arrow" ? "rect" : (tool as "rect" | "circle" | "sticky" | "text"),
        texto: tool === "sticky" ? "Sticky" : tool === "text" ? "Texto" : "Novo",
        cor: tool === "sticky" ? STICKY_COR : "#7E30E1",
      };
      commitHist();
      setNodes((p) => [...p, novo]);
      setSelectedIds([nid]);
      setSelectedEdgeId(null);
      setEditingNodeId(nid); // já abre edição inline
      setTool("select");
    },
    [tool, commitHist, readOnly]
  );

  function svgPoint(e: React.MouseEvent | MouseEvent | { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }

  function snap(v: number, disable: boolean): number {
    if (disable) return v;
    return Math.round(v / GRID) * GRID;
  }

  function startDrag(e: React.MouseEvent, n: Node) {
    if (readOnly) return; // nós não arrastam/selecionam/conectam no modo público
    if (tool !== "select") return;
    e.stopPropagation();
    // Linking (conectar): clicar no destino cria a aresta. Inalterado (F1), só
    // com snapshot de histórico antes.
    if (linkingFrom && linkingFrom !== n.id) {
      commitHist();
      const novaEdge: Edge = { id: `e${Date.now()}`, from: linkingFrom, to: n.id, estilo: "solid", cor: T.edge };
      setEdges((p) => [...p, novaEdge]);
      setLinkingFrom(null);
      return;
    }

    // Shift+clique: adiciona/remove ESTE nó da seleção (sem iniciar drag).
    if (e.shiftKey) {
      setSelectedEdgeId(null);
      setSelectedIds((ids) =>
        ids.includes(n.id) ? ids.filter((id) => id !== n.id) : [...ids, n.id]
      );
      return;
    }

    const pt = svgPoint(e);
    if (!pt) return;

    // Se o nó clicado já faz parte da seleção, mantém o grupo (pra arrastar
    // todos juntos). Senão, seleciona só ele.
    const grupo = selectedSet.has(n.id) && selectedIds.length > 0 ? selectedIds : [n.id];
    if (!(selectedSet.has(n.id) && selectedIds.length > 0)) {
      setSelectedIds([n.id]);
    }
    setSelectedEdgeId(null);

    const ns = nodesRef.current;
    const offsets = grupo
      .map((id) => ns.find((nn) => nn.id === id))
      .filter((nn): nn is Node => !!nn)
      .map((nn) => ({ id: nn.id, dx: pt.x - nn.x, dy: pt.y - nn.y }));
    // Snapshot único pro drag inteiro (coalescido). 'moved' vira true só se
    // houver movimento de fato — sem isso, um clique simples não polui o undo.
    commitHist();
    dragState.current = { primaryId: n.id, offsets, moved: false };
  }

  // Início de pan OU de marquee. Pan: ferramenta pan ou Shift+arrasto. Marquee:
  // ferramenta select arrastando no vazio (fundo do canvas).
  function startPan(e: React.MouseEvent) {
    const noVazio =
      e.target === svgRef.current || (e.target as Element).id?.startsWith("bg-");
    // Read-only: qualquer arrasto no vazio = pan (nunca marquee/seleção).
    if (readOnly) {
      if (noVazio) {
        panState.current = { startX: e.clientX, startY: e.clientY, pX: pan.x, pY: pan.y };
      }
      return;
    }
    // Pan tem prioridade (ferramenta pan, ou Shift mesmo na select).
    if (tool === "pan" || (e.shiftKey && tool !== "select")) {
      e.stopPropagation();
      panState.current = { startX: e.clientX, startY: e.clientY, pX: pan.x, pY: pan.y };
      return;
    }
    if (e.shiftKey && tool === "select" && noVazio) {
      // Shift+arrasto no vazio com select também faz pan (atalho histórico).
      e.stopPropagation();
      panState.current = { startX: e.clientX, startY: e.clientY, pX: pan.x, pY: pan.y };
      return;
    }
    // Marquee: select, no vazio (Shift no vazio já virou pan acima).
    if (tool === "select" && noVazio) {
      const pt = svgPoint(e);
      if (!pt) return;
      marqueeState.current = { x1: pt.x, y1: pt.y };
      setMarquee({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    }
  }

  // Última posição absoluta do mouse (pra cálculos no mouseup do marquee).
  const lastMouse = useRef({ x: 0, y: 0 });

  // ─── Mouse move/up (drag + pan + marquee globais) ──────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragState.current) {
        const pt = svgPoint(e);
        if (!pt) return;
        const ds = dragState.current;
        ds.moved = true;
        const disableSnap = e.altKey;
        const primary = ds.offsets.find((o) => o.id === ds.primaryId)!;
        // Posição "crua" do nó primário (segue o cursor).
        let px = pt.x - primary.dx;
        let py = pt.y - primary.dy;
        // Guias de alinhamento (bônus): só quando arrastando 1 nó e snap ligado.
        // Alinha bordas/centros do nó primário com QUALQUER nó fora da seleção.
        let gV: number[] = [];
        let gH: number[] = [];
        if (!disableSnap && ds.offsets.length === 1) {
          const ns = nodesRef.current;
          const moving = ns.find((n) => n.id === ds.primaryId);
          if (moving) {
            const alvos = ns.filter((n) => !selectedSet.has(n.id) && !hiddenIds.has(n.id));
            const res = alinhar(px, py, moving.w, moving.h, alvos);
            px = res.x;
            py = res.y;
            gV = res.v;
            gH = res.h;
          }
        }
        // Snap pro grid (a menos que Alt) sobre o nó primário; o grupo segue
        // pelo MESMO delta — cada nó = posição do primário + offset relativo
        // original (preserva as distâncias entre os nós do grupo).
        const baseX = snap(px, disableSnap);
        const baseY = snap(py, disableSnap);
        const ids = new Set(ds.offsets.map((o) => o.id));
        setNodes((prev) =>
          prev.map((n) => {
            if (!ids.has(n.id)) return n;
            const off = ds.offsets.find((o) => o.id === n.id)!;
            // relX = node.x - primaryNode.x = primary.dx - off.dx
            return { ...n, x: baseX + (primary.dx - off.dx), y: baseY + (primary.dy - off.dy) };
          })
        );
        setGuides({ v: gV, h: gH });
      } else if (panState.current) {
        setPan({
          x: panState.current.pX + (e.clientX - panState.current.startX),
          y: panState.current.pY + (e.clientY - panState.current.startY),
        });
      } else if (marqueeState.current) {
        const pt = svgPoint(e);
        if (!pt) return;
        setMarquee({ x1: marqueeState.current.x1, y1: marqueeState.current.y1, x2: pt.x, y2: pt.y });
      }
    }
    function onUp() {
      // Fim de drag: se não houve movimento, descarta o snapshot que tiramos
      // no mousedown (clique simples não deve gerar entrada de undo).
      if (dragState.current && !dragState.current.moved) {
        undoStack.current.pop();
        setHistTick((t) => t + 1);
      }
      // Fim de marquee: seleciona nós cujo CENTRO cai no retângulo. Sem arrasto
      // (clique simples no vazio) → desseleciona tudo.
      if (marqueeState.current) {
        const m = marqueeState.current;
        const last = svgPoint({ clientX: lastMouse.current.x, clientY: lastMouse.current.y });
        if (last) {
          const x1 = Math.min(m.x1, last.x), x2 = Math.max(m.x1, last.x);
          const y1 = Math.min(m.y1, last.y), y2 = Math.max(m.y1, last.y);
          const dentro = nodesRef.current
            .filter((n) => !hiddenIds.has(n.id))
            .filter((n) => {
              const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
              return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
            })
            .map((n) => n.id);
          setSelectedIds(dentro);
          setSelectedEdgeId(null);
        }
      }
      dragState.current = null;
      panState.current = null;
      marqueeState.current = null;
      setMarquee(null);
      setGuides({ v: [], h: [] });
    }
    // Rastreia a última posição do mouse pra resolver o ponto de canvas no
    // mouseup do marquee (mouseup não traz coordenadas confiáveis sempre).
    function track(e: MouseEvent) {
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousemove", track);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousemove", track);
      window.removeEventListener("mouseup", onUp);
    };
  }, [selectedSet, hiddenIds]);

  // ─── Zoom com scroll do mouse ──────────────────────────────────────
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((z) => Math.max(0.2, Math.min(3, z + delta)));
  }

  // ─── Touch events: drag + pan + pinch zoom ─────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      // Pinch
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchState.current = { initialDist: dist, initialZoom: zoom };
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const target = e.target as Element;
      // Se tocou num nó, drag (no touch movemos só o nó tocado).
      // Read-only: ignora o drag de nó — só pan/pinch.
      const nodeId = target.closest("[data-node-id]")?.getAttribute("data-node-id");
      if (nodeId && tool === "select" && !readOnly) {
        const n = nodes.find((nn) => nn.id === nodeId);
        if (!n) return;
        const pt = svgPoint({ clientX: t.clientX, clientY: t.clientY });
        if (!pt) return;
        commitHist();
        dragState.current = { primaryId: nodeId, offsets: [{ id: nodeId, dx: pt.x - n.x, dy: pt.y - n.y }], moved: false };
        setSelectedIds([nodeId]);
        setSelectedEdgeId(null);
        return;
      }
      // Senão pan
      panState.current = { startX: t.clientX, startY: t.clientY, pX: pan.x, pY: pan.y };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchState.current.initialDist;
      setZoom(Math.max(0.2, Math.min(3, pinchState.current.initialZoom * ratio)));
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (dragState.current) {
        const pt = svgPoint({ clientX: t.clientX, clientY: t.clientY });
        if (!pt) return;
        const ds = dragState.current;
        ds.moved = true;
        const off = ds.offsets[0];
        setNodes((prev) =>
          prev.map((n) =>
            n.id === off.id
              ? { ...n, x: snap(pt.x - off.dx, false), y: snap(pt.y - off.dy, false) }
              : n
          )
        );
      } else if (panState.current) {
        setPan({
          x: panState.current.pX + (t.clientX - panState.current.startX),
          y: panState.current.pY + (t.clientY - panState.current.startY),
        });
      }
    }
  }

  function onTouchEnd() {
    // Coalesce: toque sem arrasto não vira entrada de undo.
    if (dragState.current && !dragState.current.moved) {
      undoStack.current.pop();
      setHistTick((t) => t + 1);
    }
    dragState.current = null;
    panState.current = null;
    pinchState.current = null;
  }

  // Edita o nó ATIVO (painel de 1 nó) SEM snapshot — usado por onChange contínuo
  // de inputs de texto. A coalescência vem de commitHist() no onFocus do input
  // (1 snapshot por sessão de digitação). Também usado pela edição inline (que
  // commita 1x ao entrar em edição).
  function patchNode(patch: Partial<Node>) {
    if (!selected) return;
    setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)));
  }

  // Variante que SEMPRE snapshota — usada por ações discretas (ex.: edição
  // inline no canvas commita 1x ao confirmar).
  function atualizarNode(patch: Partial<Node>) {
    if (!selected) return;
    commitHist();
    patchNode(patch);
  }

  // Aplica um patch de ESTILO (cor/fontScale) a TODOS os nós selecionados.
  function atualizarSelecionados(patch: Partial<Node>) {
    if (selectedIds.length === 0) return;
    commitHist();
    setNodes((ns) => ns.map((n) => (selectedSet.has(n.id) ? { ...n, ...patch } : n)));
  }

  // Edita a aresta selecionada (estilo/seta/label/cor) SEM snapshot (onChange
  // contínuo). Snapshot vem do onFocus pros campos de texto / direto pros toggles.
  function patchEdge(patch: Partial<Edge>) {
    if (!selectedEdge) return;
    setEdges((es) => es.map((ed) => (ed.id === selectedEdge.id ? { ...ed, ...patch } : ed)));
  }

  function atualizarEdge(patch: Partial<Edge>) {
    if (!selectedEdge) return;
    commitHist();
    patchEdge(patch);
  }

  function excluirEdge() {
    if (!selectedEdge) return;
    commitHist();
    setEdges((es) => es.filter((ed) => ed.id !== selectedEdge.id));
    setSelectedEdgeId(null);
  }

  function exportarSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("SVG exportado");
  }

  async function exportarPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const png = await svgParaPng(svg, 1920, 1080, T.canvasBg);
    if (!png) {
      toast.error("Falha ao gerar PNG");
      return;
    }
    const a = document.createElement("a");
    a.href = png;
    a.download = `${titulo}.png`;
    a.click();
    toast.success("PNG exportado");
  }

  // Tela cheia do canvas (Fullscreen API no container do canvas).
  function toggleFull() {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) canvasWrapRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ─── Compartilhar (gerar/revogar link público) ─────────────────────
  // Abre o dialog e, se ainda não existe link, JÁ gera (POST) — assim o
  // estado do toggle reflete a realidade do servidor sem um passo extra.
  const abrirCompartilhar = useCallback(async () => {
    setShareOpen(true);
    setCopied(false);
    if (shareToken || shareBusy) return;
    setShareBusy(true);
    try {
      const res = await fetch(`/api/mapas/${id}/compartilhar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao gerar link");
      setShareToken(data.shareToken ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao compartilhar");
    } finally {
      setShareBusy(false);
    }
  }, [id, shareToken, shareBusy]);

  // Liga/desliga o compartilhamento: ON = POST (gera/reusa token); OFF = DELETE (revoga).
  const toggleCompartilhar = useCallback(
    async (ativo: boolean) => {
      setShareBusy(true);
      setCopied(false);
      try {
        const res = await fetch(`/api/mapas/${id}/compartilhar`, {
          method: ativo ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: ativo ? JSON.stringify({}) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Falha");
        setShareToken(ativo ? data.shareToken ?? null : null);
        toast.success(ativo ? "Link público ativado" : "Link público revogado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro");
      } finally {
        setShareBusy(false);
      }
    },
    [id]
  );

  const copiarLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }, [shareUrl]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {readOnly ? (
            <h1
              className="font-display font-semibold text-lg min-w-0 truncate px-1 -mx-1"
              style={{ maxWidth: "100%" }}
            >
              {titulo}
            </h1>
          ) : (
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="bg-transparent font-display font-semibold text-lg outline-none min-w-0 rounded-md px-1 -mx-1 transition-colors hover:bg-muted/50 focus:bg-muted/60"
              style={{ width: `${Math.max(titulo.length, 12)}ch`, maxWidth: "100%" }}
            />
          )}
          {readOnly ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-sal-500" />
              compartilhado via SAL
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  savedAt ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                )}
              />
              {savedAt
                ? `Salvo às ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : "Salvando…"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {/* Undo / Redo + Compartilhar — só no editor. histTick força re-render do disabled. */}
          {!readOnly && (
            <>
              <div className="flex items-center gap-0.5 mr-1" data-hist={histTick}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={undo}
                  disabled={undoStack.current.length === 0}
                  title="Desfazer (Ctrl+Z)"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={redo}
                  disabled={redoStack.current.length === 0}
                  title="Refazer (Ctrl+Shift+Z / Ctrl+Y)"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={abrirCompartilhar}>
                <Share2 className="h-3.5 w-3.5" /> Compartilhar
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportarPng}>
            <ImageIcon className="h-3.5 w-3.5" /> PNG
          </Button>
          <Button variant="outline" size="sm" onClick={exportarSvg}>
            <Download className="h-3.5 w-3.5" /> SVG
          </Button>
        </div>
      </div>

      <Card ref={canvasWrapRef} className={cn("overflow-hidden relative p-0 shadow-sm", isFull && "rounded-none border-0")} style={{ height: isFull ? "100vh" : "calc(100vh - 240px)" }}>
        {/* Toolbar esquerda flutuante — escondida no modo read-only (público) */}
        {!readOnly && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-1.5 flex flex-col gap-1 shadow-xl shadow-black/5">
          {([
            ["select", MousePointer2, "Selecionar (V)"],
            ["pan", Hand, "Mover canvas (H)"],
            ["__sep__", null, ""],
            ["rect", Square, "Retângulo (R)"],
            ["circle", Circle, "Círculo (C)"],
            ["text", Type, "Texto (T)"],
            ["sticky", StickyNote, "Sticky (S)"],
            ["__sep__", null, ""],
            ["arrow", MoveRight, "Conectar (A)"],
          ] as const).map(([t, Icon, title], i) =>
            t === "__sep__" ? (
              <div key={`sep-${i}`} className="h-px w-6 mx-auto my-0.5 bg-border" />
            ) : (
              <button
                key={t}
                title={title}
                onClick={() => setTool(t as Tool)}
                className={cn(
                  "p-2 rounded-xl transition-all duration-150 active:scale-95",
                  tool === t
                    ? "bg-sal-600 text-white shadow-md shadow-sal-600/30"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {Icon && <Icon className="h-[18px] w-[18px]" />}
              </button>
            )
          )}
          {/* Ação (não é ferramenta): organiza as árvores do mapa-mental */}
          <div className="h-px w-6 mx-auto my-0.5 bg-border" />
          <button
            title="Organizar árvore (auto-layout)"
            onClick={organizarArvore}
            className="p-2 rounded-xl transition-all duration-150 active:scale-95 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <GitFork className="h-[18px] w-[18px]" />
          </button>
        </div>
        )}

        {/* Painel direito — ARESTA selecionada (prioridade sobre nós) */}
        {!readOnly && selectedEdge && (
          <div className="absolute right-3 top-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-3.5 w-60 shadow-xl shadow-black/5 space-y-3.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estilo da conexão</div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">Traço</div>
              <div className="flex gap-1.5">
                {(["solid", "dashed", "dotted"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => atualizarEdge({ estilo: s })}
                    title={s === "solid" ? "Sólido" : s === "dashed" ? "Tracejado" : "Pontilhado"}
                    className={cn(
                      "flex-1 h-8 rounded-lg border flex items-center justify-center transition-colors",
                      selectedEdge.estilo === s
                        ? "border-sal-600 bg-sal-600/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <svg width="34" height="2" viewBox="0 0 34 2">
                      <line
                        x1="0" y1="1" x2="34" y2="1"
                        stroke="currentColor" strokeWidth="2"
                        strokeDasharray={s === "dashed" ? "6 3" : s === "dotted" ? "2 3" : "0"}
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">Seta na ponta</div>
              <button
                onClick={() => atualizarEdge({ arrow: !(selectedEdge.arrow ?? true) })}
                role="switch"
                aria-checked={selectedEdge.arrow ?? true}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  (selectedEdge.arrow ?? true) ? "bg-sal-600" : "bg-secondary"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                    (selectedEdge.arrow ?? true) ? "left-[18px]" : "left-0.5"
                  )}
                />
              </button>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Rótulo</div>
              <Input
                value={selectedEdge.label ?? ""}
                onFocus={commitHist}
                onChange={(e) => patchEdge({ label: e.target.value })}
                placeholder="texto curto"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">Cor</div>
              <div className="flex gap-1.5 flex-wrap">
                {CORES.map((c) => (
                  <button
                    key={c}
                    onClick={() => atualizarEdge({ cor: c })}
                    title={c}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all duration-150 ring-offset-2 ring-offset-card hover:scale-110",
                      selectedEdge.cor === c ? "ring-2 ring-foreground scale-110" : "ring-1 ring-black/5"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-3 flex justify-end">
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={excluirEdge}>
                <Trash2 className="h-3.5 w-3.5" /> Excluir conexão
              </Button>
            </div>
          </div>
        )}

        {/* Painel direito — NÓ(S) selecionado(s) */}
        {!readOnly && !selectedEdge && (selected || selectedIds.length > 1) && (
          <div className="absolute right-3 top-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-3.5 w-60 shadow-xl shadow-black/5 space-y-3.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {selectedIds.length > 1 ? `${selectedIds.length} nós selecionados` : "Estilo do nó"}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">Cor</div>
              <div className="flex gap-1.5 flex-wrap">
                {CORES.map((c) => (
                  <button
                    key={c}
                    onClick={() => (selected ? atualizarNode({ cor: c }) : atualizarSelecionados({ cor: c }))}
                    title={c}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all duration-150 ring-offset-2 ring-offset-card hover:scale-110",
                      selected?.cor === c
                        ? "ring-2 ring-foreground scale-110"
                        : "ring-1 ring-black/5"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            {/* Fase 2: tamanho de fonte (peq/méd/grande) — nó único ou lote */}
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">Fonte</div>
              <div className="flex gap-1.5">
                {(["sm", "md", "lg"] as const).map((fs) => (
                  <button
                    key={fs}
                    onClick={() => (selected ? atualizarNode({ fontScale: fs }) : atualizarSelecionados({ fontScale: fs }))}
                    title={fs === "sm" ? "Pequena" : fs === "md" ? "Média" : "Grande"}
                    className={cn(
                      "flex-1 h-8 rounded-lg border transition-colors flex items-center justify-center",
                      (selected?.fontScale ?? "md") === fs && selected
                        ? "border-sal-600 bg-sal-600/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    )}
                    style={{ fontSize: fs === "sm" ? 11 : fs === "md" ? 13 : 16, fontWeight: 600 }}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>
            {/* Texto/subtexto só fazem sentido pra 1 nó */}
            {selected && (
              <>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">Texto</div>
                  <Input
                    value={selected.texto}
                    onFocus={commitHist}
                    onChange={(e) => patchNode({ texto: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">Subtexto</div>
                  <Input
                    value={selected.subtexto ?? ""}
                    onFocus={commitHist}
                    onChange={(e) => patchNode({ subtexto: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </>
            )}
            <div className="border-t border-border pt-3 flex justify-between gap-1">
              {selected && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setLinkingFrom(selected.id)}>
                  <MoveRight className="h-3 w-3" /> Conectar
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={duplicarSelecionados} title="Duplicar (Ctrl+D)">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={excluirSelecionados} title="Excluir (Del)">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {selected && linkingFrom === selected.id && (
              <div className="text-[10.5px] text-sal-700 dark:text-sal-400 text-center bg-sal-600/10 rounded-lg p-2 font-medium">
                Clique em outro nó para conectar
              </div>
            )}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-full px-1.5 py-1 flex items-center gap-0.5 shadow-xl shadow-black/5">
          <button
            className="p-1.5 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors active:scale-95"
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
            title="Diminuir zoom"
          >
            <MinusIcon className="h-3.5 w-3.5" />
          </button>
          <button
            className="text-[11px] font-medium tabular-nums px-1.5 min-w-[3rem] text-center rounded-full hover:bg-secondary transition-colors py-1"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title="Resetar para 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="p-1.5 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors active:scale-95"
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            title="Aumentar zoom"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            className="p-1.5 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors active:scale-95"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title="Ajustar à tela"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            className="p-1.5 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors active:scale-95"
            onClick={toggleFull}
            title={isFull ? "Sair da tela cheia (Esc)" : "Tela cheia"}
          >
            {isFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Canvas SVG */}
        <svg
          ref={svgRef}
          className="w-full h-full touch-none"
          onMouseDown={startPan}
          onClick={handleCanvasClick}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            cursor: readOnly ? "grab" : tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair",
            background: T.canvasBg,
            transition: "background 0.2s ease",
          }}
        >
          <defs>
            {/* Grid pontilhado — fica DENTRO do <g> transformado, então
                escala/move junto com zoom+pan (sensação de quadro infinito). */}
            <pattern id="dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill={T.dot} />
            </pattern>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={T.edgeArrow} />
            </marker>
            {/* Sombra suave dos nós (Miro-like). std/opacity adaptam ao tema. */}
            <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation={dark ? 3 : 4}
                floodColor="#000000"
                floodOpacity={dark ? 0.45 : 0.14}
              />
            </filter>
            {/* Sombra mais marcada pro sticky (papel levantando). */}
            <filter id="sticky-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="1"
                dy="3"
                stdDeviation={dark ? 3.5 : 4.5}
                floodColor="#000000"
                floodOpacity={dark ? 0.5 : 0.2}
              />
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Fundo pontilhado infinito (dentro do transform → escala c/ zoom).
                Mantém id "bg-grid" pra o handler de click do canvas funcionar. */}
            <rect
              id="bg-grid"
              x={-20000}
              y={-20000}
              width={40000}
              height={40000}
              fill="url(#dots)"
            />
            {/* Edges (pula as que tocam um nó escondido por ramo recolhido) */}
            {edges.map((e) => {
              if (hiddenIds.has(e.from) || hiddenIds.has(e.to)) return null;
              const f = nodes.find((n) => n.id === e.from);
              const t = nodes.find((n) => n.id === e.to);
              if (!f || !t) return null;
              // Ancora nas BORDAS dos nós (não nos centros) — conexão limpa.
              const fcx = f.x + f.w / 2, fcy = f.y + f.h / 2;
              const tcx = t.x + t.w / 2, tcy = t.y + t.h / 2;
              const p1 = bordaNo(f, tcx, tcy);
              const p2 = bordaNo(t, fcx, fcy);
              const x1 = p1.x, y1 = p1.y;
              const x2 = p2.x, y2 = p2.y;
              const cx = (x1 + x2) / 2;
              const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
              const isSel = selectedEdgeId === e.id;
              const showArrow = e.arrow ?? true; // edges antigas mantêm a seta
              // Midpoint do bezier cúbico (t=0.5) com controles (cx,y1) e (cx,y2):
              // x → cx; y → média de y1/y2.
              const mx = cx;
              const my = (y1 + y2) / 2;
              return (
                <g key={e.id}>
                  {/* Hit-area invisível e gorda pra facilitar clicar na aresta */}
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth={14}
                    fill="none"
                    style={{ cursor: !readOnly && tool === "select" ? "pointer" : "default" }}
                    onMouseDown={(ev) => {
                      if (readOnly || tool !== "select") return;
                      ev.stopPropagation();
                      setSelectedEdgeId(e.id);
                      setSelectedIds([]);
                      setEditingNodeId(null);
                    }}
                  />
                  {isSel && (
                    <path d={d} stroke="#7E30E1" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.25} style={{ pointerEvents: "none" }} />
                  )}
                  <path
                    d={d}
                    stroke={e.cor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    markerEnd={showArrow ? "url(#arrow)" : undefined}
                    strokeDasharray={e.estilo === "dashed" ? "7 4" : e.estilo === "dotted" ? "2 4" : "0"}
                    style={{ pointerEvents: "none" }}
                  />
                  {e.label && (
                    <g style={{ pointerEvents: "none" }}>
                      {/* "pílula" de fundo pro label não sumir sobre a linha */}
                      <rect
                        x={mx - (e.label.length * 3.4 + 6)}
                        y={my - 9}
                        width={e.label.length * 6.8 + 12}
                        height={18}
                        rx={5}
                        fill={T.canvasBg}
                        opacity={0.9}
                      />
                      <text
                        x={mx}
                        y={my + 4}
                        textAnchor="middle"
                        fill={T.nodeSub}
                        fontFamily="Inter"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {e.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes (pula os escondidos por um ancestral recolhido —
                não renderiza nem entra no hit-test) */}
            {nodes.map((n) => {
              if (hiddenIds.has(n.id)) return null;
              const hasChildren = temFilhos(n, filhosMap);
              return (
              <g
                key={n.id}
                data-node-id={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseDown={(e) => startDrag(e, n)}
                onDoubleClick={() => !readOnly && setEditingNodeId(n.id)}
                style={{ cursor: readOnly ? "default" : tool === "select" ? "grab" : "pointer" }}
              >
                {n.tipo === "circle" ? (
                  <ellipse
                    cx={n.w / 2}
                    cy={n.h / 2}
                    rx={n.w / 2}
                    ry={n.h / 2}
                    fill={dark ? `${n.cor}2E` : `${n.cor}1A`}
                    stroke={n.cor}
                    strokeWidth={1.5}
                    filter="url(#node-shadow)"
                  />
                ) : n.tipo === "sticky" ? (
                  <g transform="rotate(-2)" filter="url(#sticky-shadow)">
                    <rect width={n.w} height={n.h} rx="4" fill={n.cor} />
                    {/* "curl" sutil de papel: faixa clara no topo */}
                    <rect width={n.w} height={Math.min(10, n.h / 4)} rx="4" fill="#ffffff" opacity={0.18} />
                  </g>
                ) : n.tipo === "text" ? (
                  // Texto puro: sem caixa nem sombra (apenas o label).
                  <rect width={n.w} height={n.h} rx="10" fill="transparent" />
                ) : (
                  <rect
                    width={n.w}
                    height={n.h}
                    rx="12"
                    fill={dark ? `${n.cor}24` : `${n.cor}14`}
                    stroke={n.cor}
                    strokeWidth={1.5}
                    filter="url(#node-shadow)"
                  />
                )}

                {/* Estado selecionado — ring elegante + handles nos cantos
                    (substitui o "engrossar borda" cru). Visual apenas.
                    Aplica a CADA nó da multi-seleção. */}
                {selectedSet.has(n.id) && editingNodeId !== n.id && (() => {
                  const pad = 5;
                  const isCircle = n.tipo === "circle";
                  const handles = [
                    [-pad, -pad],
                    [n.w + pad, -pad],
                    [-pad, n.h + pad],
                    [n.w + pad, n.h + pad],
                  ] as const;
                  return (
                    <g style={{ pointerEvents: "none" }}>
                      {isCircle ? (
                        <ellipse
                          cx={n.w / 2}
                          cy={n.h / 2}
                          rx={n.w / 2 + pad}
                          ry={n.h / 2 + pad}
                          fill="none"
                          stroke="#7E30E1"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <rect
                          x={-pad}
                          y={-pad}
                          width={n.w + pad * 2}
                          height={n.h + pad * 2}
                          rx={n.tipo === "sticky" ? 6 : 14}
                          fill="none"
                          stroke="#7E30E1"
                          strokeWidth={1.5}
                        />
                      )}
                      {handles.map(([hx, hy], i) => (
                        <rect
                          key={i}
                          x={hx - 3}
                          y={hy - 3}
                          width={6}
                          height={6}
                          rx={1.5}
                          fill={T.canvasBg}
                          stroke="#7E30E1"
                          strokeWidth={1.5}
                        />
                      ))}
                    </g>
                  );
                })()}

                {/* Edição inline com foreignObject + textarea. Confirma SEMPRE
                    pelo onBlur (Enter/Esc só fazem blur), evitando commit duplo
                    no histórico. Só snapshota se o texto mudou de fato. */}
                {editingNodeId === n.id ? (
                  <foreignObject x={6} y={6} width={n.w - 12} height={n.h - 12}>
                    <textarea
                      autoFocus
                      defaultValue={n.texto}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== n.texto) {
                          commitHist();
                          setNodes((ns) => ns.map((nn) => (nn.id === n.id ? { ...nn, texto: val } : nn)));
                        }
                        setEditingNodeId(null);
                      }}
                      onKeyDown={(e) => {
                        // Enter confirma (via blur); Shift+Enter quebra linha.
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).blur();
                        }
                        // Esc cancela: restaura valor original antes do blur → no-op.
                        if (e.key === "Escape") {
                          (e.target as HTMLTextAreaElement).value = n.texto;
                          (e.target as HTMLTextAreaElement).blur();
                        }
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        resize: "none",
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        color: n.tipo === "sticky" ? STICKY_INK : T.nodeText,
                        fontFamily: NODE_FONT,
                        fontSize: `${fontePx(n)}px`,
                        fontWeight: 650,
                        letterSpacing: "-0.01em",
                        textAlign: "center",
                        padding: 0,
                      }}
                    />
                  </foreignObject>
                ) : (
                  <>
                    <text
                      x={n.w / 2}
                      y={n.subtexto ? n.h / 2 - 4 : n.h / 2 + fontePx(n) / 3}
                      textAnchor="middle"
                      fill={n.tipo === "sticky" ? STICKY_INK : T.nodeText}
                      fontSize={fontePx(n)}
                      fontWeight={650}
                      style={{ pointerEvents: "none", fontFamily: NODE_FONT, letterSpacing: "-0.01em" }}
                    >
                      {n.texto}
                    </text>
                    {n.subtexto && (
                      <text
                        x={n.w / 2}
                        y={n.h / 2 + 14}
                        textAnchor="middle"
                        fill={n.tipo === "sticky" ? STICKY_INK : T.nodeSub}
                        fontFamily="Inter"
                        fontSize="11"
                        style={{ pointerEvents: "none" }}
                      >
                        {n.subtexto}
                      </text>
                    )}
                  </>
                )}

                {/* Toggle recolher/expandar — só em nós COM filhos. Fica na
                    borda direita (de onde os ramos saem). Clicar não arrasta
                    nem reabre edição (stopPropagation). */}
                {hasChildren && editingNodeId !== n.id && (
                  <g
                    transform={`translate(${n.w + 9}, ${n.h / 2})`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(n.id);
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    style={{ cursor: "pointer" }}
                    aria-label={n.collapsed ? "Expandir ramo" : "Recolher ramo"}
                  >
                    <circle r={9} cx={0} cy={0} fill={T.canvasBg} stroke={n.cor} strokeWidth={1.5} />
                    {n.collapsed ? (
                      // recolhido → chevron pra direita (▸) + contador de filhos
                      <>
                        <path
                          d="M -2 -4 L 3 0 L -2 4"
                          fill="none"
                          stroke={n.cor}
                          strokeWidth={1.6}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ pointerEvents: "none" }}
                        />
                        <text
                          x={0}
                          y={-13}
                          textAnchor="middle"
                          fill={T.nodeSub}
                          fontFamily="Inter"
                          fontSize="9"
                          fontWeight="600"
                          style={{ pointerEvents: "none" }}
                        >
                          {filhosMap.get(n.id)?.length ?? 0}
                        </text>
                      </>
                    ) : (
                      // expandido → chevron pra baixo (▾)
                      <path
                        d="M -4 -2 L 0 3 L 4 -2"
                        fill="none"
                        stroke={n.cor}
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                  </g>
                )}
              </g>
              );
            })}

            {/* Guias de alinhamento (bônus) — linhas finas roxas durante o drag.
                strokeWidth dividido pelo zoom pra ficar ~1px na tela. */}
            {guides.v.map((gx, i) => (
              <line
                key={`gv-${i}`}
                x1={gx} y1={-20000} x2={gx} y2={20000}
                stroke="#7E30E1" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                style={{ pointerEvents: "none" }}
              />
            ))}
            {guides.h.map((gy, i) => (
              <line
                key={`gh-${i}`}
                x1={-20000} y1={gy} x2={20000} y2={gy}
                stroke="#7E30E1" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                style={{ pointerEvents: "none" }}
              />
            ))}

            {/* Retângulo de marquee (seleção por área) */}
            {marquee && (
              <rect
                x={Math.min(marquee.x1, marquee.x2)}
                y={Math.min(marquee.y1, marquee.y2)}
                width={Math.abs(marquee.x2 - marquee.x1)}
                height={Math.abs(marquee.y2 - marquee.y1)}
                fill="#7E30E1"
                fillOpacity={0.08}
                stroke="#7E30E1"
                strokeWidth={1 / zoom}
                strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                style={{ pointerEvents: "none" }}
              />
            )}
          </g>
        </svg>
      </Card>

      {!readOnly && (
      <div className="text-[11px] text-muted-foreground/60 text-center flex flex-wrap justify-center gap-x-3 gap-y-1">
        <span>Duplo-click edita texto</span>
        <span>
          <span className="kbd-key">V</span>/<span className="kbd-key">H</span>/<span className="kbd-key">R</span>/<span className="kbd-key">C</span>/<span className="kbd-key">T</span>/<span className="kbd-key">A</span>/<span className="kbd-key">S</span> trocam ferramenta
        </span>
        <span><span className="kbd-key">Tab</span> cria sub-ramo</span>
        <span><span className="kbd-key">Enter</span> cria irmão</span>
        <span><span className="kbd-key">Del</span> exclui</span>
        <span><span className="kbd-key">Ctrl+D</span> duplica</span>
        <span><span className="kbd-key">Ctrl+Z</span>/<span className="kbd-key">Ctrl+Y</span> desfaz/refaz</span>
        <span><span className="kbd-key">Ctrl+A</span> seleciona tudo</span>
        <span>Arrastar no vazio = seleção; <span className="kbd-key">Shift</span>+clique soma</span>
        <span>Clique numa linha edita a conexão</span>
        <span><span className="kbd-key">Alt</span> ao arrastar desliga snap</span>
        <span>Scroll = zoom</span>
      </div>
      )}

      {/* Dialog de compartilhamento público (read-only) — só no editor */}
      {!readOnly && (
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-sal-500" />
                Compartilhar mapa
              </DialogTitle>
              <DialogDescription>
                Gere um link público somente-leitura. Quem tiver o link vê o mapa
                sem precisar de login e não consegue editá-lo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1 min-w-0">
              {/* Toggle "Compartilhar publicamente" */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Compartilhar publicamente</div>
                  <div className="text-[11px] text-muted-foreground">
                    {shareToken ? "Link ativo" : "Desativado"}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!shareToken}
                  disabled={shareBusy}
                  onClick={() => toggleCompartilhar(!shareToken)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors shrink-0 disabled:opacity-60",
                    shareToken ? "bg-sal-600" : "bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                      shareToken ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </button>
              </div>

              {/* Link público + copiar */}
              {shareToken && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-muted-foreground">Link público</div>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 rounded-md border border-border bg-background pl-3 pr-2 h-9">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        readOnly
                        value={shareUrl}
                        onClick={(e) => e.currentTarget.select()}
                        className="flex-1 min-w-0 w-full bg-transparent text-xs font-mono outline-none"
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={copiarLink} className="shrink-0">
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copiar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {shareBusy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando…
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Fase 2 (bônus): guias de alinhamento ─────────────────────────────

/**
 * Dado o nó em movimento (posição proposta x/y + w/h) e os nós-alvo (fora da
 * seleção), procura alinhamentos de borda esquerda/centro/direita (eixo X) e
 * topo/centro/base (eixo Y) dentro de ALIGN_SNAP. Quando acha, "gruda" a
 * posição e devolve as coordenadas das linhas-guia a desenhar.
 */
function alinhar(
  x: number,
  y: number,
  w: number,
  h: number,
  alvos: Node[]
): { x: number; y: number; v: number[]; h: number[] } {
  // Candidatos do nó em movimento por eixo: [valorAtual, ajusteParaAlinhar].
  // ajuste = quanto somar em x/y pra a "feature" bater no valor do alvo.
  const meusX = [
    { val: x, off: 0 },            // borda esquerda
    { val: x + w / 2, off: w / 2 }, // centro
    { val: x + w, off: w },        // borda direita
  ];
  const meusY = [
    { val: y, off: 0 },
    { val: y + h / 2, off: h / 2 },
    { val: y + h, off: h },
  ];
  const alvosX: number[] = [];
  const alvosY: number[] = [];
  for (const a of alvos) {
    alvosX.push(a.x, a.x + a.w / 2, a.x + a.w);
    alvosY.push(a.y, a.y + a.h / 2, a.y + a.h);
  }

  let bestX: { snapTo: number; newX: number; dist: number } | null = null;
  for (const m of meusX) {
    for (const t of alvosX) {
      const dist = Math.abs(m.val - t);
      if (dist <= ALIGN_SNAP && (!bestX || dist < bestX.dist)) {
        bestX = { snapTo: t, newX: t - m.off, dist };
      }
    }
  }
  let bestY: { snapTo: number; newY: number; dist: number } | null = null;
  for (const m of meusY) {
    for (const t of alvosY) {
      const dist = Math.abs(m.val - t);
      if (dist <= ALIGN_SNAP && (!bestY || dist < bestY.dist)) {
        bestY = { snapTo: t, newY: t - m.off, dist };
      }
    }
  }

  return {
    x: bestX ? bestX.newX : x,
    y: bestY ? bestY.newY : y,
    v: bestX ? [bestX.snapTo] : [],
    h: bestY ? [bestY.snapTo] : [],
  };
}

// ─── Helpers de export/thumbnail ──────────────────────────────────────

/**
 * Converte SVG ref em PNG dataURL via canvas. Usado tanto pra export
 * (alta resolução) quanto pra gerar thumbnail (320x180).
 */
async function svgParaPng(
  svg: SVGSVGElement,
  width: number,
  height: number,
  bgColor: string
): Promise<string | null> {
  try {
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Fundo do canvas (theme-aware) pra a thumbnail/PNG combinar com o app
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    // Desenha SVG centralizado preservando aspect
    const svgW = svg.clientWidth;
    const svgH = svg.clientHeight;
    const scale = Math.min(width / svgW, height / svgH);
    const drawW = svgW * scale;
    const drawH = svgH * scale;
    const dx = (width - drawW) / 2;
    const dy = (height - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/png", 0.9);
  } catch (err) {
    console.warn("svgParaPng falhou:", err);
    return null;
  }
}

/**
 * Thumbnail leve (320x180) gerada do canvas atual pra mostrar na lista
 * de mapas. Pode falhar em alguns browsers — tudo bem, fica null.
 */
async function gerarThumbnail(svg: SVGSVGElement | null, bgColor: string): Promise<string | null> {
  if (!svg) return null;
  return svgParaPng(svg, 320, 180, bgColor);
}

// ─── Helpers do modo mapa-mental (hierarquia / árvore) ────────────────

/** Mapa pai→filhos, na ordem em que os nós aparecem no array. */
function construirFilhosMap(nodes: Node[]): Map<string, Node[]> {
  const map = new Map<string, Node[]>();
  for (const n of nodes) {
    const pid = n.parentId;
    if (pid == null) continue;
    const arr = map.get(pid);
    if (arr) arr.push(n);
    else map.set(pid, [n]);
  }
  return map;
}

/** True se o nó tem pelo menos um filho na árvore atual. */
function temFilhos(node: Node, filhosMap: Map<string, Node[]>): boolean {
  return (filhosMap.get(node.id)?.length ?? 0) > 0;
}

/**
 * Conjunto de ids de nós escondidos por causa de algum ancestral `collapsed`.
 * O próprio nó recolhido continua visível; só a subárvore dele some.
 */
function calcularEscondidos(nodes: Node[], filhosMap: Map<string, Node[]>): Set<string> {
  const escondidos = new Set<string>();
  const ocultarSubarvore = (id: string) => {
    for (const filho of filhosMap.get(id) ?? []) {
      if (escondidos.has(filho.id)) continue;
      escondidos.add(filho.id);
      ocultarSubarvore(filho.id);
    }
  };
  for (const n of nodes) {
    if (n.collapsed) ocultarSubarvore(n.id);
  }
  return escondidos;
}

/**
 * Auto-layout de árvore horizontal (estilo MindMeister/tidy-tree simplificado).
 *
 * Para cada raiz (nó SEM parentId mas COM filhos), distribui a subárvore:
 *  - profundidade → x crescente pra direita (coluna = x do pai + largura + gap)
 *  - folhas empilhadas no eixo y sem sobreposição (usa a ALTURA de cada subárvore)
 *  - pai centralizado verticalmente em relação ao bloco dos filhos
 *
 * Nós livres (sem parentId e sem filhos) NÃO são tocados. Ramos recolhidos
 * (sob um ancestral `collapsed`) não entram no cálculo de espaço.
 * Retorna um novo array de nodes com x/y atualizados.
 */
function autoLayoutArvores(nodes: Node[]): Node[] {
  const filhosMap = construirFilhosMap(nodes);
  const escondidos = calcularEscondidos(nodes, filhosMap);
  const pos = new Map<string, { x: number; y: number }>();

  // Filhos visíveis (não escondidos por ancestral recolhido). Um nó `collapsed`
  // ainda aparece, mas seus filhos somem do layout. `ancestrais` é a cadeia
  // atual (guard contra ciclos em dados hand-edited — a UI nunca cria ciclo).
  const filhosVisiveis = (node: Node, ancestrais: Set<string>): Node[] => {
    if (node.collapsed) return [];
    return (filhosMap.get(node.id) ?? []).filter((c) => !escondidos.has(c.id) && !ancestrais.has(c.id));
  };

  // Altura ocupada por uma subárvore (folha = sua própria altura).
  const alturaSubarvore = (node: Node, ancestrais: Set<string>): number => {
    const filhos = filhosVisiveis(node, ancestrais);
    if (filhos.length === 0) return node.h;
    const proximos = new Set(ancestrais).add(node.id);
    let total = 0;
    for (const f of filhos) total += alturaSubarvore(f, proximos);
    total += TREE_GAP_Y * (filhos.length - 1);
    return Math.max(node.h, total);
  };

  // Posiciona `node` com sua borda esquerda em `x` e o CENTRO vertical da
  // subárvore em `cy`. `ancestrais` evita recursão infinita em ciclos.
  const posicionar = (node: Node, x: number, cy: number, ancestrais: Set<string>) => {
    const filhos = filhosVisiveis(node, ancestrais);
    pos.set(node.id, { x: Math.round(x), y: Math.round(cy - node.h / 2) });
    if (filhos.length === 0) return;

    const proximos = new Set(ancestrais).add(node.id);
    const alturaTotal =
      filhos.reduce((s, f) => s + alturaSubarvore(f, proximos), 0) + TREE_GAP_Y * (filhos.length - 1);
    const childX = x + node.w + TREE_GAP_X;
    let cursor = cy - alturaTotal / 2; // topo do bloco de filhos
    for (const f of filhos) {
      const hSub = alturaSubarvore(f, proximos);
      posicionar(f, childX, cursor + hSub / 2, proximos);
      cursor += hSub + TREE_GAP_Y;
    }
  };

  // Raízes = nós sem parentId e com filhos visíveis. Mantém a âncora (x da raiz
  // e o centro vertical atual) pra a árvore "crescer" a partir de onde está.
  for (const n of nodes) {
    if (n.parentId != null) continue;
    if (filhosVisiveis(n, new Set()).length === 0) continue; // nó livre puro → não toca
    posicionar(n, n.x, n.y + n.h / 2, new Set());
  }

  if (pos.size === 0) return nodes;
  return nodes.map((n) => {
    const p = pos.get(n.id);
    return p ? { ...n, x: p.x, y: p.y } : n;
  });
}
