"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, MessageSquare, CheckCircle2, Hash, Megaphone } from "lucide-react";
import { EntitySheet } from "@/components/entity-sheet";
import { InlineField } from "@/components/inline-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { PostArquivosEditor } from "@/components/post-arquivos-editor";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import { blocknoteToText } from "@/lib/blocknote-to-text";

type PostFull = {
  id: string;
  titulo: string;
  legenda: string | null;
  pilar: string | null;
  formato: "FEED" | "STORIES" | "REELS" | "CARROSSEL";
  status: "RASCUNHO" | "COPY_PRONTA" | "DESIGN_PRONTO" | "AGENDADO" | "PUBLICADO";
  dataPublicacao: string;
  googleEventId: string | null;
  hashtags: string[];
  cta: string | null;
  observacoesProducao: string | null;
  cliente: { id: string; nome: string } | null;
  comentarios?: Array<{
    id: string;
    tipo: "APROVOU" | "PEDIU_AJUSTE";
    texto: string | null;
    clienteNome: string;
    createdAt: string;
  }>;
};

const FORMATO_OPTIONS = [
  { value: "FEED", label: "Feed" },
  { value: "STORIES", label: "Stories" },
  { value: "REELS", label: "Reels" },
  { value: "CARROSSEL", label: "Carrossel" },
];

const STATUS_OPTIONS = [
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "COPY_PRONTA", label: "Copy pronta" },
  { value: "DESIGN_PRONTO", label: "Design pronto" },
  { value: "AGENDADO", label: "Agendado" },
  { value: "PUBLICADO", label: "Publicado" },
];

const STATUS_COR: Record<PostFull["status"], string> = {
  RASCUNHO: "#9696A8",
  COPY_PRONTA: "#F59E0B",
  DESIGN_PRONTO: "#3B82F6",
  AGENDADO: "#7E30E1",
  PUBLICADO: "#10B981",
};

