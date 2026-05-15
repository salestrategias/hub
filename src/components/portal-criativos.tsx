"use client";
/**
 * Tab Criativos do Portal do Cliente.
 *
 * Cards de criativos de tráfego pago com:
 *  - Título, plataforma, formato, status
 *  - Carrossel de artes (mesmo componente visual do calendário)
 *  - Texto principal, headline, descrição, CTA do botão, URL destino
 *  - Público-alvo (resumido)
 *  - Comentários anteriores
 *  - Botões "Aprovar" e "Pedir ajuste" (se permissão)
 *
 * Status visíveis (filtrado no backend): EM_APROVACAO, APROVADO,
 * RECUSADO, NO_AR, PAUSADO, ENCERRADO. Rascunhos ficam internos.
 */
import { useEffect, useState } from "react";
import {
  Megaphone,
  CheckCircle2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Link2,
  Video,
  Target,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Comentario = {
  id: string;
  tipo: "APROVOU" | "PEDIU_AJUSTE";
  texto: string | null;
  createdAt: string;
};

type Arquivo = {
  id: string;
  tipo: "IMAGEM" | "VIDEO" | "DOCUMENTO" | "LINK_EXTERNO";
  url: string;
  nome: string | null;
  legenda: string | null;
  ordem: number;
};

type Criativo = {
  id: string;
  titulo: string;
  status: string;
  plataforma: string;
  formato: string;
  textoPrincipal: string | null;
  headline: string | null;
  descricao: string | null;
  ctaBotao: string | null;
  urlDestino: string | null;
  publicoAlvo: string | null;
  inicio: string | null;
  fim: string | null;
  arquivos: Arquivo[];
  comentarios: Comentario[];
};

const STATUS_LABEL: Record<string, string> = {
  EM_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  NO_AR: "No ar",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
};

const STATUS_COR: Record<string, string> = {
  EM_APROVACAO: "#F59E0B",
  APROVADO: "#10B981",
  RECUSADO: "#EF4444",
  NO_AR: "#7E30E1",
  PAUSADO: "#3B82F6",
  ENCERRADO: "#6B7280",
};

const PLATAFORMA_LABEL: Record<string, string> = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  TIKTOK_ADS: "TikTok Ads",
  YOUTUBE_ADS: "YouTube Ads",
  LINKEDIN_ADS: "LinkedIn Ads",
};

const FORMATO_LABEL: Record<string, string> = {
  POST_IMAGEM: "Post imagem",
  POST_VIDEO: "Post vídeo",
  CARROSSEL: "Carrossel",
  COLLECTION: "Collection",
  STORY: "Story",
  REELS_AD: "Reels Ad",
  RESPONSIVE_DISPLAY: "Display responsivo",
  SEARCH_AD: "Search Ad",
  PERFORMANCE_MAX: "Performance Max",
};

