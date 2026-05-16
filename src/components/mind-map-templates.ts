/**
 * Templates iniciais pra mapas mentais.
 *
 * Cada template é um pre-set de nós + arestas que o user pode escolher
 * ao criar um novo mapa. Foco em estruturas de brainstorming comuns pra
 * agência de marketing: FOFA, jornada do cliente, fishbone (causa-efeito),
 * funil de marketing, pilares de conteúdo.
 *
 * Coordenadas são em "unidades de canvas" (não pixels) — funcionam com
 * o sistema de pan/zoom do SVG.
 */

export type TemplateNode = {
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

export type TemplateEdge = {
  id: string;
  from: string;
  to: string;
  estilo: "solid" | "dashed" | "dotted";
  cor: string;
};

export type MindMapTemplate = {
  id: string;
  titulo: string;
  descricao: string;
  emoji: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
};

const PURPLE = "#7E30E1";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const BLUE = "#3B82F6";
const PINK = "#EC4899";
const TEAL = "#14B8A6";
const GRAY = "#9696A8";

export const MIND_MAP_TEMPLATES: MindMapTemplate[] = [
  // ─── Branco ─────────────────────────────────────────────
  {
    id: "blank",
    titulo: "Em branco",
    descricao: "Comece do zero, sem estrutura pré-definida.",
    emoji: "✨",
    nodes: [],
    edges: [],
  },

  // ─── Tema central + ideias (default antigo) ─────────────
  {
    id: "brainstorm",
    titulo: "Brainstorm livre",
    descricao: "Tema central com 3 ramificações pra expansão livre.",
    emoji: "💡",
    nodes: [
      { id: "n1", x: 480, y: 220, w: 160, h: 80, tipo: "rect", texto: "Tema central", cor: PURPLE },
      { id: "n2", x: 200, y: 100, w: 140, h: 60, tipo: "rect", texto: "Ideia 1", cor: GREEN },
      { id: "n3", x: 200, y: 320, w: 140, h: 60, tipo: "rect", texto: "Ideia 2", cor: GREEN },
      { id: "n4", x: 800, y: 220, w: 140, h: 60, tipo: "rect", texto: "Resultado", cor: AMBER },
    ],
    edges: [
      { id: "e1", from: "n2", to: "n1", estilo: "solid", cor: GRAY },
      { id: "e2", from: "n3", to: "n1", estilo: "solid", cor: GRAY },
      { id: "e3", from: "n1", to: "n4", estilo: "solid", cor: GRAY },
    ],
  },

  // ─── FOFA / SWOT ────────────────────────────────────────
  {
    id: "fofa",
    titulo: "FOFA (SWOT)",
    descricao: "Forças, Oportunidades, Fraquezas, Ameaças — matriz 2x2.",
    emoji: "📊",
    nodes: [
      { id: "f", x: 200, y: 120, w: 220, h: 140, tipo: "rect", texto: "Forças", subtexto: "O que temos de bom", cor: GREEN },
      { id: "o", x: 480, y: 120, w: 220, h: 140, tipo: "rect", texto: "Oportunidades", subtexto: "O que podemos aproveitar", cor: BLUE },
      { id: "fr", x: 200, y: 320, w: 220, h: 140, tipo: "rect", texto: "Fraquezas", subtexto: "O que precisa melhorar", cor: AMBER },
      { id: "a", x: 480, y: 320, w: 220, h: 140, tipo: "rect", texto: "Ameaças", subtexto: "Riscos externos", cor: RED },
    ],
    edges: [],
  },

  // ─── Jornada do Cliente ─────────────────────────────────
  {
    id: "jornada",
    titulo: "Jornada do Cliente",
    descricao: "Awareness → Consideração → Decisão → Retenção → Advocacy.",
    emoji: "🛒",
    nodes: [
      { id: "j1", x: 100, y: 240, w: 150, h: 70, tipo: "rect", texto: "Awareness", subtexto: "Descobre", cor: PURPLE },
      { id: "j2", x: 290, y: 240, w: 150, h: 70, tipo: "rect", texto: "Consideração", subtexto: "Pesquisa", cor: BLUE },
      { id: "j3", x: 480, y: 240, w: 150, h: 70, tipo: "rect", texto: "Decisão", subtexto: "Compra", cor: GREEN },
      { id: "j4", x: 670, y: 240, w: 150, h: 70, tipo: "rect", texto: "Retenção", subtexto: "Volta", cor: AMBER },
      { id: "j5", x: 860, y: 240, w: 150, h: 70, tipo: "rect", texto: "Advocacy", subtexto: "Recomenda", cor: PINK },
    ],
    edges: [
      { id: "ej1", from: "j1", to: "j2", estilo: "solid", cor: GRAY },
      { id: "ej2", from: "j2", to: "j3", estilo: "solid", cor: GRAY },
      { id: "ej3", from: "j3", to: "j4", estilo: "solid", cor: GRAY },
      { id: "ej4", from: "j4", to: "j5", estilo: "solid", cor: GRAY },
    ],
  },

  // ─── Fishbone (Ishikawa) ────────────────────────────────
  {
    id: "fishbone",
    titulo: "Fishbone (Causa-Efeito)",
    descricao: "Diagrama de Ishikawa — 6M ou 4P pra identificar causas raiz.",
    emoji: "🐟",
    nodes: [
      { id: "fb-prob", x: 760, y: 280, w: 180, h: 80, tipo: "rect", texto: "Problema", cor: RED },
      { id: "fb-pes", x: 100, y: 100, w: 140, h: 60, tipo: "rect", texto: "Pessoas", cor: BLUE },
      { id: "fb-proc", x: 320, y: 100, w: 140, h: 60, tipo: "rect", texto: "Processos", cor: BLUE },
      { id: "fb-fer", x: 540, y: 100, w: 140, h: 60, tipo: "rect", texto: "Ferramentas", cor: BLUE },
      { id: "fb-amb", x: 100, y: 460, w: 140, h: 60, tipo: "rect", texto: "Ambiente", cor: AMBER },
      { id: "fb-mat", x: 320, y: 460, w: 140, h: 60, tipo: "rect", texto: "Materiais", cor: AMBER },
      { id: "fb-med", x: 540, y: 460, w: 140, h: 60, tipo: "rect", texto: "Medidas", cor: AMBER },
    ],
    edges: [
      { id: "efb1", from: "fb-pes", to: "fb-prob", estilo: "solid", cor: GRAY },
      { id: "efb2", from: "fb-proc", to: "fb-prob", estilo: "solid", cor: GRAY },
      { id: "efb3", from: "fb-fer", to: "fb-prob", estilo: "solid", cor: GRAY },
      { id: "efb4", from: "fb-amb", to: "fb-prob", estilo: "solid", cor: GRAY },
      { id: "efb5", from: "fb-mat", to: "fb-prob", estilo: "solid", cor: GRAY },
      { id: "efb6", from: "fb-med", to: "fb-prob", estilo: "solid", cor: GRAY },
    ],
  },

  // ─── Funil de Marketing ─────────────────────────────────
  {
    id: "funil",
    titulo: "Funil de Marketing",
    descricao: "TOFU / MOFU / BOFU — topo, meio e fundo do funil.",
    emoji: "🎯",
    nodes: [
      { id: "fn-topo", x: 250, y: 100, w: 320, h: 80, tipo: "rect", texto: "Topo (TOFU)", subtexto: "Atrair desconhecidos — conteúdo amplo", cor: BLUE },
      { id: "fn-meio", x: 310, y: 220, w: 240, h: 80, tipo: "rect", texto: "Meio (MOFU)", subtexto: "Educar leads — material rico", cor: PURPLE },
      { id: "fn-fundo", x: 370, y: 340, w: 160, h: 80, tipo: "rect", texto: "Fundo (BOFU)", subtexto: "Converter — provas", cor: GREEN },
      { id: "fn-pos", x: 400, y: 460, w: 100, h: 70, tipo: "rect", texto: "Cliente", cor: AMBER },
    ],
    edges: [
      { id: "efn1", from: "fn-topo", to: "fn-meio", estilo: "solid", cor: GRAY },
      { id: "efn2", from: "fn-meio", to: "fn-fundo", estilo: "solid", cor: GRAY },
      { id: "efn3", from: "fn-fundo", to: "fn-pos", estilo: "solid", cor: GRAY },
    ],
  },

  // ─── Pilares de Conteúdo ────────────────────────────────
  {
    id: "pilares",
    titulo: "Pilares de Conteúdo",
    descricao: "Marca central com 4 pilares editoriais — base pra calendário.",
    emoji: "📚",
    nodes: [
      { id: "pl-c", x: 460, y: 280, w: 180, h: 80, tipo: "circle", texto: "Marca", cor: PURPLE },
      { id: "pl-1", x: 180, y: 100, w: 180, h: 70, tipo: "rect", texto: "Autoridade", subtexto: "Cases, métodos", cor: BLUE },
      { id: "pl-2", x: 740, y: 100, w: 180, h: 70, tipo: "rect", texto: "Educacional", subtexto: "Como fazer, dicas", cor: GREEN },
      { id: "pl-3", x: 180, y: 460, w: 180, h: 70, tipo: "rect", texto: "Bastidores", subtexto: "Equipe, processo", cor: AMBER },
      { id: "pl-4", x: 740, y: 460, w: 180, h: 70, tipo: "rect", texto: "Conversão", subtexto: "Oferta, CTA", cor: PINK },
    ],
    edges: [
      { id: "epl1", from: "pl-1", to: "pl-c", estilo: "solid", cor: GRAY },
      { id: "epl2", from: "pl-2", to: "pl-c", estilo: "solid", cor: GRAY },
      { id: "epl3", from: "pl-3", to: "pl-c", estilo: "solid", cor: GRAY },
      { id: "epl4", from: "pl-4", to: "pl-c", estilo: "solid", cor: GRAY },
    ],
  },
];