export function PostSheet({
  postId,
  open,
  onOpenChange,
  clientes,
}: {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes?: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [post, setPost] = useState<PostFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/posts/${postId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Falha ao carregar post");
        return r.json();
      })
      .then(setPost)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [postId, open]);

  async function patchPost(patch: Record<string, unknown>) {
    if (!postId) return;
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Falha ao salvar");
    }
    const updated = await res.json();
    // Mergeia só os campos retornados, mas preserva `legenda` local se já
    // está atualizada — evita race condition quando uma resposta antiga
    // chega depois e sobrescreve o que o user acabou de digitar.
    setPost((p) => {
      if (!p) return p;
      const merged = { ...p, ...updated };
      // Se o patch tinha legenda, confia no que o user digitou (que já
      // está no editor + foi enviado nesse mesmo PATCH)
      if (typeof patch.legenda === "string") merged.legenda = patch.legenda;
      return merged;
    });
  }

  // Debounce o save da legenda — onChange do BlockEditor dispara em toda
  // tecla. Sem debounce, dezenas de PATCHes concorrentes causam race
  // condition e perda de conteúdo.
  const { trigger: salvarLegenda, flush: flushLegenda } = useDebouncedSave<string>(
    (legenda) => patchPost({ legenda }),
    700
  );
  const { trigger: salvarObservacoes } = useDebouncedSave<string | null>(
    (observacoesProducao) => patchPost({ observacoesProducao }),
    700
  );
  const { trigger: salvarCta } = useDebouncedSave<string | null>(
    (cta) => patchPost({ cta }),
    700
  );

  // Flush save pendente quando sheet fecha
  useEffect(() => {
    if (!open) flushLegenda();
  }, [open, flushLegenda]);

  async function excluir() {
    if (!postId || !post) return;
    if (!confirm(`Excluir o post "${post.titulo}"?`)) return;
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Post excluído");
    onOpenChange(false);
    router.refresh();
  }

  const cor = post ? STATUS_COR[post.status] : "#7E30E1";
  const dataPubInput = post?.dataPublicacao ? toLocalInput(post.dataPublicacao) : "";

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !post}
      error={error}
      icone={FileText}
      iconeCor={cor}
      titulo={post?.titulo ?? "Carregando..."}
      subtitulo={
        post && (
          <span className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]" style={{ color: cor, borderColor: `${cor}55` }}>
              {post.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{post.formato}</Badge>
            {post.cliente && <span className="text-muted-foreground">· {post.cliente.nome}</span>}
            {post.googleEventId && <span className="text-emerald-400 text-[10px]">📅 agendado</span>}
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
      {post && postId && (
        <div className="space-y-4">
          {/* Campos meta (sempre visíveis) */}
          <div className="grid grid-cols-2 gap-3">
            <InlineField
              type="text"
              label="Título"
              value={post.titulo}
              onSave={(v) => patchPost({ titulo: v })}
              size="sm"
              className="col-span-2"
            />
            <InlineField
              type="select"
              label="Status"
              value={post.status}
              options={STATUS_OPTIONS}
              onSave={(v) => patchPost({ status: v })}
              size="sm"
            />
            <InlineField
              type="select"
              label="Formato"
              value={post.formato}
              options={FORMATO_OPTIONS}
              onSave={(v) => patchPost({ formato: v })}
              size="sm"
            />
            <InlineField
              type="datetime-local"
              label="Publicação"
              value={dataPubInput}
              onSave={(v) => patchPost({ dataPublicacao: v ? new Date(v).toISOString() : null })}
              size="sm"
            />
            <InlineField
              type="text"
              label="Pilar"
              value={post.pilar ?? ""}
              onSave={(v) => patchPost({ pilar: v || null })}
              placeholder="Educacional, vendas, bastidor..."
              size="sm"
            />
            {clientes && clientes.length > 0 && (
              <InlineField
                type="select"
                label="Cliente"
                value={post.cliente?.id ?? ""}
                options={[{ value: "", label: "—" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
                onSave={(v) => patchPost({ clienteId: v || null })}
                size="sm"
                className="col-span-2"
              />
            )}
          </div>

          {/* Tabs: Copy | Artes | Hashtags+CTA | Produção | Comentários do cliente */}
          <Tabs defaultValue="copy" className="w-full">
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="copy">Copy / Legenda</TabsTrigger>
              <TabsTrigger value="artes">Artes / Anexos</TabsTrigger>
              <TabsTrigger value="meta">Hashtags + CTA</TabsTrigger>
              <TabsTrigger value="producao">Notas de produção</TabsTrigger>
              {post.comentarios && post.comentarios.length > 0 && (
                <TabsTrigger value="comentarios">
                  Comentários do cliente ({post.comentarios.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="copy" className="mt-4">
              {/* Textarea simples — o editor rico (BlockNote/ProseMirror) está
                  crashando no BlockNote 0.21 com `Invalid array passed to
                  renderSpec`. Pra desbloquear edição, mudamos pra texto puro.
                  Conteúdo legado em JSON é convertido pra texto na exibição,
                  e novos saves vão como string plana (Markdown leve permitido
                  — quebra de linha, emojis, hashtags). Cliente vê igual. */}
              <Textarea
                key={`legenda-${postId}`}
                defaultValue={blocknoteToText(post.legenda)}
                rows={12}
                placeholder="Copy/legenda do post — texto puro, emojis, quebras de linha. Cliente vê isso no portal pra aprovar."
                onChange={(e) => salvarLegenda(e.target.value)}
                className="font-mono text-[12.5px] leading-relaxed"
              />
              <p className="text-[10.5px] text-muted-foreground/70 mt-1.5">
                Salvamento automático (~1s após parar de digitar). Cliente vê este texto no portal.
              </p>
            </TabsContent>

            <TabsContent value="artes" className="mt-4">
              <PostArquivosEditor postId={postId} />
            </TabsContent>

            <TabsContent value="meta" className="mt-4 space-y-4">
              <HashtagsField
                value={post.hashtags}
                onSave={(tags) => patchPost({ hashtags: tags })}
              />
              <div className="space-y-1.5">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  CTA (chamada pra ação)
                </div>
                <Input
                  key={`cta-${postId}`}
                  defaultValue={post.cta ?? ""}
                  placeholder="Ex: Vem nos visitar — Andradas 1044"
                  onChange={(e) => salvarCta(e.target.value || null)}
                  onBlur={(e) => {
                    if (e.target.value !== post.cta) patchPost({ cta: e.target.value || null });
                  }}
                />
                <p className="text-[10.5px] text-muted-foreground/70">
                  Texto curto, destacado no portal do cliente.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="producao" className="mt-4 space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Notas de produção (interno — cliente NÃO vê)
              </div>
              <Textarea
                key={`obs-${postId}`}
                defaultValue={post.observacoesProducao ?? ""}
                rows={6}
                placeholder="Música de fundo, estilo de arte, referências, instruções pro designer..."
                onChange={(e) => salvarObservacoes(e.target.value || null)}
                onBlur={(e) => {
                  if (e.target.value !== post.observacoesProducao) {
                    patchPost({ observacoesProducao: e.target.value || null });
                  }
                }}
              />
              <p className="text-[10.5px] text-muted-foreground/70">
                Anotações internas — não aparecem no portal. Use pra alinhar com a equipe de design.
              </p>
            </TabsContent>

            {post.comentarios && post.comentarios.length > 0 && (
              <TabsContent value="comentarios" className="mt-4 space-y-2">
                {post.comentarios.map((c) => (
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

          <BacklinksPanel type="POST" id={postId} hideWhenEmpty title="Mencionado em" />
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


/**
 * Editor de hashtags como chips. Type-ahead simples: digita e Enter/vírgula
 * adiciona. Backspace em campo vazio remove última.
 */
function HashtagsField({
  value,
  onSave,
}: {
  value: string[];
  onSave: (tags: string[]) => void;
}) {
  const [tags, setTags] = useState<string[]>(value);
  const [input, setInput] = useState("");

  useEffect(() => {
    setTags(value);
  }, [value]);

  function commit(novas: string[]) {
    setTags(novas);
    onSave(novas);
  }

  function adicionar(raw: string) {
    const limpa = raw
      .replace(/^#+/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!limpa) return;
    if (tags.includes(limpa)) return;
    commit([...tags, limpa]);
    setInput("");
  }

  function remover(t: string) {
    commit(tags.filter((x) => x !== t));
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
        <Hash className="h-3 w-3" /> Hashtags
      </div>
      <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-border bg-background/40 min-h-[40px]">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-mono"
          >
            #{t}
            <button onClick={() => remover(t)} className="hover:text-destructive transition">
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              adicionar(input);
            } else if (e.key === "Backspace" && !input && tags.length > 0) {
              remover(tags[tags.length - 1]);
            }
          }}
          onBlur={() => input && adicionar(input)}
          placeholder={tags.length === 0 ? "Digite tag e Enter (ex: galeriachaves)" : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-[12px]"
        />
      </div>
      <p className="text-[10.5px] text-muted-foreground/70">
        Sem o # — sistema adiciona. Enter ou vírgula pra confirmar. Cliente vê no portal.
      </p>
    </div>
  );
}
