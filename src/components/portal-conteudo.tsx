"use client";
/**
 * Conteúdo v5 — posts + anúncios num lugar só, com a vista FEED.
 *
 * Vistas (padrão do protótipo aprovado):
 *  - FEED: grade 3×3 estilo perfil do Instagram — "é assim que seu feed
 *    vai ficar". Capa = 1ª imagem do item (ou gradiente decorativo),
 *    bolinha de status no canto. Agrupada por mês; anúncios em seção
 *    própria (não têm data de publicação). Tocar abre o item num sheet
 *    com o card completo (aprovar/ajustar/thread).
 *  - LISTA: cards completos, pendentes primeiro.
 *
 * A grade mensal de calendário do v4 saiu — o feed comunica melhor pro
 * cliente de social e a agenda vive na strip "Sua semana" do Início.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { fetchPortal } from "@/lib/portal-fetch";
import { gradiente } from "@/components/portal-inicio";
import {
  type ItemConteudo,
  type PostPortal,
  aguardandoCliente,
  estadoAprovacao,
  AprovarDialog,
  PedirAjusteDialog,
} from "@/components/portal-conteudo-shared";
import { ConteudoCard } from "@/components/portal-conteudo-cards";

type Filtro = "todos" | "organico" | "anuncios";
type Vista = "feed" | "lista";
const VIEW_STORAGE_KEY = "portal-v5-view";

export type Permissoes = {
  verCalendario: boolean;
  verCriativos: boolean;
  podeAprovarPosts: boolean;
  podeAprovarCriativos: boolean;
  podeComentar: boolean;
  podeEnviarConteudo: boolean;
};

/** Cor da bolinha de status na grade (3 estados que o cliente entende). */
function dotDoItem(item: ItemConteudo): string {
  const estado = estadoAprovacao(item);
  if (estado === "aguardando_voce") return "#F5A623"; // âmbar — bola com você
  if (estado === "com_a_sal") return "#3AA9E8"; // céu — em produção na SAL
  if (item.status === "RECUSADO") return "#F43F5E";
  if (item.status === "DESIGN_PRONTO" || item.status === "AGENDADO" || item.status === "PAUSADO")
    return "#3AA9E8";
  return "#21C07A"; // aprovado / publicado / no ar
}

/** Capa do item: 1ª imagem, senão gradiente decorativo estável. */
function capaDoItem(item: ItemConteudo, idx: number): { img?: string; grad?: string } {
  const img = item.arquivos.find((a) => a.tipo === "IMAGEM");
  if (img) return { img: img.url };
  return { grad: gradiente(idx) };
}

