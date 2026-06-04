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
  Plus, Minus as MinusIcon, Maximize, Copy, Trash2, Download, Image as ImageIcon,
  GitFork,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
};

type Edge = { id: string; from: string; to: string; estilo: "solid" | "dashed" | "dotted"; cor: string };

type Tool = "select" | "pan" | "rect" | "circle" | "text" | "arrow" | "sticky";

const CORES = ["#7E30E1", "#3B82F6", "#14B8A6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#64748B"];
const GRID = 20; // snap step em unidades de canvas
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
}: {
  id: string;
  titulo: string;
  descricao: string | null;
  data: { nodes: unknown[]; edges: unknown[] };
}) {
  const [titulo, setTitulo] = useState(tituloInicial);
  const [nodes, setNodes] = useState<Node[]>((dataInicial.nodes as Node[]) ?? []);
  const [edges, setEdges] = useState<Edge[]>((dataInicial.edges as Edge[]) ?? []);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ nodeId: string; offsetX: number; offsetY: number; altPressed: boolean } | null>(null);
  const panState = useRef<{ startX: number; startY: number; pX: number; pY: number } | null>(null);
  const pinchState = useRef<{ initialDist: number; initialZoom: number } | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const selected = nodes.find((n) => n.id === selectedId);

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
  useEffect(() => {
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
  }, [titulo, nodes, edges, id]);

  // ─── Modo mapa-mental: criar filho / irmão por teclado ─────────────
  // Ref do nó recém-criado: o setNodes é assíncrono, então no próximo render
  // (effect abaixo) selecionamos + abrimos edição + ligamos a Edge pai→filho.
  const novoNoPendente = useRef<string | null>(null);

  // Cria um nó filho (Tab) à direita do pai, conectado por uma Edge, e já
  // abre edição inline. Se o pai estava recolhido, expande pra mostrar o novo.
  const criarFilho = useCallback(
    (paiId: string) => {
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
    []
  );

  // Cria um irmão (Enter): mesmo parentId do selecionado, posicionado abaixo,
  // conectado ao mesmo pai. Se o selecionado é raiz/livre (sem parentId),
  // o irmão também é livre (parentId null) e nasce logo abaixo.
  const criarIrmao = useCallback(
    (refId: string) => {
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
    []
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
    setSelectedId(novoId);
    setEditingNodeId(novoId);
  }, [nodes, T.edge]);

  // ─── Modo mapa-mental: organizar (auto-layout) + recolher ──────────
  const organizarArvore = useCallback(() => {
    setNodes((ns) => {
      const arrumado = autoLayoutArvores(ns);
      // só notifica/atualiza se algo de fato mudou de posição
      const mudou = arrumado.some((n, i) => n.x !== ns[i].x || n.y !== ns[i].y);
      if (!mudou) {
        toast.info("Nada para organizar (sem árvores com filhos)");
        return ns;
      }
      toast.success("Árvore organizada");
      return arrumado;
    });
  }, []);

  const toggleCollapse = useCallback((nodeId: string) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n)));
  }, []);

  // Exclui um nó tratando os filhos por RE-PARENTING: os filhos diretos do nó
  // excluído sobem para o avô (parentId do excluído). Se o nó era raiz/livre,
  // os filhos viram livres (parentId null). Edges são religadas avô→filhos.
  // Escolhemos re-parent (em vez de apagar a subárvore) pra nunca destruir
  // trabalho do usuário sem querer — nada de exclusão em cascata silenciosa.
  const excluirNo = useCallback((nodeId: string) => {
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
    setSelectedId((cur) => (cur === nodeId ? null : cur));
  }, [nodes, T.edge]);

  // ─── Atalhos de teclado ────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignora se estiver editando texto (input, textarea, contenteditable)
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "Escape") {
        setSelectedId(null);
        setEditingNodeId(null);
        setLinkingFrom(null);
        return;
      }
      // ── Modo mapa-mental (só com nó selecionado e NÃO editando) ──
      // O guard de INPUT/TEXTAREA/contentEditable acima garante que Tab/Enter
      // dentro do textarea de edição NÃO chegam aqui.
      if (e.key === "Tab" && selectedId) {
        e.preventDefault();
        criarFilho(selectedId);
        return;
      }
      if (e.key === "Enter" && selectedId && !e.shiftKey) {
        e.preventDefault();
        criarIrmao(selectedId);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        excluirNo(selectedId);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        const sel = nodes.find((n) => n.id === selectedId);
        if (!sel) return;
        const novo: Node = { ...sel, id: `n${Date.now()}`, x: sel.x + 24, y: sel.y + 24 };
        setNodes((ns) => [...ns, novo]);
        setSelectedId(novo.id);
        return;
      }
      // Ferramentas: V H R C T A S
      const toolMap: Record<string, Tool> = {
        v: "select", h: "pan", r: "rect", c: "circle",
        t: "text", a: "arrow", s: "sticky",
      };
      const next = toolMap[e.key.toLowerCase()];
      if (next && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setTool(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, nodes, criarFilho, criarIrmao, excluirNo]);

  // ─── Click no canvas — cria nó se ferramenta de criação ────────────
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.target !== svgRef.current && !(e.target as Element).id?.startsWith("bg-")) return;
      if (tool === "select" || tool === "pan") {
        setSelectedId(null);
        setEditingNodeId(null);
        return;
      }
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
      setNodes((p) => [...p, novo]);
      setSelectedId(nid);
      setEditingNodeId(nid); // já abre edição inline
      setTool("select");
    },
    [tool]
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
    if (tool !== "select") return;
    e.stopPropagation();
    if (linkingFrom && linkingFrom !== n.id) {
      const novaEdge: Edge = { id: `e${Date.now()}`, from: linkingFrom, to: n.id, estilo: "solid", cor: T.edge };
      setEdges((p) => [...p, novaEdge]);
      setLinkingFrom(null);
      return;
    }
    const pt = svgPoint(e);
    if (!pt) return;
    dragState.current = { nodeId: n.id, offsetX: pt.x - n.x, offsetY: pt.y - n.y, altPressed: e.altKey };
    setSelectedId(n.id);
  }

  function startPan(e: React.MouseEvent) {
    if (tool !== "pan" && !e.shiftKey) return;
    e.stopPropagation();
    panState.current = { startX: e.clientX, startY: e.clientY, pX: pan.x, pY: pan.y };
  }

  // ─── Mouse move/up (drag + pan globais) ────────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragState.current) {
        const pt = svgPoint(e);
        if (!pt) return;
        const disableSnap = e.altKey;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragState.current!.nodeId
              ? {
                  ...n,
                  x: snap(pt.x - dragState.current!.offsetX, disableSnap),
                  y: snap(pt.y - dragState.current!.offsetY, disableSnap),
                }
              : n
          )
        );
      } else if (panState.current) {
        setPan({
          x: panState.current.pX + (e.clientX - panState.current.startX),
          y: panState.current.pY + (e.clientY - panState.current.startY),
        });
      }
    }
    function onUp() {
      dragState.current = null;
      panState.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

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
      // Se tocou num nó, drag
      const nodeId = target.closest("[data-node-id]")?.getAttribute("data-node-id");
      if (nodeId && tool === "select") {
        const n = nodes.find((nn) => nn.id === nodeId);
        if (!n) return;
        const pt = svgPoint({ clientX: t.clientX, clientY: t.clientY });
        if (!pt) return;
        dragState.current = { nodeId, offsetX: pt.x - n.x, offsetY: pt.y - n.y, altPressed: false };
        setSelectedId(nodeId);
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
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragState.current!.nodeId
              ? { ...n, x: snap(pt.x - dragState.current!.offsetX, false), y: snap(pt.y - dragState.current!.offsetY, false) }
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
    dragState.current = null;
    panState.current = null;
    pinchState.current = null;
  }

  function atualizarNode(patch: Partial<Node>) {
    if (!selected) return;
    setNodes(nodes.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)));
  }

  function deletarSelecionado() {
    if (!selected) return;
    excluirNo(selected.id); // re-parent filhos pro avô (não cascateia exclusão)
  }

  function duplicar() {
    if (!selected) return;
    const novo: Node = { ...selected, id: `n${Date.now()}`, x: selected.x + 24, y: selected.y + 24 };
    setNodes([...nodes, novo]);
    setSelectedId(novo.id);
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="bg-transparent font-display font-semibold text-lg outline-none min-w-0 rounded-md px-1 -mx-1 transition-colors hover:bg-muted/50 focus:bg-muted/60"
            style={{ width: `${Math.max(titulo.length, 12)}ch`, maxWidth: "100%" }}
          />
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
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportarPng}>
            <ImageIcon className="h-3.5 w-3.5" /> PNG
          </Button>
          <Button variant="outline" size="sm" onClick={exportarSvg}>
            <Download className="h-3.5 w-3.5" /> SVG
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden relative p-0 shadow-sm" style={{ height: "calc(100vh - 240px)" }}>
        {/* Toolbar esquerda flutuante */}
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

        {/* Painel direito de propriedades */}
        {selected && (
          <div className="absolute right-3 top-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-3.5 w-60 shadow-xl shadow-black/5 space-y-3.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estilo do nó</div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">Cor</div>
              <div className="flex gap-1.5 flex-wrap">
                {CORES.map((c) => (
                  <button
                    key={c}
                    onClick={() => atualizarNode({ cor: c })}
                    title={c}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all duration-150 ring-offset-2 ring-offset-card hover:scale-110",
                      selected.cor === c
                        ? "ring-2 ring-foreground scale-110"
                        : "ring-1 ring-black/5"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Texto</div>
              <Input
                value={selected.texto}
                onChange={(e) => atualizarNode({ texto: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Subtexto</div>
              <Input
                value={selected.subtexto ?? ""}
                onChange={(e) => atualizarNode({ subtexto: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="border-t border-border pt-3 flex justify-between gap-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setLinkingFrom(selected.id)}>
                <MoveRight className="h-3 w-3" /> Conectar
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={duplicar} title="Duplicar (Ctrl+D)">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={deletarSelecionado} title="Excluir (Del)">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {linkingFrom === selected.id && (
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
            cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair",
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
              const x1 = f.x + f.w / 2, y1 = f.y + f.h / 2;
              const x2 = t.x + t.w / 2, y2 = t.y + t.h / 2;
              const cx = (x1 + x2) / 2;
              return (
                <path
                  key={e.id}
                  d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                  stroke={e.cor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  markerEnd="url(#arrow)"
                  strokeDasharray={e.estilo === "dashed" ? "7 4" : e.estilo === "dotted" ? "2 4" : "0"}
                />
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
                onDoubleClick={() => setEditingNodeId(n.id)}
                style={{ cursor: tool === "select" ? "grab" : "pointer" }}
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
                    (substitui o "engrossar borda" cru). Visual apenas. */}
                {selectedId === n.id && editingNodeId !== n.id && (() => {
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

                {/* Edição inline com foreignObject + textarea */}
                {editingNodeId === n.id ? (
                  <foreignObject x={6} y={6} width={n.w - 12} height={n.h - 12}>
                    <textarea
                      autoFocus
                      defaultValue={n.texto}
                      onBlur={(e) => {
                        atualizarNode({ texto: e.target.value });
                        setEditingNodeId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          atualizarNode({ texto: (e.target as HTMLTextAreaElement).value });
                          setEditingNodeId(null);
                        }
                        if (e.key === "Escape") {
                          setEditingNodeId(null);
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
                        fontFamily: "Inter Tight, Inter",
                        fontSize: "13px",
                        fontWeight: 600,
                        textAlign: "center",
                        padding: 0,
                      }}
                    />
                  </foreignObject>
                ) : (
                  <>
                    <text
                      x={n.w / 2}
                      y={n.subtexto ? n.h / 2 - 4 : n.h / 2 + 5}
                      textAnchor="middle"
                      fill={n.tipo === "sticky" ? STICKY_INK : T.nodeText}
                      fontFamily="Inter Tight, Inter"
                      fontSize="13"
                      fontWeight="600"
                      style={{ pointerEvents: "none" }}
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
          </g>
        </svg>
      </Card>

      <div className="text-[11px] text-muted-foreground/60 text-center flex flex-wrap justify-center gap-x-3 gap-y-1">
        <span>Duplo-click edita texto</span>
        <span>
          <span className="kbd-key">V</span>/<span className="kbd-key">H</span>/<span className="kbd-key">R</span>/<span className="kbd-key">C</span>/<span className="kbd-key">T</span>/<span className="kbd-key">A</span>/<span className="kbd-key">S</span> trocam ferramenta
        </span>
        <span><span className="kbd-key">Tab</span> cria sub-ramo</span>
        <span><span className="kbd-key">Enter</span> cria irmão</span>
        <span><span className="kbd-key">Del</span> exclui</span>
        <span><span className="kbd-key">Ctrl+D</span> duplica</span>
        <span><span className="kbd-key">Shift</span>+arrastar move canvas</span>
        <span><span className="kbd-key">Alt</span> ao arrastar desliga snap</span>
        <span>Scroll = zoom</span>
      </div>
    </div>
  );
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
