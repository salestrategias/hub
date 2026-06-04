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
};

type Edge = { id: string; from: string; to: string; estilo: "solid" | "dashed" | "dotted"; cor: string };

type Tool = "select" | "pan" | "rect" | "circle" | "text" | "arrow" | "sticky";

const CORES = ["#7E30E1", "#3B82F6", "#14B8A6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#64748B"];
const GRID = 20; // snap step em unidades de canvas
const STICKY_COR = "#FCD34D"; // amarelo "papel" pra sticky notes
const STICKY_INK = "#3A2E05"; // texto escuro quente pro sticky (contraste no amarelo)

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
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        setNodes((ns) => ns.filter((n) => n.id !== selectedId));
        setEdges((es) => es.filter((edge) => edge.from !== selectedId && edge.to !== selectedId));
        setSelectedId(null);
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
  }, [selectedId, nodes]);

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
    setNodes(nodes.filter((n) => n.id !== selected.id));
    setEdges(edges.filter((edge) => edge.from !== selected.id && edge.to !== selected.id));
    setSelectedId(null);
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
            {/* Edges */}
            {edges.map((e) => {
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

            {/* Nodes */}
            {nodes.map((n) => (
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
              </g>
            ))}
          </g>
        </svg>
      </Card>

      <div className="text-[11px] text-muted-foreground/60 text-center flex flex-wrap justify-center gap-x-3 gap-y-1">
        <span>Duplo-click edita texto</span>
        <span>
          <span className="kbd-key">V</span>/<span className="kbd-key">H</span>/<span className="kbd-key">R</span>/<span className="kbd-key">C</span>/<span className="kbd-key">T</span>/<span className="kbd-key">A</span>/<span className="kbd-key">S</span> trocam ferramenta
        </span>
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
