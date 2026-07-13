"use client";
/**
 * Tab Reuniões do Portal — read-only.
 * Lista de reuniões com resumo + action items.
 */
import { useCallback, useEffect, useState } from "react";
import { Mic, CheckSquare, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockRenderer } from "@/components/editor";
import { fetchPortal } from "@/lib/portal-fetch";

type Action = {
  id: string;
  texto: string;
  responsavel: string | null;
  prazo: string | null;
  concluido: boolean;
};

type Reuniao = {
  id: string;
  titulo: string;
  data: string;
  duracaoSeg: number | null;
  resumoIA: string | null;
  actionItems: Action[];
};

export function PortalReunioes({ token }: { token: string }) {
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro(false);
    fetchPortal(`/api/p/cliente/${token}/reunioes`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (r.ok && Array.isArray(d)) setReunioes(d);
        else setErro(true);
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <Skeleton className="h-4 flex-1 max-w-[60%]" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reunioes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <Mic className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {erro ? "Não conseguimos carregar suas reuniões." : "Nenhuma reunião registrada."}
          </p>
          {erro && (
            <Button variant="outline" size="sm" onClick={carregar} className="touch-feedback">
              Tentar de novo
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reunioes.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Mic className="h-3.5 w-3.5 text-primary" />
              <h3 className="font-display font-semibold text-sm flex-1 min-w-0 truncate">{r.titulo}</h3>
              <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                {new Date(r.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </span>
            </div>

            {r.resumoIA && (
              <div className="rounded-md bg-muted/30 border border-border p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Resumo
                </div>
                <div className="text-[12.5px] leading-relaxed">
                  <BlockRenderer value={r.resumoIA} maxBlocks={6} />
                </div>
              </div>
            )}

            {r.actionItems.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Ações combinadas ({r.actionItems.length})
                </div>
                <ul className="space-y-1.5">
                  {r.actionItems.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 text-[12.5px]">
                      {a.concluido ? (
                        <CheckSquare className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={a.concluido ? "line-through text-muted-foreground" : ""}>
                          {a.texto}
                        </div>
                        {(a.responsavel || a.prazo) && (
                          <div className="text-[10.5px] text-muted-foreground/70 mt-0.5">
                            {a.responsavel}{a.responsavel && a.prazo ? " · " : ""}{a.prazo}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
