"use client";
/**
 * Campos de resposta de briefing por tipo — COMPARTILHADO entre:
 *   - briefing-publico.tsx (cliente responde sem login, página /p e portal)
 *   - briefing-editor.tsx  (lado SAL pré-preenche/corrige na aba "Respostas")
 *
 * Renderiza cada pergunta pelo `tipo` (catálogo em src/lib/briefing.ts):
 *   TEXTO→input · PARAGRAFO→textarea · ESCOLHA→radios · CAIXAS→checkboxes
 *   (array) · LISTA→select · NUMERO→input number · DATA→input date ·
 *   LINK→input url · SIM_NAO→radio Sim/Não · UPLOAD→arquivo (imagem comprime
 *   pra dataURL; outros tipos viram dataURL com teto; fallback de LINK colado).
 *
 * Mobile-first: inputs h-11 / text-base no mobile, sem <style jsx>. Usa só
 * tokens (theme-aware), então serve tanto pro /p (claro) quanto pro editor.
 */
import { useRef, useState } from "react";
import { Loader2, Upload, Link2, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { BriefingPergunta } from "@/lib/briefing";
import { comprimirImagem, fileToDataURL } from "@/components/portal-enviar-conteudo";

export type Valor = string | string[];
export type Respostas = Record<string, Valor>;

// Teto pra dataURL de arquivo não-imagem (~4MB de binário → cabe no @db.Text).
export const MAX_ARQUIVO_BYTES = 4_000_000;

export const ERRO_RING = "border-destructive ring-2 ring-destructive/30";

// ─── Campo individual por tipo ────────────────────────────────────────
export function CampoPergunta({
  pergunta,
  valor,
  erro,
  onChange,
}: {
  pergunta: BriefingPergunta;
  valor: Valor | undefined;
  erro: boolean;
  onChange: (v: Valor) => void;
}) {
  const { id, tipo, opcoes = [], obrigatoria, ajuda } = pergunta;
  const val = valor;
  const sVal = typeof val === "string" ? val : "";
  const aVal = Array.isArray(val) ? val : [];

  return (
    <div id={`q-${id}`} className="scroll-mt-24 space-y-2">
      <label htmlFor={`f-${id}`} className="block text-[14px] font-medium leading-snug">
        {pergunta.pergunta || <span className="text-muted-foreground/60">(sem texto)</span>}
        {obrigatoria && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {ajuda && <p className="text-[12px] text-muted-foreground -mt-0.5">{ajuda}</p>}

      {/* Render por tipo */}
      {tipo === "PARAGRAFO" ? (
        <Textarea
          id={`f-${id}`}
          value={sVal}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={cn("text-base sm:text-sm min-h-[104px]", erro && ERRO_RING)}
        />
      ) : tipo === "ESCOLHA" || tipo === "SIM_NAO" ? (
        <RadioGrupo
          name={id}
          opcoes={tipo === "SIM_NAO" ? ["Sim", "Não"] : opcoes}
          valor={sVal}
          erro={erro}
          onChange={onChange}
        />
      ) : tipo === "CAIXAS" ? (
        <CaixasGrupo opcoes={opcoes} valores={aVal} erro={erro} onChange={onChange} />
      ) : tipo === "LISTA" ? (
        <select
          id={`f-${id}`}
          value={sVal}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "flex h-11 sm:h-10 w-full items-center rounded-lg border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring",
            erro && ERRO_RING
          )}
        >
          <option value="">Selecione…</option>
          {opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : tipo === "UPLOAD" ? (
        <CampoUpload valor={sVal} erro={erro} onChange={onChange} />
      ) : (
        // TEXTO / NUMERO / DATA / LINK → input com type apropriado
        <Input
          id={`f-${id}`}
          type={inputType(tipo)}
          inputMode={tipo === "NUMERO" ? "decimal" : undefined}
          value={sVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholderPara(tipo)}
          className={cn("h-11 sm:h-10 text-base sm:text-sm", erro && ERRO_RING)}
        />
      )}

      {erro && <p className="text-[11px] text-destructive">Essa pergunta é obrigatória.</p>}
    </div>
  );
}

function RadioGrupo({
  name,
  opcoes,
  valor,
  erro,
  onChange,
}: {
  name: string;
  opcoes: string[];
  valor: string;
  erro: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className={cn("space-y-1.5", erro && "rounded-lg ring-2 ring-destructive/30 p-2 -m-2")}>
      {opcoes.map((o) => (
        <label
          key={o}
          className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-border px-3 py-2.5 sm:py-2 text-[14px] sm:text-sm hover:bg-muted/50 transition-colors touch-feedback has-[:checked]:border-primary has-[:checked]:bg-primary/5"
        >
          <input
            type="radio"
            name={name}
            checked={valor === o}
            onChange={() => onChange(o)}
            className="accent-primary h-4 w-4 shrink-0"
          />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

function CaixasGrupo({
  opcoes,
  valores,
  erro,
  onChange,
}: {
  opcoes: string[];
  valores: string[];
  erro: boolean;
  onChange: (v: string[]) => void;
}) {
  function toggle(o: string) {
    onChange(valores.includes(o) ? valores.filter((v) => v !== o) : [...valores, o]);
  }
  return (
    <div className={cn("space-y-1.5", erro && "rounded-lg ring-2 ring-destructive/30 p-2 -m-2")}>
      {opcoes.map((o) => (
        <label
          key={o}
          className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-border px-3 py-2.5 sm:py-2 text-[14px] sm:text-sm hover:bg-muted/50 transition-colors touch-feedback has-[:checked]:border-primary has-[:checked]:bg-primary/5"
        >
          <input
            type="checkbox"
            checked={valores.includes(o)}
            onChange={() => toggle(o)}
            className="accent-primary h-4 w-4 shrink-0"
          />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * UPLOAD: imagem comprime pra dataURL (reusa comprimirImagem do portal); outros
 * tipos viram dataURL com teto de tamanho. Se passar do teto, oferece colar um
 * link (Drive/YouTube/etc.) como fallback. O valor guardado é a dataURL OU a URL.
 */
export function CampoUpload({
  valor,
  erro,
  onChange,
}: {
  valor: string;
  erro: boolean;
  onChange: (v: string) => void;
}) {
  const [processando, setProcessando] = useState(false);
  const [nome, setNome] = useState<string | null>(null);
  const [linkExterno, setLinkExterno] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const temArquivo = !!valor;
  const ehImagem = valor.startsWith("data:image");
  const ehDataUrl = valor.startsWith("data:");

  async function processar(file: File) {
    setProcessando(true);
    try {
      let url: string;
      if (file.type.startsWith("image/")) {
        url = await comprimirImagem(file);
      } else {
        if (file.size > MAX_ARQUIVO_BYTES) {
          toast.error("Arquivo grande demais (máx ~4MB). Cole um link do Drive abaixo.");
          return;
        }
        url = await fileToDataURL(file);
      }
      setNome(file.name);
      onChange(url);
    } catch {
      toast.error("Não consegui ler o arquivo. Tente outro ou cole um link.");
    } finally {
      setProcessando(false);
    }
  }

  function aplicarLink() {
    const u = linkExterno.trim();
    if (!u) return;
    setNome(null);
    onChange(u);
    setLinkExterno("");
  }

  function limpar() {
    setNome(null);
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("space-y-2", erro && "rounded-lg ring-2 ring-destructive/30 p-2 -m-2")}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await processar(f);
        }}
      />

      {temArquivo ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
          {ehImagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={valor} alt="" className="h-12 w-12 rounded-md object-cover shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center shrink-0">
              {ehDataUrl ? (
                <FileText className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Link2 className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate">
              {nome ?? (ehDataUrl ? "Arquivo anexado" : "Link anexado")}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {ehDataUrl ? "Pronto pra enviar" : valor}
            </p>
          </div>
          <button
            type="button"
            onClick={limpar}
            className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted touch-feedback shrink-0"
            aria-label="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={processando}
            className="h-11 sm:h-10 w-full text-sm touch-feedback"
          >
            {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar arquivo (imagem ou PDF)
          </Button>
          <div className="flex gap-1.5">
            <Input
              value={linkExterno}
              onChange={(e) => setLinkExterno(e.target.value)}
              placeholder="Ou cole um link (Drive, site…)"
              className="h-11 sm:h-10 text-base sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  aplicarLink();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={aplicarLink}
              disabled={!linkExterno.trim()}
              className="h-11 sm:h-10 shrink-0 touch-feedback"
              aria-label="Anexar link"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10.5px] text-muted-foreground">
            Imagens são otimizadas automaticamente. Arquivos grandes: use um link.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────
export function respostaVazia(v: Valor | undefined): boolean {
  if (v == null) return true;
  return Array.isArray(v) ? v.length === 0 : v.trim() === "";
}

function inputType(tipo: BriefingPergunta["tipo"]): string {
  if (tipo === "NUMERO") return "number";
  if (tipo === "DATA") return "date";
  if (tipo === "LINK") return "url";
  return "text";
}

function placeholderPara(tipo: BriefingPergunta["tipo"]): string | undefined {
  if (tipo === "LINK") return "https://…";
  return undefined;
}
