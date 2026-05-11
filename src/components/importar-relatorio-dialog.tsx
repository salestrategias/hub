"use client";
/**
 * Dialog universal de importação de relatório.
 *
 * Duas abas:
 *  1. "Colar CSV/TSV" — textarea pra colar export direto do Excel/Sheets/
 *     Looker/Meta Ads/Google Ads. Sistema auto-detecta delimitador.
 *  2. "Google Sheets" — URL pública (qualquer pessoa com link → leitor).
 *     Sistema baixa via /export?format=csv. Opcionalmente salva como
 *     integração persistente pra Marcelo re-sincronizar depois.
 *
 * Fluxo comum:
 *   parse → preview (5 primeiras linhas) → user confirma → POST /import →
 *   mostra resultado (criadas/atualizadas/erros) → onImported() → fecha.
 */
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Link as LinkIcon, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { parseCsv, type ParsedCsv } from "@/lib/csv-parser";

type Fonte = "REDES" | "SEO" | "TRAFEGO";

type Preview = {
  parsed: ParsedCsv;
  origemUrl?: string; // se veio de Sheets
  integracaoId?: string;
};

type ImportResult = {
  ok: boolean;
  totalLinhas: number;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  erros: { linha: number; erro: string; raw: Record<string, string> }[];
  erroTotal: number;
};

const FONTE_LABELS: Record<Fonte, string> = {
  REDES: "Redes Sociais",
  SEO: "SEO",
  TRAFEGO: "Tráfego Pago",
};

const COLUNAS_ESPERADAS: Record<Fonte, string> = {
  REDES: "rede, ano, mês, seguidores, alcance, impressões, engajamento, posts, stories, reels",
  SEO: "ano, mês, posição média, cliques, impressões, CTR, keywords ranqueadas",
  TRAFEGO: "ano, mês, plataforma, nome, investimento, impressões, cliques, conversões, CPA, ROAS, CPM, CPC",
};

