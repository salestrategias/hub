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
import { useEffect, useRef, useState, useCallback } from "react";
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

const CORES = ["#7E30E1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6", "#9696A8"];
const GRID = 20; // snap step em unidades de canvas

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

  // ─── Auto-save com debounce + thumbnail ────────────────────────────
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const thumbnail = await gerarThumbnail(svgRef.current);
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
        cor: tool === "sticky" ? "#FBBF24" : "#7E30E1",
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
      const novaEdge: Edge = { id: `e${Date.now()}`, from: linkingFrom, to: n.id, estilo: "solid", cor: "#9696A8" };
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
    const png = await svgParaPng(svg, 1920, 1080);
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
        <div className="flex items-center gap-2 min-w-0">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="bg-transparent font-display font-semibold text-lg outline-none min-w-0"
            style={{ width: `${Math.max(titulo.length, 12)}ch`, maxWidth: "100%" }}
          />
          <span className="text-xs text-muted-foreground/60 font-mono shrink-0">
            {savedAt ? `salvo · ${savedAt.toLocaleTimeString("pt-BR")}` : "salvando..."}
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

      <Card className="overflow-hidden relative p-0" style={{ height: "calc(100vh - 240px)" }}>
        {/* Toolbar esquerda */}
        <div className="absolute left-3 top-3 z-10 bg-card border border-border rounded-lg p-1.5 flex flex-col gap-0.5 shadow-lg">
          {([
            ["select", MousePointer2, "Selecionar (V)"],
            ["pan", Hand, "Mover canvas (H)"],
            ["rect", Square, "Retângulo (R)"],
            ["circle", Circle, "Círculo (C)"],
            ["text", Type, "Texto (T)"],
            ["arrow", MoveRight, "Conectar (A)"],
            ["sticky", StickyNote, "Sticky (S)"],
          ] as const).map(([t, Icon, title]) => (
            <button
              key={t}
              title={title}
              onClick={() => setTool(t as Tool)}
              className={cn(
                "p-2 rounded-md transition",
                tool === t ? "bg-sal-600/20 text-sal-400" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* Painel direito de propriedades */}
        {selected && (
          <div className="absolute right-3 top-3 z-10 bg-card border border-border rounded-lg p-3 w-56 shadow-lg space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estilo do nó</div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Cor</div>
              <div className="flex gap-1 flex-wrap">
                {CORES.map((c) => (
                  <button
                    key={c}
                    onClick={() => atualizarNode({ cor: c })}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition",
                      selected.cor === c ? "border-foreground scale-110" : "border-transparent"
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
              <div className="text-[10.5px] text-sal-400 text-center bg-sal-600/10 rounded p-2">
                Clique em outro nó para conectar
              </div>
            )}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-card border border-border rounded-lg px-2 py-1 flex items-center gap-1 shadow-lg">
          <button className="p-1.5 rounded hover:bg-secondary" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}>
            <MinusIcon className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] font-mono px-2">{Math.round(zoom * 100)}%</span>
          <button className="p-1.5 rounded hover:bg-secondary" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            className="p-1.5 rounded hover:bg-secondary"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title="Resetar zoom"
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
            background: "hsl(var(--card))",
          }}
        >
          <defs>
            <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="hsl(var(--border))" />
            </pattern>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#9696A8" />
            </marker>
          </defs>
          <rect id="bg-grid" x="-2000" y="-2000" width="6000" height="6000" fill="url(#dots)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
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
                  strokeWidth="1.5"
                  fill="none"
                  markerEnd="url(#arrow)"
                  strokeDasharray={e.estilo === "dashed" ? "6 3" : e.estilo === "dotted" ? "2 3" : "0"}
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
                    fill={`${n.cor}22`}
                    stroke={n.cor}
                    strokeWidth={selectedId === n.id ? 3 : 1.5}
                  />
                ) : n.tipo === "sticky" ? (
                  <rect
                    width={n.w}
                    height={n.h}
                    rx="3"
                    fill={n.cor}
                    transform="rotate(-2)"
                    stroke={selectedId === n.id ? "#7E30E1" : "transparent"}
                    strokeWidth={2}
                  />
                ) : (
                  <rect
                    width={n.w}
                    height={n.h}
                    rx="10"
                    fill={n.tipo === "text" ? "transparent" : `${n.cor}22`}
                    stroke={n.cor}
                    strokeWidth={selectedId === n.id ? 2.5 : 1.5}
                  />
                )}

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
                        color: n.tipo === "sticky" ? "#0E0E14" : n.cor,
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
                      fill={n.tipo === "sticky" ? "#0E0E14" : n.cor}
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
                        fill={n.tipo === "sticky" ? "#0E0E14" : "#9696A8"}
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
  height: number
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
    // Fundo card (dark) pra contraste
    ctx.fillStyle = "#0E0E14";
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
async function gerarThumbnail(svg: SVGSVGElement | null): Promise<string | null> {
  if (!svg) return null;
  return svgParaPng(svg, 320, 180);
}
