"use client";
/**
 * Tab Calendário do Portal do Cliente.
 *
 * Cards de posts com:
 *  - Título, formato, data, status
 *  - Legenda/briefing colapsável
 *  - Comentários anteriores (cliente + SAL)
 *  - Botões "Aprovar" e "Pedir ajuste" (se permissão)
 *
 * Status visíveis: COPY_PRONTA, DESIGN_PRONTO, AGENDADO, PUBLICADO.
 * Rascunhos não chegam aqui (filtrado no backend).
 */
import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, MessageSquare, Clock, Loader2 } from "lucide-react";
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

type Post = {
  id: string;
  titulo: string;
  legenda: string | null;
  pilar: string | null;
  formato: string;
  status: string;
  dataPublicacao: string;
  comentarios: Comentario[];
};

const STATUS_LABEL: Record<string, string> = {
  COPY_PRONTA: "Aguardando aprovação",
  DESIGN_PRONTO: "Em produção (arte)",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
};

const STATUS_COR: Record<string, string> = {
  COPY_PRONTA: "#F59E0B",
  DESIGN_PRONTO: "#8B5CF6",
  AGENDADO: "#3B82F6",
  PUBLICADO: "#10B981",
};

const FORMATO_LABEL: Record<string, string> = {
  FEED: "Post estático",
  CARROSSEL: "Carrossel",
  REELS: "Reels / Vídeo",
  STORIES: "Stories",
};

export function PortalCalendario({
  token,
  podeAprovar,
  podeComentar,
}: {
  token: string;
  podeAprovar: boolean;
  podeComentar: boolean;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [comentando, setComentando] = useState<Post | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/p/cliente/${token}/calendario`);
      const data = await res.json();
      if (Array.isArray(data)) setPosts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aprovar(post: Post) {
    if (!confirm(`Aprovar "${post.titulo}"?\n\nA SAL será notificada e pode prosseguir pra produção da arte.`)) return;
    const res = await fetch(`/api/p/cliente/${token}/post/${post.id}/aprovar`, { method: "POST" });
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

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum conteúdo pra mostrar agora.</p>
          <p className="text-[11px] text-muted-foreground/70">
            Quando a SAL produzir conteúdo novo pra aprovação, aparece aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Agrupa por mês
  const grupos = new Map<string, Post[]>();
  for (const p of posts) {
    const d = new Date(p.dataPublicacao);
    const chave = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const arr = grupos.get(chave) ?? [];
    arr.push(p);
    grupos.set(chave, arr);
  }

  return (
    <div className="space-y-5">
      {Array.from(grupos.entries()).map(([mes, postsMes]) => (
        <section key={mes} className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground capitalize">
            {mes}
          </h2>
          <div className="space-y-2">
            {postsMes.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                podeAprovar={podeAprovar}
                podeComentar={podeComentar}
                onAprovar={() => aprovar(p)}
                onComentar={() => setComentando(p)}
              />
            ))}
          </div>
        </section>
      ))}

      {comentando && (
        <ComentarDialog
          token={token}
          post={comentando}
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

function PostCard({
  post,
  podeAprovar,
  podeComentar,
  onAprovar,
  onComentar,
}: {
  post: Post;
  podeAprovar: boolean;
  podeComentar: boolean;
  onAprovar: () => void;
  onComentar: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const data = new Date(post.dataPublicacao);
  const cor = STATUS_COR[post.status] ?? "#9CA3AF";
  const aprovavel = post.status === "COPY_PRONTA" && podeAprovar;
  const jaAprovouSAL = post.comentarios.some((c) => c.tipo === "APROVOU");
  const ultimoAjuste = post.comentarios.find((c) => c.tipo === "PEDIU_AJUSTE");

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-12 h-12 rounded-md flex flex-col items-center justify-center"
            style={{ background: `${cor}15`, border: `1px solid ${cor}40` }}
          >
            <span className="text-[9px] uppercase font-semibold" style={{ color: cor }}>
              {data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
            </span>
            <span className="text-lg font-mono font-semibold leading-none" style={{ color: cor }}>
              {data.getDate()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">{post.titulo}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
                {STATUS_LABEL[post.status] ?? post.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {FORMATO_LABEL[post.formato] ?? post.formato}
              </Badge>
              {post.pilar && (
                <span className="text-[10px] text-muted-foreground">· {post.pilar}</span>
              )}
            </div>
          </div>
        </div>

        {post.legenda && (
          <div>
            <button
              onClick={() => setExpandido((v) => !v)}
              className="text-[11px] text-primary hover:underline"
            >
              {expandido ? "Ocultar briefing/legenda" : "Ver briefing/legenda"}
            </button>
            {expandido && (
              <div className="mt-2 rounded-md bg-muted/30 border border-border p-3 text-[12.5px] whitespace-pre-wrap leading-relaxed">
                {post.legenda}
              </div>
            )}
          </div>
        )}

        {/* Comentários */}
        {post.comentarios.length > 0 && (
          <div className="space-y-1.5 border-t border-border/40 pt-3">
            {jaAprovouSAL && (
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
                <p className="text-[12px] leading-snug">{ultimoAjuste.texto}</p>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        {(aprovavel || podeComentar) && (
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
            {podeComentar && (
              <Button size="sm" variant="outline" onClick={onComentar} className="flex-1">
                <MessageSquare className="h-3.5 w-3.5" /> Pedir ajuste
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComentarDialog({
  token,
  post,
  onClose,
  onSuccess,
}: {
  token: string;
  post: Post;
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
      const res = await fetch(`/api/p/cliente/${token}/post/${post.id}/comentar`, {
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
          <DialogTitle className="text-base">Pedir ajuste</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">{post.titulo}</p>
        </DialogHeader>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva o ajuste que você gostaria — quanto mais específico, mais rápido a SAL resolve."
          rows={5}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando || texto.trim().length < 3}>
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
            Enviar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