export function PortalConteudo({
  token,
  corMarca,
  permissoes,
  onPendenciasMudaram,
  onAbrirRevisao,
}: {
  token: string;
  corMarca: string;
  permissoes: Permissoes;
  onPendenciasMudaram?: () => void;
  onAbrirRevisao?: () => void;
}) {
  const [posts, setPosts] = useState<PostPortal[]>([]);
  const [criativos, setCriativos] = useState<ItemConteudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [vista, setVista] = useState<Vista>("feed");
  const [aberto, setAberto] = useState<ItemConteudo | null>(null);
  const [aprovando, setAprovando] = useState<ItemConteudo | null>(null);
  const [pedindoAjuste, setPedindoAjuste] = useState<ItemConteudo | null>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(VIEW_STORAGE_KEY);
      if (salvo === "feed" || salvo === "lista") setVista(salvo);
    } catch {
      /* mantém default */
    }
  }, []);

  function trocarVista(v: Vista) {
    setVista(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* ignora */
    }
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const [resPosts, resCriativos] = await Promise.all([
        permissoes.verCalendario
          ? fetchPortal(`/api/p/cliente/${token}/calendario`)
          : Promise.resolve(null),
        permissoes.verCriativos
          ? fetchPortal(`/api/p/cliente/${token}/criativos`)
          : Promise.resolve(null),
      ]);
      let falhou = false;
      if (resPosts) {
        const data = await resPosts.json().catch(() => null);
        if (resPosts.ok && Array.isArray(data)) {
          setPosts(data.map((p) => ({ ...p, kind: "post" as const })));
        } else falhou = true;
      }
      if (resCriativos) {
        const data = await resCriativos.json().catch(() => null);
        if (resCriativos.ok && Array.isArray(data)) {
          setCriativos(data.map((c) => ({ ...c, kind: "criativo" as const })));
        } else falhou = true;
      }
      setErro(falhou);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, [token, permissoes.verCalendario, permissoes.verCriativos]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function aposAcao() {
    setAprovando(null);
    setPedindoAjuste(null);
    setAberto(null);
    void carregar();
    onPendenciasMudaram?.();
  }

  const itens = useMemo<ItemConteudo[]>(() => {
    const todos: ItemConteudo[] = [...posts, ...criativos];
    if (filtro === "organico") return todos.filter((i) => i.kind === "post");
    if (filtro === "anuncios") return todos.filter((i) => i.kind === "criativo");
    return todos;
  }, [posts, criativos, filtro]);

  const pendentes = useMemo(
    () =>
      itens.filter(
        (i) =>
          aguardandoCliente(i) &&
          (i.kind === "post" ? permissoes.podeAprovarPosts : permissoes.podeAprovarCriativos)
      ),
    [itens, permissoes.podeAprovarPosts, permissoes.podeAprovarCriativos]
  );

  const podeAprovarItem = useCallback(
    (i: ItemConteudo) =>
      i.kind === "post" ? permissoes.podeAprovarPosts : permissoes.podeAprovarCriativos,
    [permissoes.podeAprovarPosts, permissoes.podeAprovarCriativos]
  );

  const renderCard = useCallback(
    (i: ItemConteudo) => (
      <ConteudoCard
        key={`${i.kind}-${i.id}`}
        item={i}
        token={token}
        podeAprovar={podeAprovarItem(i)}
        podeComentar={permissoes.podeComentar}
        podeEnviar={permissoes.podeEnviarConteudo}
        onAprovar={setAprovando}
        onPedirAjuste={setPedindoAjuste}
        onAlterado={() => {
          void carregar();
          onPendenciasMudaram?.();
        }}
      />
    ),
    [token, podeAprovarItem, permissoes.podeComentar, permissoes.podeEnviarConteudo, carregar, onPendenciasMudaram]
  );

  if (loading) return <ConteudoSkeleton />;

  const temAlgo = posts.length > 0 || criativos.length > 0;
  const mostraFiltros = permissoes.verCalendario && permissoes.verCriativos && temAlgo;

  return (
    <div className="p5-screen space-y-4">
      <section className="pt-1">
        <h1 className="font-display text-[26px] font-extrabold tracking-tight leading-tight">Conteúdo</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">
          Tudo que a SAL preparou — orgânico e anúncios juntos.
        </p>
      </section>

      {/* CTA da fila de pendências */}
      {pendentes.length > 0 && onAbrirRevisao && (
        <button
          type="button"
          onClick={onAbrirRevisao}
          className="touch-feedback p5-card flex w-full items-center gap-3 bg-card p-4 text-left"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-white"
            style={{ background: corMarca }}
          >
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[14px] font-bold leading-tight">
              {pendentes.length === 1
                ? "1 conteúdo esperando você"
                : `${pendentes.length} conteúdos esperando você`}
            </span>
            <span className="block text-[12px] text-muted-foreground mt-0.5">
              revise um por um, sem procurar
            </span>
          </span>
          <span
            className="shrink-0 rounded-full px-4 py-2.5 text-[12px] font-extrabold text-white"
            style={{ background: corMarca }}
          >
            Revisar
          </span>
        </button>
      )}

      {/* Filtros + vista */}
      {temAlgo && (
        <div className="flex flex-wrap items-center gap-2">
          {mostraFiltros && (
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: "todos", label: "Tudo" },
                  { id: "organico", label: "Orgânico" },
                  { id: "anuncios", label: "Anúncios" },
                ] as { id: Filtro; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  aria-pressed={filtro === f.id}
                  className={`touch-feedback rounded-full px-3.5 py-2 text-[12px] font-bold transition-colors ${
                    filtro === f.id ? "text-white" : "p5-card bg-card text-muted-foreground"
                  }`}
                  style={filtro === f.id ? { background: corMarca } : undefined}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="p5-card ml-auto flex gap-1 rounded-full bg-card p-1">
            <button
              type="button"
              onClick={() => trocarVista("feed")}
              aria-pressed={vista === "feed"}
              className={`touch-feedback rounded-full px-3.5 py-1.5 text-[11.5px] font-bold ${
                vista === "feed" ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              Feed
            </button>
            <button
              type="button"
              onClick={() => trocarVista("lista")}
              aria-pressed={vista === "lista"}
              className={`touch-feedback rounded-full px-3.5 py-1.5 text-[11.5px] font-bold ${
                vista === "lista" ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              Lista
            </button>
          </div>
        </div>
      )}

      {!temAlgo ? (
        <Card className="p5-card">
          <CardContent className="p-8 text-center space-y-2">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {erro ? "Não conseguimos carregar seu conteúdo." : "Nenhum conteúdo pra mostrar agora."}
            </p>
            {erro ? (
              <Button variant="outline" size="sm" onClick={() => void carregar()} className="touch-feedback">
                Tentar de novo
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">
                Quando a SAL produzir conteúdo novo, aparece aqui.
              </p>
            )}
          </CardContent>
        </Card>
      ) : vista === "feed" ? (
        <FeedGrid itens={itens} onAbrir={setAberto} />
      ) : (
        <ListaCards itens={itens} renderCard={renderCard} />
      )}

      {/* Sheet do item (tocar na grade) */}
      {aberto && (
        <Dialog open onOpenChange={(o) => !o && setAberto(null)}>
          <DialogContent className="dialog-bottom-sheet max-h-[90dvh] overflow-y-auto p-0 sm:max-w-lg sm:p-0">
            <DialogTitle className="sr-only">{aberto.titulo}</DialogTitle>
            <div className="p-1.5 sm:p-2">
              {renderCard(aberto)}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {aprovando && (
        <AprovarDialog
          token={token}
          item={aprovando}
          podeComentar={permissoes.podeComentar}
          onClose={() => setAprovando(null)}
          onSuccess={aposAcao}
        />
      )}
      {pedindoAjuste && (
        <PedirAjusteDialog
          token={token}
          item={pedindoAjuste}
          onClose={() => setPedindoAjuste(null)}
          onSuccess={aposAcao}
        />
      )}
    </div>
  );
}

// ─── Vista FEED (grade Instagram) ────────────────────────────────────
function FeedGrid({
  itens,
  onAbrir,
}: {
  itens: ItemConteudo[];
  onAbrir: (i: ItemConteudo) => void;
}) {
  const posts = itens.filter((i): i is PostPortal => i.kind === "post");
  const criativos = itens.filter((i) => i.kind === "criativo");

  // Posts agrupados por mês, mais recente primeiro (feed de perfil).
  const grupos = new Map<string, PostPortal[]>();
  const ordenados = [...posts].sort((a, b) => b.dataPublicacao.localeCompare(a.dataPublicacao));
  for (const p of ordenados) {
    const chave = new Date(p.dataPublicacao).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    const arr = grupos.get(chave) ?? [];
    arr.push(p);
    grupos.set(chave, arr);
  }

  return (
    <div className="space-y-5">
      {posts.length > 0 && (
        <p className="px-0.5 text-[11.5px] text-muted-foreground">
          É assim que seu feed vai ficar 👇 · <b style={{ color: "#F5A623" }}>●</b> esperando você ·{" "}
          <b style={{ color: "#3AA9E8" }}>●</b> com a SAL / agendado · <b style={{ color: "#21C07A" }}>●</b>{" "}
          aprovado / no ar
        </p>
      )}

      {Array.from(grupos.entries()).map(([mes, doMes]) => (
        <section key={mes}>
          <h2 className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80 capitalize">
            {mes}
          </h2>
          <Grade itens={doMes} onAbrir={onAbrir} />
        </section>
      ))}

      {criativos.length > 0 && (
        <section>
          <h2 className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80">
            Anúncios ({criativos.length})
          </h2>
          <Grade itens={criativos} onAbrir={onAbrir} />
        </section>
      )}
    </div>
  );
}

function Grade({
  itens,
  onAbrir,
}: {
  itens: ItemConteudo[];
  onAbrir: (i: ItemConteudo) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-[18px]">
      {itens.map((item, idx) => {
        const capa = capaDoItem(item, idx);
        return (
          <button
            key={`${item.kind}-${item.id}`}
            type="button"
            onClick={() => onAbrir(item)}
            aria-label={item.titulo}
            className="touch-feedback relative aspect-square bg-muted"
            style={capa.grad ? { background: capa.grad } : undefined}
          >
            {capa.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capa.img}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span
              className="absolute right-1.5 top-1.5 h-[9px] w-[9px] rounded-full shadow-[0_0_0_2px_rgba(255,255,255,.85)]"
              style={{ background: dotDoItem(item) }}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Vista LISTA ─────────────────────────────────────────────────────
function ListaCards({
  itens,
  renderCard,
}: {
  itens: ItemConteudo[];
  renderCard: (i: ItemConteudo) => React.ReactNode;
}) {
  const pendentes = itens.filter(aguardandoCliente);
  const resto = itens.filter((i) => !aguardandoCliente(i));

  const grupos = new Map<string, ItemConteudo[]>();
  for (const i of resto) {
    const d = new Date(i.kind === "post" ? (i as PostPortal).dataPublicacao : i.updatedAt);
    const chave = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const arr = grupos.get(chave) ?? [];
    arr.push(i);
    grupos.set(chave, arr);
  }

  return (
    <div className="space-y-5">
      {pendentes.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="px-0.5 text-[11px] font-extrabold uppercase tracking-[.09em]" style={{ color: "#B47800" }}>
            Esperando você ({pendentes.length})
          </h2>
          <div className="space-y-3">{pendentes.map(renderCard)}</div>
        </section>
      )}
      {Array.from(grupos.entries()).map(([mes, doMes]) => (
        <section key={mes} className="space-y-2.5">
          <h2 className="px-0.5 text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80 capitalize">
            {mes}
          </h2>
          <div className="space-y-3">{doMes.map(renderCard)}</div>
        </section>
      ))}
    </div>
  );
}

function ConteudoSkeleton() {
  return (
    <div className="space-y-4">
      <div className="pt-1 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-[76px] w-full rounded-[22px]" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-44 rounded-full" />
        <Skeleton className="ml-auto h-9 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-[18px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none" />
        ))}
      </div>
    </div>
  );
}
