"use client";
/**
 * Sheet de edição de Criativo de Anúncio. Mirror estrutural do post-sheet
 * mas com campos específicos de tráfego pago: público-alvo, orçamento,
 * datas, vínculo opcional com CampanhaPaga.
 *
 * 5 tabs:
 *  - Copy do anúncio (textoPrincipal/headline/descricao/CTA/URL)
 *  - Artes (CriativoArquivosEditor)
 *  - Planejamento (público, orçamento, datas)
 *  - Notas internas (observacoesProducao — não vai pro cliente)
 *  - Comentários do cliente (read-only)
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Trash2, MessageSquare, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { EntitySheet } from "@/components/entity-sheet";
import { InlineField } from "@/components/inline-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { CriativoArquivosEditor } from "@/components/criativo-arquivos-editor";
import { VincularCampanhaDialog } from "@/components/vincular-campanha-dialog";

type CriativoStatus =
  | "RASCUNHO"
  | "EM_APROVACAO"
  | "APROVADO"
  | "RECUSADO"
  | "NO_AR"
  | "PAUSADO"
  | "ENCERRADO";

type CriativoFull = {
  id: string;
  titulo: string;
  status: CriativoStatus;
  plataforma: "META_ADS" | "GOOGLE_ADS" | "TIKTOK_ADS" | "YOUTUBE_ADS" | "LINKEDIN_ADS";
  formato:
    | "POST_IMAGEM"
    | "POST_VIDEO"
    | "CARROSSEL"
    | "COLLECTION"
    | "STORY"
    | "REELS_AD"
    | "RESPONSIVE_DISPLAY"
    | "SEARCH_AD"
    | "PERFORMANCE_MAX";
  textoPrincipal: string | null;
  headline: string | null;
  descricao: string | null;
  ctaBotao: string | null;
  urlDestino: string | null;
  publicoAlvo: string | null;
  orcamento: string | null; // Decimal vem como string
  inicio: string | null;
  fim: string | null;
  observacoesProducao: string | null;
  cliente: { id: string; nome: string };
  campanhaPaga: { id: string; nome: string; ano: number; mes: number; plataforma: string } | null;
  comentarios?: Array<{
    id: string;
    tipo: "APROVOU" | "PEDIU_AJUSTE";
    texto: string | null;
    clienteNome: string;
    createdAt: string;
  }>;
};

const STATUS_OPTIONS = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "EM_APROVACAO", label: "Em aprovação" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "RECUSADO", label: "Recusado" },
  { value: "NO_AR", label: "No ar" },
  { value: "PAUSADO", label: "Pausado" },
  { value: "ENCERRADO", label: "Encerrado" },
];

const PLATAFORMA_OPTIONS = [
  { value: "META_ADS", label: "Meta Ads" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "TIKTOK_ADS", label: "TikTok Ads" },
  { value: "YOUTUBE_ADS", label: "YouTube Ads" },
  { value: "LINKEDIN_ADS", label: "LinkedIn Ads" },
];

const FORMATO_OPTIONS = [
  { value: "POST_IMAGEM", label: "Post imagem" },
  { value: "POST_VIDEO", label: "Post vídeo" },
  { value: "CARROSSEL", label: "Carrossel" },
  { value: "COLLECTION", label: "Collection" },
  { value: "STORY", label: "Story" },
  { value: "REELS_AD", label: "Reels Ad" },
  { value: "RESPONSIVE_DISPLAY", label: "Display responsivo" },
  { value: "SEARCH_AD", label: "Search Ad" },
  { value: "PERFORMANCE_MAX", label: "Performance Max" },
];

const STATUS_COR: Record<CriativoStatus, string> = {
  RASCUNHO: "#9696A8",
  EM_APROVACAO: "#F59E0B",
  APROVADO: "#10B981",
  RECUSADO: "#EF4444",
  NO_AR: "#7E30E1",
  PAUSADO: "#3B82F6",
  ENCERRADO: "#6B7280",
};

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function CriativoSheet({
  criativoId,
  open,
  onOpenChange,
  clientes,
}: {
  criativoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes?: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [criativo, setCriativo] = useState<CriativoFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vincularOpen, setVincularOpen] = useState(false);

  async function carregar() {
    if (!criativoId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/criativos/${criativoId}`);
      if (!r.ok) throw new Error("Falha ao carregar criativo");
      setCriativo(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!criativoId || !open) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criativoId, open]);

  async function patchCriativo(patch: Record<string, unknown>) {
    if (!criativoId) return;
    const res = await fetch(`/api/criativos/${criativoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    setCriativo((p) => (p ? { ...p, ...updated } : p));
  }

  async function excluir() {
    if (!criativoId || !criativo) return;
    if (!confirm(`Excluir o criativo "${criativo.titulo}"?`)) return;
    const res = await fetch(`/api/criativos/${criativoId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Criativo excluído");
    onOpenChange(false);
    router.refresh();
  }

  const cor = criativo ? STATUS_COR[criativo.status] : "#7E30E1";
  const inicioInput = criativo?.inicio ? toLocalInput(criativo.inicio) : "";
  const fimInput = criativo?.fim ? toLocalInput(criativo.fim) : "";

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !criativo}
      error={error}
      icone={Megaphone}
      iconeCor={cor}
      titulo={criativo?.titulo ?? "Carregando..."}
      subtitulo={
        criativo && (
          <span className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
              {criativo.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{criativo.plataforma.replace("_", " ")}</Badge>
            <Badge variant="outline" className="text-[10px]">{criativo.formato.replace(/_/g, " ")}</Badge>
            <span className="text-muted-foreground">· {criativo.cliente.nome}</span>
          </span>
        )
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={excluir} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <span className="text-[10.5px] text-muted-foreground/70">Edição salva automaticamente</span>
        </>
      }
    >
      {criativo && criativoId && (
        <div className="space-y-4">
          {/* Campos meta */}
          <div className="grid grid-cols-2 gap-3">
            <InlineField
              type="text"
              label="Título"
              value={criativo.titulo}
              onSave={(v) => patchCriativo({ titulo: v })}
              size="sm"
              className="col-span-2"
            />
            <InlineField
              type="select"
              label="Status"
              value={criativo.status}
              options={STATUS_OPTIONS}
              onSave={(v) => patchCriativo({ status: v })}
              size="sm"
            />
            <InlineField
              type="select"
              label="Plataforma"
              value={criativo.plataforma}
              options={PLATAFORMA_OPTIONS}
              onSave={(v) => patchCriativo({ plataforma: v })}
              size="sm"
            />
            <InlineField
              type="select"
              label="Formato"
              value={criativo.formato}
              options={FORMATO_OPTIONS}
              onSave={(v) => patchCriativo({ formato: v })}
              size="sm"
            />
            {clientes && clientes.length > 0 && (
              <InlineField
                type="select"
                label="Cliente"
                value={criativo.cliente.id}
                options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                onSave={(v) => patchCriativo({ clienteId: v })}
                size="sm"
              />
            )}
          </div>

          {/* Vinculo campanha */}
          <div className="rounded-md border border-border bg-card/40 p-3 flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Campanha vinculada
              </div>
              {criativo.campanhaPaga ? (
                <div className="text-xs">
                  <span className="font-medium">{criativo.campanhaPaga.nome}</span>
                  <span className="text-muted-foreground ml-2">
                    {MESES[criativo.campanhaPaga.mes]}/{criativo.campanhaPaga.ano} ·{" "}
                    {criativo.campanhaPaga.plataforma.replace("_", " ")}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">— Nenhuma campanha vinculada</span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setVincularOpen(true)}>
              <LinkIcon className="h-3.5 w-3.5" />
              {criativo.campanhaPaga ? "Trocar" : "Vincular campanha"}
            </Button>
          </div>

          <VincularCampanhaDialog
            criativoId={criativoId}
            clienteId={criativo.cliente.id}
            campanhaAtualId={criativo.campanhaPaga?.id ?? null}
            open={vincularOpen}
            onOpenChange={setVincularOpen}
            onVinculada={carregar}
          />

          {/* Tabs */}
          <Tabs defaultValue="copy" className="w-full">
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="copy">Copy do anúncio</TabsTrigger>
              <TabsTrigger value="artes">Artes / Vídeos</TabsTrigger>
              <TabsTrigger value="plan">Planejamento</TabsTrigger>
              <TabsTrigger value="producao">Notas internas</TabsTrigger>
              {criativo.comentarios && criativo.comentarios.length > 0 && (
                <TabsTrigger value="comentarios">
                  Comentários do cliente ({criativo.comentarios.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="copy" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Texto principal (corpo do anúncio)
                </div>
                <Textarea
                  defaultValue={criativo.textoPrincipal ?? ""}
                  rows={5}
                  placeholder="Texto que aparece acima da arte. Meta: Primary Text. Pode usar emojis."
                  onBlur={(e) => {
                    if (e.target.value !== criativo.textoPrincipal) {
                      patchCriativo({ textoPrincipal: e.target.value || null });
                    }
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Headline (título)
                  </div>
                  <Input
                    defaultValue={criativo.headline ?? ""}
                    placeholder="Título curto (até 40 chars)"
                    onBlur={(e) => {
                      if (e.target.value !== criativo.headline) {
                        patchCriativo({ headline: e.target.value || null });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                    CTA do botão
                  </div>
                  <Input
                    defaultValue={criativo.ctaBotao ?? ""}
                    placeholder='Ex: "Saiba mais", "Compre agora"'
                    onBlur={(e) => {
                      if (e.target.value !== criativo.ctaBotao) {
                        patchCriativo({ ctaBotao: e.target.value || null });
                      }
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Descrição (sub-título)
                </div>
                <Textarea
                  defaultValue={criativo.descricao ?? ""}
                  rows={2}
                  placeholder="Texto secundário (Meta: Description; Google: Description)"
                  onBlur={(e) => {
                    if (e.target.value !== criativo.descricao) {
                      patchCriativo({ descricao: e.target.value || null });
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  URL de destino
                </div>
                <Input
                  defaultValue={criativo.urlDestino ?? ""}
                  placeholder="https://..."
                  onBlur={(e) => {
                    if (e.target.value !== criativo.urlDestino) {
                      patchCriativo({ urlDestino: e.target.value || null });
                    }
                  }}
                />
                <p className="text-[10.5px] text-muted-foreground/70">
                  Landing page pra onde o anúncio leva. Cliente vê pra avaliar coerência.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="artes" className="mt-4">
              <CriativoArquivosEditor criativoId={criativoId} />
            </TabsContent>

            <TabsContent value="plan" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Público-alvo (descrição livre)
                </div>
                <Textarea
                  defaultValue={criativo.publicoAlvo ?? ""}
                  rows={4}
                  placeholder="Ex: Mulheres 25-45, RS+SC, interesse em decoração e arquitetura. Lookalike 2% dos compradores."
                  onBlur={(e) => {
                    if (e.target.value !== criativo.publicoAlvo) {
                      patchCriativo({ publicoAlvo: e.target.value || null });
                    }
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <InlineField
                  type="money"
                  label="Orçamento (R$)"
                  value={criativo.orcamento ? Number(criativo.orcamento) : 0}
                  onSave={(v) => patchCriativo({ orcamento: v ? Number(v) : null })}
                  size="sm"
                />
                <InlineField
                  type="datetime-local"
                  label="Início"
                  value={inicioInput}
                  onSave={(v) => patchCriativo({ inicio: v ? new Date(v).toISOString() : null })}
                  size="sm"
                />
                <InlineField
                  type="datetime-local"
                  label="Fim"
                  value={fimInput}
                  onSave={(v) => patchCriativo({ fim: v ? new Date(v).toISOString() : null })}
                  size="sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="producao" className="mt-4 space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Notas internas (cliente NÃO vê)
              </div>
              <Textarea
                defaultValue={criativo.observacoesProducao ?? ""}
                rows={6}
                placeholder="Briefing pra equipe: estilo de arte, ref de campanhas anteriores, variações pendentes..."
                onBlur={(e) => {
                  if (e.target.value !== criativo.observacoesProducao) {
                    patchCriativo({ observacoesProducao: e.target.value || null });
                  }
                }}
              />
            </TabsContent>

            {criativo.comentarios && criativo.comentarios.length > 0 && (
              <TabsContent value="comentarios" className="mt-4 space-y-2">
                {criativo.comentarios.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-md border p-3 ${
                      c.tipo === "APROVOU"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-amber-500/30 bg-amber-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs mb-1">
                      {c.tipo === "APROVOU" ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="font-medium text-emerald-500">Aprovado</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                          <span className="font-medium text-amber-500">Pediu ajuste</span>
                        </>
                      )}
                      <span className="text-muted-foreground/70 ml-auto text-[10.5px]">
                        {c.clienteNome} ·{" "}
                        {new Date(c.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {c.texto && <p className="text-[12.5px] leading-snug whitespace-pre-wrap">{c.texto}</p>}
                  </div>
                ))}
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}
    </EntitySheet>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
