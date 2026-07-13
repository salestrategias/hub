"use client";
/**
 * Portal v4 — aba CONTEÚDO (posts + anúncios num lugar só).
 *
 * A separação Calendário × Criativos era uma distinção interna (orgânico ×
 * tráfego pago) que o cliente não precisa entender: pra ele, tudo é
 * "conteúdo pra aprovar/acompanhar". Esta aba unifica:
 *
 *  - Fila "Esperando você" no topo (o que precisa de ação, primeiro)
 *  - Filtros por chip: Todos · Orgânico · Anúncios
 *  - View Lista (agrupada por mês) ↔ Calendário (grade, posts com data)
 *  - Cards unificados (ConteudoCard) com estados claros + thread
 *
 * Anúncios não têm data de publicação — na view Calendário eles ficam
 * numa seção própria abaixo da grade.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, CalendarDays, List, ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchPortal } from "@/lib/portal-fetch";
import {
  type ItemConteudo,
  type PostPortal,
  aguardandoCliente,
  statusUI,
  STATUS_LABEL_POST,
  AprovarDialog,
  PedirAjusteDialog,
} from "@/components/portal-conteudo-shared";
import { ConteudoCard } from "@/components/portal-conteudo-cards";

type Filtro = "todos" | "organico" | "anuncios";
type CalView = "lista" | "calendario";
const VIEW_STORAGE_KEY = "portal-conteudo-view";
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export type Permissoes = {
  verCalendario: boolean;
  verCriativos: boolean;
  podeAprovarPosts: boolean;
  podeAprovarCriativos: boolean;
  podeComentar: boolean;
  podeEnviarConteudo: boolean;
};

// ─── Helpers de data (grade usa data LOCAL, consistente com os cards) ──
function isoDia(data: string | Date): string {
  const d = typeof data === "string" ? new Date(data) : data;
  return isoLocal(d.getFullYear(), d.getMonth(), d.getDate());
}
function isoLocal(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
function rotuloMes(ano: number, mes: number): string {
  return new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function PortalConteudo({
  token,
  permissoes,
  onPendenciasMudaram,
  onAbrirRevisao,
}: {
  token: string;
  permissoes: Permissoes;
  /** Avisa o shell pra recarregar badges após aprovar/pedir ajuste. */
  onPendenciasMudaram?: () => void;
  /** Abre o Modo Revisão (fila item a item). */
  onAbrirRevisao?: () => void;
}) {
  const [posts, setPosts] = useState<PostPortal[]>([]);
  const [criativos, setCriativos] = useState<ItemConteudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [view, setView] = useState<CalView>("lista");
  const [aprovando, setAprovando] = useState<ItemConteudo | null>(null);
  const [pedindoAjuste, setPedindoAjuste] = useState<ItemConteudo | null>(null);

  // Restaura preferência de view.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(VIEW_STORAGE_KEY);
      if (salvo === "lista" || salvo === "calendario") setView(salvo);
    } catch {
      /* localStorage indisponível — mantém default */
    }
  }, []);

  function trocarView(v: CalView) {
    setView(v);
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
    void carregar();
    onPendenciasMudaram?.();
  }

  // ─── Merge + filtro ──────────────────────────────────────────────────
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

  if (loading) return <ConteudoSkeleton />;

  const temAlgo = posts.length > 0 || criativos.length > 0;
  const mostraFiltros = permissoes.verCalendario && permissoes.verCriativos && temAlgo;

  return (
    <div className="space-y-4">
      {/* Fila de pendências → CTA do Modo Revisão */}
      {pendentes.length > 0 && onAbrirRevisao && (
        <button
          type="button"
          onClick={onAbrirRevisao}
          className="touch-feedback w-full rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex items-center gap-3 text-left hover:bg-primary/10 transition-colors"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-semibold leading-tight">
              {pendentes.length === 1
                ? "1 conteúdo esperando você"
                : `${pendentes.length} conteúdos esperando você`}
            </span>
            <span className="block text-[12px] text-muted-foreground leading-snug">
              Revise um por um, sem procurar na lista
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground">
            Revisar
          </span>
        </button>
      )}

      {/* Filtros + toggle de view */}
      {temAlgo && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {mostraFiltros ? (
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
                  className={`touch-feedback rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors ${
                    filtro === f.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => trocarView("lista")}
              aria-pressed={view === "lista"}
              className={`touch-feedback flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                view === "lista"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => trocarView("calendario")}
              aria-pressed={view === "calendario"}
              className={`touch-feedback flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                view === "calendario"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendário
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      {!temAlgo ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {erro ? "Não conseguimos carregar seu conteúdo." : "Nenhum conteúdo pra mostrar agora."}
            </p>
            {erro ? (
              <Button variant="outline" size="sm" onClick={() => void carregar()} className="touch-feedback">
                Tentar de novo
              </Button>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">
                Quando a SAL produzir conteúdo novo pra aprovação, aparece aqui.
              </p>
            )}
          </CardContent>
        </Card>
      ) : view === "calendario" ? (
        <ConteudoGrade
          itens={itens}
          renderCard={(i) => (
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
          )}
        />
      ) : (
        <ConteudoLista
          itens={itens}
          renderCard={(i) => (
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
          )}
        />
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

// ─── Lista agrupada: pendentes primeiro, depois por mês ────────────────
function ConteudoLista({
  itens,
  renderCard,
}: {
  itens: ItemConteudo[];
  renderCard: (i: ItemConteudo) => React.ReactNode;
}) {
  const pendentes = itens.filter(aguardandoCliente);
  const resto = itens.filter((i) => !aguardandoCliente(i));

  // Agrupa o resto por mês (posts pela dataPublicacao; criativos por updatedAt).
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
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Esperando você ({pendentes.length})
          </h2>
          <div className="space-y-2">{pendentes.map(renderCard)}</div>
        </section>
      )}
      {Array.from(grupos.entries()).map(([mes, doMes]) => (
        <section key={mes} className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground capitalize">
            {mes}
          </h2>
          <div className="space-y-2">{doMes.map(renderCard)}</div>
        </section>
      ))}
    </div>
  );
}

// ─── Grade mensal (posts com data) + seção de anúncios ─────────────────
function ConteudoGrade({
  itens,
  renderCard,
}: {
  itens: ItemConteudo[];
  renderCard: (i: ItemConteudo) => React.ReactNode;
}) {
  const posts = itens.filter((i): i is PostPortal => i.kind === "post");
  const criativos = itens.filter((i) => i.kind === "criativo");

  const porDia = useMemo(() => {
    const m = new Map<string, PostPortal[]>();
    for (const p of posts) {
      const k = isoDia(p.dataPublicacao);
      const arr = m.get(k);
      if (arr) arr.push(p);
      else m.set(k, [p]);
    }
    return m;
  }, [posts]);

  const hoje = new Date();
  const hojeIso = isoLocal(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const inicio = useMemo(() => {
    const datas = posts.map((p) => p.dataPublicacao).sort();
    const alvo = datas.find((d) => isoDia(d) >= hojeIso) ?? datas[0];
    if (!alvo) return { ano: hoje.getFullYear(), mes: hoje.getMonth() };
    const d = new Date(alvo);
    return { ano: d.getFullYear(), mes: d.getMonth() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const [cursor, setCursor] = useState<{ ano: number; mes: number }>(inicio);
  const [diaSel, setDiaSel] = useState<string | null>(null);

  function irMes(delta: number) {
    setDiaSel(null);
    setCursor((c) => {
      const d = new Date(c.ano, c.mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }
  function irHoje() {
    setCursor({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
    setDiaSel(porDia.has(hojeIso) ? hojeIso : null);
  }

  const primeiroDiaSemana = new Date(cursor.ano, cursor.mes, 1).getDay();
  const diasNoMes = new Date(cursor.ano, cursor.mes + 1, 0).getDate();
  const totalCelulas = Math.ceil((primeiroDiaSemana + diasNoMes) / 7) * 7;
  type Celula = { iso: string; dia: number; doMes: boolean };
  const celulas: Celula[] = [];
  for (let i = 0; i < totalCelulas; i++) {
    const offset = i - primeiroDiaSemana;
    const d = new Date(cursor.ano, cursor.mes, 1 + offset);
    celulas.push({
      iso: isoLocal(d.getFullYear(), d.getMonth(), d.getDate()),
      dia: d.getDate(),
      doMes: d.getMonth() === cursor.mes,
    });
  }

  const postsDoDia = diaSel ? porDia.get(diaSel) ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-display text-base font-semibold capitalize truncate">
            {rotuloMes(cursor.ano, cursor.mes)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => irMes(-1)}
            className="touch-feedback h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={irHoje}
            className="touch-feedback h-8 px-3 flex items-center rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => irMes(1)}
            className="touch-feedback h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="px-1 py-1.5 text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celulas.map((cel) => (
            <DiaCelula
              key={cel.iso}
              dia={cel.dia}
              doMes={cel.doMes}
              ehHoje={cel.iso === hojeIso}
              selecionado={cel.iso === diaSel}
              posts={porDia.get(cel.iso) ?? []}
              onSelecionar={() => setDiaSel((atual) => (atual === cel.iso ? null : cel.iso))}
            />
          ))}
        </div>
      </div>

      {/* Legenda de status */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
        {Object.entries(STATUS_LABEL_POST).map(([st, label]) => (
          <span key={st} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${statusUI(st).dot}`} />
            {label}
          </span>
        ))}
      </div>

      {diaSel && (
        <section className="space-y-2 pt-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {new Date(diaSel + "T00:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
            {postsDoDia.length > 0 ? ` · ${postsDoDia.length}` : ""}
          </h2>
          {postsDoDia.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-[12px] text-muted-foreground">
                Nenhum conteúdo neste dia.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">{postsDoDia.map(renderCard)}</div>
          )}
        </section>
      )}

      {/* Anúncios não têm data — seção própria abaixo da grade */}
      {criativos.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Anúncios ({criativos.length})
          </h2>
          <div className="space-y-2">{criativos.map(renderCard)}</div>
        </section>
      )}
    </div>
  );
}

