"use client";
/**
 * database-relacao.tsx — suporte ao tipo de propriedade RELACAO (link pra
 * outro database, estilo Notion).
 *
 * Problema: uma coluna RELACAO guarda `string[]` de ids de linhas do database
 * ALVO; pra renderizar os chips precisamos do TÍTULO de cada linha alvo. Se
 * cada célula buscasse o alvo sozinha, seria 1 fetch por célula (N×N). Aqui
 * centralizamos:
 *
 *  - CACHE module-level por `databaseAlvoId` (promise + resultado). A 1ª célula
 *    que precisa de um alvo dispara o fetch; todas as outras (mesma coluna ou
 *    colunas diferentes apontando pro mesmo alvo) reusam.
 *  - <RelacaoProvider> no topo do DatabaseClient mantém um "epoch" pra forçar
 *    re-render quando um alvo termina de carregar / é invalidado.
 *  - useRelacaoAlvo(databaseAlvoId) → { rows, tituloDe, loading, error }.
 *  - lista de databases (pro Select de configuração) também cacheada 1x.
 *
 * Só toca a API existente: GET /api/databases (lista) e GET /api/databases/[id]
 * (full). ZERO <style jsx>.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tituloDaRow, type DatabaseFull, type DbRow } from "@/components/database-cells";

// ─────────────────────────────────────────────────────────────────────
// Tipos leves
// ─────────────────────────────────────────────────────────────────────
/** Item da lista de databases (GET /api/databases). */
export type DatabaseLite = {
  id: string;
  nome: string;
  icone: string | null;
};

/** Linha do alvo já com título pré-computado (pra busca + chip). */
export type RelacaoRow = { id: string; titulo: string };

type AlvoEstado = {
  status: "loading" | "ok" | "erro";
  rows: RelacaoRow[];
  byId: Map<string, string>;
};

// ─────────────────────────────────────────────────────────────────────
// Cache module-level (sobrevive a remount de célula; 1 fetch por alvo)
// ─────────────────────────────────────────────────────────────────────
const alvoCache = new Map<string, AlvoEstado>();
const alvoPromessas = new Map<string, Promise<void>>();

/** Lista de databases (Select de config) — cacheada 1x. */
let listaCache: DatabaseLite[] | null = null;
let listaPromessa: Promise<DatabaseLite[]> | null = null;

/** Assinantes (providers montados) avisados quando o cache muda. */
const listeners = new Set<() => void>();
function notificar() {
  for (const l of listeners) l();
}

function computarRows(db: DatabaseFull): RelacaoRow[] {
  const props = db.propriedades ?? [];
  const linhas: DbRow[] = db.linhas ?? [];
  return linhas.map((r) => ({ id: r.id, titulo: tituloDaRow(props, r) }));
}

/** Garante (ou dispara) o carregamento de um alvo. Idempotente. */
function carregarAlvo(databaseAlvoId: string): void {
  if (alvoCache.has(databaseAlvoId) || alvoPromessas.has(databaseAlvoId)) return;
  alvoCache.set(databaseAlvoId, { status: "loading", rows: [], byId: new Map() });
  const p = (async () => {
    try {
      const db: DatabaseFull = await api(`/api/databases/${databaseAlvoId}`, "GET");
      const rows = computarRows(db);
      alvoCache.set(databaseAlvoId, {
        status: "ok",
        rows,
        byId: new Map(rows.map((r) => [r.id, r.titulo])),
      });
    } catch {
      alvoCache.set(databaseAlvoId, { status: "erro", rows: [], byId: new Map() });
    } finally {
      alvoPromessas.delete(databaseAlvoId);
      notificar();
    }
  })();
  alvoPromessas.set(databaseAlvoId, p);
  notificar();
}

/**
 * Invalida o cache de um alvo (após editar linhas dele, p.ex.) forçando refetch
 * no próximo uso. Exportado caso queira atualizar títulos sob demanda.
 */
export function invalidarRelacaoAlvo(databaseAlvoId: string): void {
  alvoCache.delete(databaseAlvoId);
  alvoPromessas.delete(databaseAlvoId);
  notificar();
}

/** Carrega a lista de databases (pro Select de configuração). */
async function carregarLista(): Promise<DatabaseLite[]> {
  if (listaCache) return listaCache;
  if (!listaPromessa) {
    listaPromessa = api("/api/databases", "GET")
      .then((arr: unknown) => {
        const lista: DatabaseLite[] = Array.isArray(arr)
          ? arr.map((d) => {
              const o = (d ?? {}) as Record<string, unknown>;
              return {
                id: String(o.id ?? ""),
                nome: String(o.nome ?? "Sem título"),
                icone: typeof o.icone === "string" ? o.icone : null,
              };
            })
          : [];
        listaCache = lista;
        return lista;
      })
      .catch(() => {
        listaCache = [];
        return [] as DatabaseLite[];
      })
      .finally(() => {
        listaPromessa = null;
        notificar();
      });
  }
  return listaPromessa;
}

// ─────────────────────────────────────────────────────────────────────
// Provider — só mantém um contador pra re-render quando o cache muda
// ─────────────────────────────────────────────────────────────────────
const RelacaoContext = createContext<{ epoch: number } | null>(null);

export function RelacaoProvider({ children }: { children: React.ReactNode }) {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const fn = () => setEpoch((e) => e + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return <RelacaoContext.Provider value={{ epoch }}>{children}</RelacaoContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────
// Hooks consumidos pelas células / config
// ─────────────────────────────────────────────────────────────────────
/**
 * Estado do database ALVO (linhas + título). Dispara o fetch 1x (compartilhado)
 * e re-renderiza via epoch do provider quando concluir.
 */
export function useRelacaoAlvo(databaseAlvoId: string | undefined): {
  rows: RelacaoRow[];
  tituloDe: (id: string) => string | undefined;
  loading: boolean;
  erro: boolean;
} {
  // Assina o provider pra re-renderizar quando o cache mudar (epoch muda →
  // o valor do contexto muda → este hook re-renderiza e relê o cache).
  const ctx = useContext(RelacaoContext);
  void ctx?.epoch;

  useEffect(() => {
    if (databaseAlvoId) carregarAlvo(databaseAlvoId);
  }, [databaseAlvoId]);

  const estado = databaseAlvoId ? alvoCache.get(databaseAlvoId) : undefined;
  const tituloDe = useCallback(
    (id: string) => (databaseAlvoId ? alvoCache.get(databaseAlvoId)?.byId.get(id) : undefined),
    [databaseAlvoId]
  );

  return {
    rows: estado?.rows ?? [],
    tituloDe,
    loading: !databaseAlvoId ? false : !estado || estado.status === "loading",
    erro: estado?.status === "erro",
  };
}

/** Lista de databases pro Select de configuração da coluna RELACAO. */
export function useDatabasesLista(): { lista: DatabaseLite[]; loading: boolean } {
  const [, setTick] = useState(0);

  useEffect(() => {
    let vivo = true;
    if (!listaCache) {
      void carregarLista().then(() => {
        if (vivo) setTick((t) => t + 1);
      });
    }
    return () => {
      vivo = false;
    };
  }, []);

  return { lista: listaCache ?? [], loading: listaCache === null };
}