export function ImportarRelatorioDialog({
  open,
  onOpenChange,
  clienteId,
  fonte,
  onImported,
  initialPreview,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clienteId: string;
  fonte: Fonte;
  onImported: () => void;
  /**
   * Pre-fill do preview (atalho usado pelo IntegracoesSheetsCard quando
   * sincroniza uma integração existente — pula step 1 e abre direto na
   * confirmação).
   */
  initialPreview?: { integracaoId: string; parsed: ParsedCsv };
}) {
  const [aba, setAba] = useState<"csv" | "sheets">("csv");
  const [csvText, setCsvText] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [salvarIntegracao, setSalvarIntegracao] = useState(true);
  const [rotulo, setRotulo] = useState("");
  const [preview, setPreview] = useState<Preview | null>(initialPreview ?? null);
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync com initialPreview — quando o pai força o dialog a abrir já com
  // preview pronto (sincronização de integração existente via card).
  useEffect(() => {
    if (initialPreview && open) setPreview(initialPreview);
  }, [initialPreview, open]);

  function resetar() {
    setPreview(null);
    setResultado(null);
    setError(null);
    setCsvText("");
    setSheetUrl("");
    setRotulo("");
  }

  function handleClose(o: boolean) {
    if (!o) resetar();
    onOpenChange(o);
  }

  async function parsearCsvLocal() {
    setError(null);
    try {
      const parsed = parseCsv(csvText);
      if (parsed.rows.length === 0) throw new Error("Nenhuma linha de dados encontrada");
      setPreview({ parsed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao parsear CSV");
    }
  }

  async function baixarSheet() {
    setError(null);
    setLoading(true);
    try {
      let integracaoId: string | undefined;

      // Se Marcelo marcou "salvar pra sincronizar depois", criar integração primeiro
      if (salvarIntegracao) {
        const create = await fetch("/api/integracoes-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteId,
            fonte,
            sheetUrl,
            rotulo: rotulo || null,
            ativo: true,
          }),
        });
        const dataCreate = await create.json();
        if (!create.ok) throw new Error(dataCreate?.error ?? "Erro ao salvar integração");
        integracaoId = dataCreate.id;

        // Sync via integração (usa endpoint que atualiza ultimoErro automaticamente)
        const sync = await fetch(`/api/integracoes-sheets/${integracaoId}/sync`, { method: "POST" });
        const dataSync = await sync.json();
        if (!sync.ok) throw new Error(dataSync?.error ?? "Erro ao baixar planilha");

        setPreview({
          parsed: {
            headers: dataSync.headers,
            headersNorm: dataSync.headersNorm,
            rows: dataSync.rows,
            delimiter: dataSync.delimiter,
            totalLinhas: dataSync.totalLinhas,
          },
          origemUrl: sheetUrl,
          integracaoId,
        });
      } else {
        // Fluxo sem persistir integração: usa o sync direto via URL temporária
        // Como o endpoint atual sempre precisa de integração persistida, fazemos
        // download client-side via fetch público + parse local.
        // (Google Sheets export aceita CORS pra origens públicas)
        const res = await fetch("/api/integracoes-sheets/fetch-temp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao baixar planilha");
        setPreview({
          parsed: {
            headers: data.headers,
            headersNorm: data.headersNorm,
            rows: data.rows,
            delimiter: data.delimiter,
            totalLinhas: data.totalLinhas,
          },
          origemUrl: sheetUrl,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao baixar planilha");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarImport() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/relatorios/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          fonte,
          rows: preview.parsed.rows,
          integracaoId: preview.integracaoId ?? null,
          modo: "upsert",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao importar");
      setResultado(data);
      if (data.criadas + data.atualizadas > 0) {
        toast.success(`${data.criadas + data.atualizadas} linha(s) importada(s)`);
        onImported();
      } else {
        toast.error("Nenhuma linha foi importada — confira os erros");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Importar dados — {FONTE_LABELS[fonte]}
          </DialogTitle>
          <DialogDescription>
            Cole CSV/TSV de qualquer ferramenta (Meta Ads, Google Ads, Search Console, Instagram Insights, Looker)
            ou vincule uma planilha pública do Google Sheets. Sistema reconhece colunas automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* Hint de colunas */}
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Colunas reconhecidas: </span>
          <span className="font-mono">{COLUNAS_ESPERADAS[fonte]}</span>
        </div>

        {/* === Step 1: input === */}
        {!preview && !resultado && (
          <Tabs value={aba} onValueChange={(v) => setAba(v as "csv" | "sheets")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv">
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Colar CSV/TSV
              </TabsTrigger>
              <TabsTrigger value="sheets">
                <LinkIcon className="h-3.5 w-3.5 mr-1.5" /> Google Sheets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-2">
              <Label className="text-xs">Cole as células do Excel / Sheets / export CSV</Label>
              <Textarea
                rows={12}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`rede,ano,mes,seguidores,alcance,engajamento\nINSTAGRAM,2026,1,12500,45000,3200\nINSTAGRAM,2026,2,12780,48000,3500`}
                className="font-mono text-xs"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">
                  Aceita separadores `,` `;` ou TAB (cópia direta do Excel funciona).
                </span>
                <Button onClick={parsearCsvLocal} disabled={!csvText.trim()}>
                  Pré-visualizar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="sheets" className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">URL pública da planilha</Label>
                <Input
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                />
                <p className="text-[11px] text-muted-foreground">
                  No Sheets: <strong>Compartilhar → Qualquer pessoa com o link → Leitor</strong>. Sem isso o sistema não consegue acessar.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={salvarIntegracao}
                    onChange={(e) => setSalvarIntegracao(e.target.checked)}
                    className="accent-primary"
                  />
                  Salvar essa planilha como integração (permite sincronizar de novo depois sem colar URL)
                </Label>
                {salvarIntegracao && (
                  <Input
                    value={rotulo}
                    onChange={(e) => setRotulo(e.target.value)}
                    placeholder='Rótulo opcional, ex: "Meta Ads — 2026"'
                    className="mt-1"
                  />
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={baixarSheet} disabled={!sheetUrl.trim() || loading}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Baixar e pré-visualizar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* === Step 2: preview === */}
        {preview && !resultado && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="success">{preview.parsed.totalLinhas} linha(s) detectada(s)</Badge>
              <Badge variant="outline">Delimitador: {preview.parsed.delimiter === "\t" ? "TAB" : preview.parsed.delimiter}</Badge>
              <Badge variant="outline">{preview.parsed.headers.length} coluna(s)</Badge>
              {preview.integracaoId && <Badge variant="muted">Integração salva</Badge>}
            </div>

            <div className="rounded-md border border-border overflow-x-auto max-h-[340px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {preview.parsed.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1.5 text-left font-medium border-b border-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.parsed.rows.slice(0, 8).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/40">
                      {preview.parsed.headersNorm.map((k, ci) => (
                        <td key={ci} className="px-2 py-1 font-mono whitespace-nowrap">
                          {String(row[k] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.parsed.rows.length > 8 && (
                <div className="px-2 py-1 text-[11px] text-muted-foreground text-center bg-muted/30">
                  + {preview.parsed.rows.length - 8} linha(s) ocultas — todas serão importadas
                </div>
              )}
            </div>
          </div>
        )}

        {/* === Step 3: resultado === */}
        {resultado && (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">
                  {resultado.criadas} criada(s) · {resultado.atualizadas} atualizada(s)
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  De {resultado.totalLinhas} linha(s) processada(s).
                  {resultado.erroTotal > 0 && ` ${resultado.erroTotal} ignorada(s) por erro.`}
                </div>
              </div>
            </div>

            {resultado.erros.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Linhas ignoradas
                </div>
                <ul className="text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                  {resultado.erros.map((e, i) => (
                    <li key={i} className="font-mono">
                      <span className="text-muted-foreground">L{e.linha}:</span> {e.erro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* === Erro global === */}
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          {!preview && !resultado && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}
          {preview && !resultado && (
            <>
              <Button variant="outline" onClick={() => { setPreview(null); setError(null); }}>
                Voltar
              </Button>
              <Button onClick={confirmarImport} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Importar {preview.parsed.totalLinhas} linha(s)
              </Button>
            </>
          )}
          {resultado && (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