function DiaCelula({
  dia,
  doMes,
  ehHoje,
  selecionado,
  posts,
  onSelecionar,
}: {
  dia: number;
  doMes: boolean;
  ehHoje: boolean;
  selecionado: boolean;
  posts: PostPortal[];
  onSelecionar: () => void;
}) {
  const temPosts = posts.length > 0;
  return (
    <button
      type="button"
      onClick={onSelecionar}
      aria-label={`${dia} — ${temPosts ? `${posts.length} conteúdo(s)` : "sem conteúdo"}`}
      aria-pressed={selecionado}
      className={`touch-feedback group/dia relative min-h-[64px] sm:min-h-[88px] border-b border-r border-border p-1 text-left transition-colors [&:nth-child(7n)]:border-r-0 ${
        doMes ? "bg-background" : "bg-muted/20"
      } ${selecionado ? "ring-2 ring-inset ring-primary/60 bg-primary/5" : "hover:bg-muted/40"}`}
    >
      <div className="flex items-center justify-center sm:justify-start px-0.5 pt-0.5">
        <span
          className={`text-[12px] tabular-nums ${
            ehHoje
              ? "h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
              : doMes
                ? "text-foreground/80"
                : "text-muted-foreground/40"
          }`}
        >
          {dia}
        </span>
      </div>

      {temPosts && (
        <div className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
          {posts.slice(0, 4).map((p) => (
            <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${statusUI(p.status).dot}`} />
          ))}
          {posts.length > 4 && (
            <span className="text-[8px] leading-none text-muted-foreground">+{posts.length - 4}</span>
          )}
        </div>
      )}

      {temPosts && (
        <div className="mt-1 hidden sm:block space-y-1">
          {posts.slice(0, 3).map((p) => (
            <span
              key={p.id}
              className={`block w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${statusUI(p.status).chip}`}
              title={p.titulo}
            >
              {p.titulo}
            </span>
          ))}
          {posts.length > 3 && (
            <span className="block px-1.5 text-[10px] text-muted-foreground">
              +{posts.length - 3} mais
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function ConteudoSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="flex justify-between">
        <Skeleton className="h-8 w-52 rounded-full" />
        <Skeleton className="h-8 w-44" />
      </div>
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-1.5">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
