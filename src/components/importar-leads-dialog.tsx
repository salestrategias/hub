"use client";
/**
 * Dialog de importação em batch de Leads via CSV/TSV.
 *
 * Caso de uso principal: Marcelo exporta leads do Meta Lead Ads
 * (Gerenciador de Anúncios → Lead Center → CSV) e cola aqui pra
 * popular o pipeline com X leads de uma vez.
 *
 * Diferenças do <ImportarRelatorioDialog>:
 *  - Sem aba "Google Sheets" (Lead Ads não usa Sheets sync)
 *  - Tem opção de "modo dedup" (pular/atualizar/criar_sempre)
 *  - Tem campo "origem override" pra padronizar "Meta · Lead Ads · Q1/2026"
 *  - Resultado mostra criados/atualizados/pulados separados
 */
import { useState } from "react";
import { Loader2, Sparkles, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { parseCsv, type ParsedCsv } from "@/lib/csv-parser";

type Modo = "pular" | "atualizar" | "criar_sempre";

type ImportResult = {
  ok: boolean;
  totalLinhas: number;
  criados: number;
  atualizados: number;
  pulados: number;
  ignorados: number;
  erros: { linha: number; erro: string; raw: Record<string, string> }[];
  erroTotal: number;
};

export function ImportarLeadsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [origemOverride, setOrigemOverride] = useState("");
  const [modo, setModo] = useState<Modo>("pular");
  const [preview, setPreview] = useState<ParsedCsv | null>(null);
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetar() {
    setPreview(null);
    setResultado(null);
    setError(null);
    setCsvText("");
    setOrigemOverride("");
    setModo("pular");
  }

  function handleClose(o: boolean) {
    if (!o) resetar();
    onOpenChange(o);
  }

  function parsearLocal() {
    setError(null);
    try {
      const parsed = parseCsv(csvText);
      if (parsed.rows.length === 0) throw new Error("Nenhuma linha de dados encontrada");
      setPreview(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao parsear CSV");
    }
  }

  async function confirmarImport() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: preview.rows,
          origemOverride: origemOverride || null,
          modo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao importar");
      setResultado(data);
      if (data.criados + data.atualizados > 0) {
        toast.success(`${data.criados} criado(s), ${data.atualizados} atualizado(s)`);
        onImported();
      } else {
        toast.error("Nenhum lead foi importado — confira os erros");
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
            Importar leads em batch
          </DialogTitle>
          <DialogDescription>
            Cole o CSV exportado do Meta Lead Ads (Gerenciador → Lead Center → Baixar) ou de
            qualquer outra fonte. Sistema reconhece colunas e cria leads no pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Colunas reconhecidas: </span>
          <span className="font-mono">email, nome_completo, telefone, nome_da_empresa, campaign_name, platform, endereço, created_time</span>
        </div>

        {/* Step 1: input */}
        {!preview && !resultado && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cole o conteúdo do CSV (com cabeçalho)</Label>
              <Textarea
                rows={12}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`id,created_time,campaign_name,email,nome_completo,telefone,nome_da_empresa\n123,2026-01-15,Q1 Captação,joao@empresa.com,João Silva,11999991111,Empresa X`}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Aceita TAB, vírgula ou ponto-e-vírgula. Copia direto do Excel/Sheets também funciona.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={parsearLocal} disabled={!csvText.trim()}>
                Pré-visualizar
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: preview + config */}
        {preview && !resultado && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="success">{preview.totalLinhas} linha(s) detectada(s)</Badge>
              <Badge variant="outline">Delimitador: {preview.delimiter === "\t" ? "TAB" : preview.delimiter}</Badge>
              <Badge variant="outline">{preview.headers.length} coluna(s)</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origem (sobrescrever)</Label>
                <Input
                  value={origemOverride}
                  onChange={(e) => setOrigemOverride(e.target.value)}
                  placeholder='Ex: "Meta · Lead Ads Q1 2026"'
                />
                <p className="text-[10.5px] text-muted-foreground">
                  Se preenchido, todos os leads herdam essa origem. Senão, sistema monta automático.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email duplicado</Label>
                <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pular">Pular (preservar lead existente)</SelectItem>
                    <SelectItem value="atualizar">Atualizar campos vazios</SelectItem>
                    <SelectItem value="criar_sempre">Criar novo (permitir dup)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10.5px] text-muted-foreground">
                  Recomendado: <strong>Pular</strong> — preserva qualificação já feita.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border overflow-x-auto max-h-[280px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1.5 text-left font-medium border-b border-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 6).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/40">
                      {preview.headersNorm.map((k, ci) => (
                        <td key={ci} className="px-2 py-1 font-mono whitespace-nowrap max-w-[200px] truncate">
                          {String(row[k] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 6 && (
                <div className="px-2 py-1 text-[11px] text-muted-foreground text-center bg-muted/30">
                  + {preview.rows.length - 6} linha(s) ocultas — todas serão importadas
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: resultado */}
        {resultado && (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">
                  {resultado.criados} criado(s) · {resultado.atualizados} atualizado(s) · {resultado.pulados} pulado(s)
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

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          {!preview && !resultado && (
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          )}
          {preview && !resultado && (
            <>
              <Button variant="outline" onClick={() => { setPreview(null); setError(null); }}>
                Voltar
              </Button>
              <Button onClick={confirmarImport} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                Importar {preview.totalLinhas} lead(s)
              </Button>
            </>
          )}
          {resultado && <Button onClick={() => handleClose(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
