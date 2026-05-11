"use client";
/**
 * Card de "Integrações Google Sheets" — aparece em cada página de
 * relatório (redes/seo/trafego), filtrado por cliente atual + fonte.
 *
 * Lista todas as integrações salvas e oferece botão "Sincronizar
 * agora" pra cada uma. A sync baixa de novo, mostra preview no
 * mesmo dialog usado pra import manual, e Marcelo confirma.
 *
 * Quando vazio: card colapsado (não polui a UI dos relatórios que
 * ainda não usam integração). Marcelo cria via dialog principal de
 * import marcando "salvar como integração".
 */
import { useEffect, useState } from "react";
import {
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { ParsedCsv } from "@/lib/csv-parser";

type Integracao = {
  id: string;
  clienteId: string;
  fonte: "REDES" | "SEO" | "TRAFEGO";
  sheetUrl: string;
  rotulo: string | null;
  ultimaSync: string | null;
  totalLinhas: number;
  ultimoErro: string | null;
  ativo: boolean;
  cliente: { id: string; nome: string };
  updatedAt: string;
};

export function IntegracoesSheetsCard({
  clienteId,
  fonte,
  onSyncPreview,
}: {
  clienteId: string;
  fonte: "REDES" | "SEO" | "TRAFEGO";
  /**
   * Callback chamado quando Marcelo clica "Sincronizar agora" e o sync
   * baixa a planilha. Pai recebe o preview pra renderizar no dialog
   * compartilhado e confirmar a importação.
   */
  onSyncPreview: (preview: {
    integracaoId: string;
    parsed: ParsedCsv;
  }) => void;
}) {
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function recarregar() {
    if (!clienteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integracoes-sheets?clienteId=${clienteId}&fonte=${fonte}`);
      const data = await res.json();
      if (Array.isArray(data)) setIntegracoes(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, fonte]);

  async function sincronizar(integ: Integracao) {
    setSyncingId(integ.id);
    try {
      const res = await fetch(`/api/integracoes-sheets/${integ.id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao sincronizar");
        recarregar(); // ultimoErro atualizado
        return;
      }
      onSyncPreview({
        integracaoId: integ.id,
        parsed: {
          headers: data.headers,
          headersNorm: data.headersNorm,
          rows: data.rows,
          delimiter: data.delimiter,
          totalLinhas: data.totalLinhas,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSyncingId(null);
    }
  }

  async function excluir(id: string, rotulo: string | null) {
    if (!confirm(`Excluir integração "${rotulo ?? "sem rótulo"}"?`)) return;
    const res = await fetch(`/api/integracoes-sheets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    toast.success("Integração removida");
    recarregar();
  }

  // Não renderiza nada se não tem integrações — mantém UI dos relatórios limpa.
  if (!loading && integracoes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <LinkIcon className="h-3.5 w-3.5" />
          Integrações Google Sheets
          <Badge variant="outline" className="ml-1 text-[10px]">
            {integracoes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {integracoes.map((integ) => {
          const ultimaSync = integ.ultimaSync ? new Date(integ.ultimaSync) : null;
          return (
            <div
              key={integ.id}
              className="rounded-md border border-border bg-card/30 px-3 py-2 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {integ.rotulo || "Sem rótulo"}
                  </span>
                  {ultimaSync && (
                    <Badge variant="muted" className="text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      {ultimaSync.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {integ.totalLinhas > 0 && ` · ${integ.totalLinhas} linha(s)`}
                    </Badge>
                  )}
                  {integ.ultimoErro && (
                    <Badge variant="destructive" className="text-[10px]" title={integ.ultimoErro}>
                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                      Erro
                    </Badge>
                  )}
                </div>
                <a
                  href={integ.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-muted-foreground truncate block hover:text-primary"
                >
                  {integ.sheetUrl}
                </a>
                {integ.ultimoErro && (
                  <div className="text-[10.5px] text-destructive mt-0.5">{integ.ultimoErro}</div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sincronizar(integ)}
                  disabled={syncingId === integ.id}
                >
                  {syncingId === integ.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Sincronizar
                </Button>
                <Button size="icon" variant="ghost" asChild>
                  <a href={integ.sheetUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => excluir(integ.id, integ.rotulo)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