export function PortalCriativos({
  token,
  podeAprovar,
  podeComentar,
}: {
  token: string;
  podeAprovar: boolean;
  podeComentar: boolean;
}) {
  const [criativos, setCriativos] = useState<Criativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [comentando, setComentando] = useState<Criativo | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/p/cliente/${token}/criativos`);
      const data = await res.json();
      if (Array.isArray(data)) setCriativos(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aprovar(c: Criativo) {
    if (
      !confirm(
        `Aprovar "${c.titulo}"?\n\nA SAL será notificada e o criativo segue pra subir na plataforma de ${PLATAFORMA_LABEL[c.plataforma] ?? c.plataforma}.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/p/cliente/${token}/criativo/${c.id}/aprovar`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? "Falha ao aprovar");
      return;
    }
    toast.success("Aprovado! SAL foi notificada.");
    carregar();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (criativos.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum criativo pra mostrar agora.</p>
          <p className="text-[11px] text-muted-foreground/70">
            Quando a SAL produzir novos criativos de anúncio pra aprovação, aparecem aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Agrupa por status pra priorizar o que precisa de ação
  const grupos = new Map<string, Criativo[]>();
  for (const c of criativos) {
    const arr = grupos.get(c.status) ?? [];
    arr.push(c);
    grupos.set(c.status, arr);
  }

  const ordemStatus = ["EM_APROVACAO", "APROVADO", "NO_AR", "PAUSADO", "RECUSADO", "ENCERRADO"];
  const gruposOrdenados = ordemStatus.filter((s) => grupos.has(s)).map((s) => [s, grupos.get(s)!] as const);

  return (
    <div className="space-y-5">
      {gruposOrdenados.map(([status, lista]) => (
        <section key={status} className="space-y-2">
          <h2
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: STATUS_COR[status] ?? "#9CA3AF" }}
          >
            {STATUS_LABEL[status] ?? status} ({lista.length})
          </h2>
          <div className="space-y-2">
            {lista.map((c) => (
              <CriativoCard
                key={c.id}
                criativo={c}
                podeAprovar={podeAprovar}
                podeComentar={podeComentar}
                onAprovar={() => aprovar(c)}
                onComentar={() => setComentando(c)}
              />
            ))}
          </div>
        </section>
      ))}

      {comentando && (
        <ComentarDialog
          token={token}
          criativo={comentando}
          onClose={() => setComentando(null)}
          onSuccess={() => {
            setComentando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function CriativoCard({
  criativo,
  podeAprovar,
  podeComentar,
  onAprovar,
  onComentar,
}: {
  criativo: Criativo;
  podeAprovar: boolean;
  podeComentar: boolean;
  onAprovar: () => void;
  onComentar: () => void;
}) {
  const cor = STATUS_COR[criativo.status] ?? "#9CA3AF";
  const aprovavel = criativo.status === "EM_APROVACAO" && podeAprovar;
  const jaAprovou = criativo.comentarios.some((c) => c.tipo === "APROVOU");
  const ultimoAjuste = criativo.comentarios.find((c) => c.tipo === "PEDIU_AJUSTE");
  const temArtes = criativo.arquivos.length > 0;

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 flex items-start gap-3">
          <div
            className="shrink-0 w-12 h-12 rounded-md flex items-center justify-center"
            style={{ background: `${cor}15`, border: `1px solid ${cor}40` }}
          >
            <Megaphone className="h-5 w-5" style={{ color: cor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">{criativo.titulo}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
                {STATUS_LABEL[criativo.status] ?? criativo.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {PLATAFORMA_LABEL[criativo.plataforma] ?? criativo.plataforma}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {FORMATO_LABEL[criativo.formato] ?? criativo.formato}
              </Badge>
            </div>
          </div>
        </div>

        {/* Carrossel de artes */}
        {temArtes && <ArtesCarrossel arquivos={criativo.arquivos} />}

        <div className="px-4 pb-4 space-y-3">
          {/* Texto principal */}
          {criativo.textoPrincipal && (
            <div className="rounded-md bg-muted/30 border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Texto do anúncio
              </div>
              <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{criativo.textoPrincipal}</p>
            </div>
          )}

          {/* Headline + descrição */}
          {(criativo.headline || criativo.descricao) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {criativo.headline && (
                <div className="rounded-md bg-muted/30 border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Headline
                  </div>
                  <p className="text-[12.5px] font-medium leading-snug">{criativo.headline}</p>
                </div>
              )}
              {criativo.descricao && (
                <div className="rounded-md bg-muted/30 border border-border p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Descrição
                  </div>
                  <p className="text-[12.5px] leading-snug">{criativo.descricao}</p>
                </div>
              )}
            </div>
          )}

          {/* CTA do botão + URL destino */}
          {(criativo.ctaBotao || criativo.urlDestino) && (
            <div className="rounded-md border-l-4 border-l-primary bg-primary/5 px-3 py-2 space-y-1">
              {criativo.ctaBotao && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                    Botão do anúncio
                  </div>
                  <div className="text-[12.5px] font-medium leading-snug">{criativo.ctaBotao}</div>
                </div>
              )}
              {criativo.urlDestino && (
                <a
                  href={criativo.urlDestino}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11.5px] text-primary hover:underline flex items-center gap-1 break-all"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {criativo.urlDestino}
                </a>
              )}
            </div>
          )}

          {/* Público-alvo */}
          {criativo.publicoAlvo && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                <Target className="h-3 w-3" /> Público-alvo
              </div>
              <p className="text-[12px] text-muted-foreground leading-snug whitespace-pre-wrap">{criativo.publicoAlvo}</p>
            </div>
          )}

          {/* Comentários anteriores */}
          {(jaAprovou || ultimoAjuste) && (
            <div className="space-y-1.5 border-t border-border/40 pt-3">
              {jaAprovou && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" /> Aprovado por você
                </div>
              )}
              {ultimoAjuste && (
                <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-2">
                  <div className="flex items-center gap-1.5 text-[10.5px] text-amber-500 font-medium mb-1">
                    <MessageSquare className="h-3 w-3" /> Você pediu ajuste
                    <span className="text-muted-foreground/70 ml-auto">
                      {new Date(ultimoAjuste.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-[12px] leading-snug whitespace-pre-wrap">{ultimoAjuste.texto}</p>
                </div>
              )}
            </div>
          )}

          {/* Ações */}
          {(aprovavel || (podeComentar && criativo.status === "EM_APROVACAO")) && (
            <div className="flex gap-2 pt-1">
              {aprovavel && (
                <Button
                  size="sm"
                  onClick={onAprovar}
                  className="flex-1"
                  style={{ background: "linear-gradient(135deg,#10B981 0%,#047857 100%)" }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                </Button>
              )}
              {podeComentar && criativo.status === "EM_APROVACAO" && (
                <Button size="sm" variant="outline" onClick={onComentar} className="flex-1">
                  <MessageSquare className="h-3.5 w-3.5" /> Pedir ajuste
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Carrossel de arquivos (mesma mecânica do PortalCalendario). */
function ArtesCarrossel({ arquivos }: { arquivos: Arquivo[] }) {
  const [atual, setAtual] = useState(0);
  const total = arquivos.length;
  const arquivoAtual = arquivos[atual];

  function anterior() {
    setAtual((a) => (a - 1 + total) % total);
  }
  function proximo() {
    setAtual((a) => (a + 1) % total);
  }

  const [touchStart, setTouchStart] = useState<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const delta = e.changedTouches[0].clientX - touchStart;
    if (delta > 50) anterior();
    else if (delta < -50) proximo();
    setTouchStart(null);
  }

  return (
    <div className="bg-muted/20 border-y border-border" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="relative aspect-square sm:aspect-[4/5] max-h-[600px] flex items-center justify-center bg-black/20">
        {arquivoAtual.tipo === "IMAGEM" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={arquivoAtual.url}
            alt={arquivoAtual.nome ?? ""}
            className="max-h-full max-w-full object-contain"
          />
        ) : arquivoAtual.tipo === "VIDEO" ? (
          <video src={arquivoAtual.url} controls className="max-h-full max-w-full" />
        ) : (
          <a
            href={arquivoAtual.url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 p-6 hover:text-primary transition"
          >
            {arquivoAtual.tipo === "DOCUMENTO" ? (
              <FileText className="h-12 w-12" />
            ) : (
              <Link2 className="h-12 w-12" />
            )}
            <span className="text-xs underline break-all max-w-[280px] text-center">
              {arquivoAtual.nome ?? arquivoAtual.url}
            </span>
          </a>
        )}

        {total > 1 && (
          <>
            <button
              onClick={anterior}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm items-center justify-center text-white transition"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={proximo}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm items-center justify-center text-white transition"
              aria-label="Próximo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {total > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {arquivos.map((_, i) => (
              <button
                key={i}
                onClick={() => setAtual(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === atual ? "w-6 bg-white" : "w-1.5 bg-white/40"
                }`}
                aria-label={`Ir pra slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {arquivoAtual.legenda && (
        <div className="px-4 py-2 text-[11.5px] text-muted-foreground bg-muted/40">
          <span className="font-medium text-foreground">
            {arquivoAtual.nome ?? `Variação ${atual + 1}`}:
          </span>{" "}
          {arquivoAtual.legenda}
        </div>
      )}

      {total > 1 && (
        <div className="px-4 py-1.5 text-[10.5px] text-muted-foreground/70 text-center">
          {atual + 1} de {total} {total === 1 ? "variação" : "variações"}
        </div>
      )}
    </div>
  );
}

function ComentarDialog({
  token,
  criativo,
  onClose,
  onSuccess,
}: {
  token: string;
  criativo: Criativo;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (texto.trim().length < 3) {
      toast.error("Mensagem muito curta");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/p/cliente/${token}/criativo/${criativo.id}/comentar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao enviar");
        return;
      }
      toast.success("Pedido enviado! SAL foi notificada.");
      onSuccess();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Pedir ajuste no criativo</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">{criativo.titulo}</p>
        </DialogHeader>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva o ajuste — quanto mais específico, mais rápido a SAL resolve. Ex: 'Trocar headline pra X', 'Imagem 2 está com cor diferente do nosso padrão'."
          rows={5}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando || texto.trim().length < 3}>
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
            Enviar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
