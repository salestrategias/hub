"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { Sparkles, CheckSquare, Bookmark, Search, Plus, Trash2, ExternalLink, Share2, Download, Play, Rewind, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Block = { id: string; ordem: number; timestamp: number; speaker: string; speakerCor: string | null; texto: string };
type Action = { id: string; texto: string; responsavel: string | null; prazo: string | null; concluido: boolean };
type Capitulo = { id: string; timestamp: number; titulo: string };

type Reuniao = {
  id: string;
  titulo: string;
  data: string;
  duracaoSeg: number | null;
  status: string;
  participantes: string[];
  tagsLivres: string[];
  clienteNome: string | null;
  resumoIA: string | null;
  notasLivres: string | null;
  blocks: Block[];
  actions: Action[];
  capitulos: Capitulo[];
};

const SPEAKER_CORES = ["#7E30E1", "#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#14B8A6"];

export function ReuniaoDetalhe({ reuniao }: { reuniao: Reuniao }) {
  const [busca, setBusca] = useState("");
  const router = useRouter();

  const corPorSpeaker = useMemo(() => {
    const m = new Map<string, string>();
    reuniao.blocks.forEach((b) => {
      if (!m.has(b.speaker)) m.set(b.speaker, b.speakerCor ?? SPEAKER_CORES[m.size % SPEAKER_CORES.length]);
    });
    return m;
  }, [reuniao.blocks]);

  const blocksFiltrados = useMemo(
    () => reuniao.blocks.filter((b) => !busca || b.texto.toLowerCase().includes(busca.toLowerCase())),
    [reuniao.blocks, busca]
  );

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm"><Share2 className="h-3.5 w-3.5" /> Compartilhar</Button>
        <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Exportar</Button>
        <Button variant="outline" size="sm"><Sparkles className="h-3.5 w-3.5" /> Reprocessar com IA</Button>
      </div>

      <div className="grid md:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-4 min-w-0">
          {/* Player de áudio + waveform */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-muted-foreground">
                  {reuniao.participantes.join(", ")}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7"><Play className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7"><Rewind className="h-3.5 w-3.5" /></Button>
                  <span className="text-[11px] font-mono text-muted-foreground ml-1">
                    00:00 / {fmtTimecode(reuniao.duracaoSeg ?? 0)}
                  </span>
                </div>
              </div>
              <Waveform />
            </CardContent>
          </Card>

          <Tabs defaultValue="transcricao">
            <TabsList>
              <TabsTrigger value="transcricao">Transcrição</TabsTrigger>
              <TabsTrigger value="resumo">Resumo IA</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
              <TabsTrigger value="capitulos">Capítulos</TabsTrigger>
            </TabsList>

            <TabsContent value="transcricao">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar na transcrição..."
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    {blocksFiltrados.map((b) => (
                      <div key={b.id} className="flex gap-3 py-1.5 group">
                        <span className="font-mono text-[10.5px] text-muted-foreground/60 group-hover:text-muted-foreground transition w-16 shrink-0 mt-0.5">
                          {fmtTimecode(b.timestamp)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold mb-0.5" style={{ color: corPorSpeaker.get(b.speaker) }}>
                            {b.speaker}
                          </div>
                          <div className="text-[13.5px] leading-relaxed">{highlight(b.texto, busca)}</div>
                        </div>
                      </div>
                    ))}
                    {reuniao.blocks.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-12">
                        Transcrição ainda não disponível.<br />
                        <span className="text-xs">Faça upload do áudio ou cole a transcrição manualmente.</span>
                      </div>
                    )}
                    {reuniao.blocks.length > 0 && blocksFiltrados.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">Nenhum trecho com "{busca}".</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resumo">
              <Card>
                <CardContent className="p-6">
                  {reuniao.resumoIA ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{reuniao.resumoIA}</p>
                  ) : (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      Resumo IA ainda não gerado. Clique em "Reprocessar com IA" para gerar.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notas">
              <Card>
                <CardContent className="p-6">
                  {reuniao.notasLivres ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{reuniao.notasLivres}</p>
                  ) : (
                    <div className="text-center py-10 text-sm text-muted-foreground">Sem notas adicionadas.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="capitulos">
              <Card>
                <CardContent className="p-6">
                  {reuniao.capitulos.length > 0 ? (
                    <div className="space-y-2">
                      {reuniao.capitulos.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-2 hover:text-primary transition cursor-pointer">
                          <span className="font-mono text-[11px] text-muted-foreground w-16">{fmtTimecode(c.timestamp)}</span>
                          <span className="text-sm">{c.titulo}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-sm text-muted-foreground">Sem capítulos definidos.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar direita: resumo + actions + capítulos */}
        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-sal-400" /> Resumo IA
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6"><RefreshCw className="h-3 w-3" /></Button>
              </div>
              {reuniao.resumoIA ? (
                <p className="text-[12.5px] leading-relaxed text-muted-foreground line-clamp-6">{reuniao.resumoIA}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sem resumo. Clique em "Reprocessar com IA".</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <CheckSquare className="h-3.5 w-3.5 text-sal-400" /> Action items
                </div>
                <ActionButton reuniaoId={reuniao.id} onCreated={() => router.refresh()} />
              </div>
              <div className="space-y-2">
                {reuniao.actions.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">Sem action items. Adicione manualmente ou use a IA.</p>
                )}
                {reuniao.actions.map((a) => (
                  <ActionItem key={a.id} a={a} onChange={() => router.refresh()} />
                ))}
              </div>
            </CardContent>
          </Card>

          {reuniao.capitulos.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Bookmark className="h-3.5 w-3.5 text-muted-foreground" /> Capítulos
                  </div>
                </div>
                <div className="space-y-1.5 text-[12px]">
                  {reuniao.capitulos.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-1 hover:text-primary cursor-pointer transition">
                      <span className="font-mono text-[10.5px] text-muted-foreground">{fmtTimecode(c.timestamp)}</span>
                      <span className="ml-3 flex-1 truncate text-right">{c.titulo}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {reuniao.tagsLivres.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {reuniao.tagsLivres.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function ActionItem({ a, onChange }: { a: Action; onChange: () => void }) {
  async function toggle() {
    await fetch(`/api/reunioes/actions/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concluido: !a.concluido }),
    });
    onChange();
  }
  async function excluir() {
    await fetch(`/api/reunioes/actions/${a.id}`, { method: "DELETE" });
    toast.success("Action item removido");
    onChange();
  }
  return (
    <div className="flex items-start gap-2.5 group hover:bg-secondary/40 -mx-2 px-2 py-1.5 rounded-md transition">
      <input type="checkbox" checked={a.concluido} onChange={toggle} className="mt-0.5 accent-sal-600" />
      <div className="flex-1 min-w-0">
        <div className={cn("text-[12.5px]", a.concluido && "line-through text-muted-foreground")}>{a.texto}</div>
        {(a.responsavel || a.prazo) && (
          <div className="text-[10.5px] text-muted-foreground mt-0.5">
            {a.responsavel}{a.responsavel && a.prazo ? " · " : ""}{a.prazo}
          </div>
        )}
      </div>
      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={excluir}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function ActionButton({ reuniaoId, onCreated }: { reuniaoId: string; onCreated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [texto, setTexto] = useState("");
  const [responsavel, setResponsavel] = useState("");

  async function salvar() {
    if (!texto.trim()) { setEditing(false); return; }
    const res = await fetch(`/api/reunioes/${reuniaoId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, responsavel: responsavel || null }),
    });
    if (!res.ok) { toast.error("Erro ao adicionar"); return; }
    setTexto(""); setResponsavel(""); setEditing(false);
    onCreated();
  }

  if (!editing) {
    return <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)}><Plus className="h-3.5 w-3.5" /></Button>;
  }
  return (
    <div className="flex flex-col gap-1.5 absolute bg-card border border-border rounded-md p-2 right-5 mt-7 z-10 shadow-lg w-64">
      <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Action item..." className="h-7 text-xs" autoFocus />
      <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Responsável (opcional)" className="h-7 text-xs" />
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setEditing(false)}>Cancelar</Button>
        <Button size="sm" className="h-6 text-[10px]" onClick={salvar}>Adicionar</Button>
      </div>
    </div>
  );
}

function Waveform() {
  // Waveform decorativo com barras pseudo-aleatórias
  const bars = Array.from({ length: 120 }, (_, i) => 20 + Math.abs(Math.sin(i * 0.7) * 60) + Math.abs(Math.cos(i * 1.3) * 20));
  return (
    <div className="h-12 bg-secondary/40 rounded-md flex items-end gap-px p-1.5 overflow-hidden">
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: "#7E30E1", opacity: 0.4 + (i / bars.length) * 0.5 }} />
      ))}
    </div>
  );
}

function fmtTimecode(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function highlight(texto: string, q: string) {
  if (!q) return texto;
  const parts = texto.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="bg-sal-600/30 text-sal-400 rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>
  );
}
