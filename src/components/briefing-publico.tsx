"use client";
/**
 * Formulário PÚBLICO de preenchimento do briefing (cliente responde sem login).
 *
 * Renderiza cada pergunta pelo `tipo` (catálogo em src/lib/briefing.ts):
 *   TEXTO→input · PARAGRAFO→textarea · ESCOLHA→radios · CAIXAS→checkboxes
 *   (array) · LISTA→select · NUMERO→input number · DATA→input date ·
 *   LINK→input url · SIM_NAO→radio Sim/Não · UPLOAD→arquivo (imagem comprime
 *   pra dataURL; outros tipos viram dataURL com teto; fallback de LINK colado).
 *
 * - Agrupa por `secao` (cabeçalho de seção). Marca obrigatórias (*) e valida
 *   no submit. Mostra `ajuda` abaixo de cada pergunta.
 * - Pré-preenche com `respostasIniciais` (revisar/reenviar).
 * - Pós-envio: estado de agradecimento; permite reabrir pra editar.
 *
 * Mobile-first: inputs h-11 / text-base no mobile, safe-area, sem <style jsx>.
 * Assume tema claro (resto do /p), mas usa só tokens (theme-aware).
 */
import { useMemo, useRef, useState } from "react";
import { Loader2, Upload, Link2, Trash2, CheckCircle2, FileText, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { BriefingPergunta } from "@/lib/briefing";
import { comprimirImagem, fileToDataURL } from "@/components/portal-enviar-conteudo";

type Valor = string | string[];
type Respostas = Record<string, Valor>;

// Teto pra dataURL de arquivo não-imagem (~4MB de binário → cabe no @db.Text).
const MAX_ARQUIVO_BYTES = 4_000_000;

export function BriefingPublico({
  token,
  titulo,
  clienteNome,
  perguntas,
  respostasIniciais,
  jaRespondido,
  respondidoEm,
}: {
  token: string;
  titulo: string;
  clienteNome: string | null;
  perguntas: BriefingPergunta[];
  respostasIniciais: Respostas | null;
  jaRespondido: boolean;
  respondidoEm: string | null;
}) {
  const [respostas, setRespostas] = useState<Respostas>(() => respostasIniciais ?? {});
  const [enviando, setEnviando] = useState(false);
  // Mostra o agradecimento se já veio respondido (e o cliente não clicou "editar").
  const [concluido, setConcluido] = useState(jaRespondido);
  const [quandoRespondeu, setQuandoRespondeu] = useState(respondidoEm);
  const [errIds, setErrIds] = useState<Set<string>>(new Set());

  // Agrupa por seção preservando a ordem de aparição.
  const grupos = useMemo(() => agruparPorSecao(perguntas), [perguntas]);
  const obrigatorias = useMemo(() => perguntas.filter((p) => p.obrigatoria), [perguntas]);

  function setValor(id: string, valor: Valor) {
    setRespostas((r) => ({ ...r, [id]: valor }));
    if (errIds.has(id)) {
      setErrIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  function faltando(): string[] {
    return obrigatorias.filter((p) => respostaVazia(respostas[p.id])).map((p) => p.id);
  }

  async function enviar() {
    const faltam = faltando();
    if (faltam.length > 0) {
      setErrIds(new Set(faltam));
      toast.error(
        faltam.length === 1
          ? "Falta responder 1 pergunta obrigatória."
          : `Faltam ${faltam.length} perguntas obrigatórias.`
      );
      // Rola até a primeira pendência.
      const el = document.getElementById(`q-${faltam[0]}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(`/api/p/briefing/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao enviar. Tente de novo.");
        return;
      }
      const d = await res.json().catch(() => ({}));
      setQuandoRespondeu(typeof d?.respondidoEm === "string" ? d.respondidoEm : new Date().toISOString());
      setConcluido(true);
      toast.success("Recebemos suas respostas. Obrigado!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // ─── Estado de agradecimento (pós-envio / já respondido) ────────────
  if (concluido) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-10 safe-area-inset-top">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-500/12 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-semibold">Recebemos suas respostas!</h1>
            <p className="text-sm text-muted-foreground">
              Obrigado por preencher o briefing{clienteNome ? ` de ${clienteNome}` : ""}. A equipe da{" "}
              SAL já tem o que precisa pra seguir.
            </p>
            {quandoRespondeu && (
              <p className="text-[11px] text-muted-foreground/70">
                Enviado em {new Date(quandoRespondeu).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="h-11 touch-feedback"
            onClick={() => setConcluido(false)}
          >
            <Pencil className="h-4 w-4" /> Revisar / editar respostas
          </Button>
          <p className="text-[11px] text-muted-foreground/60 pt-2">SAL Estratégias de Marketing</p>
        </div>
      </main>
    );
  }

  // ─── Formulário ─────────────────────────────────────────────────────
  return (
    <main className="min-h-screen safe-area-inset-top">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-6 sm:py-10 pb-32">
        {/* Cabeçalho discreto */}
        <header className="mb-6 sm:mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Briefing
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-1 leading-tight">{titulo}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {clienteNome ? <>para {clienteNome} · </> : null}
            <span className="font-medium text-foreground/80">SAL Estratégias de Marketing</span>
          </p>
          {jaRespondido && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Você já respondeu este briefing. Pode revisar e reenviar — as respostas anteriores estão preenchidas.</span>
            </div>
          )}
          {obrigatorias.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground/70">
              <span className="text-destructive">*</span> campos obrigatórios
            </p>
          )}
        </header>

        {perguntas.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Este briefing ainda não tem perguntas. Fale com quem enviou o link.
          </div>
        ) : (
          <div className="space-y-8">
            {grupos.map((g, gi) => (
              <section key={g.secao ?? `__sem__${gi}`} className="space-y-5">
                {g.secao && (
                  <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                    {g.secao}
                  </h2>
                )}
                {g.perguntas.map((p) => (
                  <CampoPergunta
                    key={p.id}
                    pergunta={p}
                    valor={respostas[p.id]}
                    erro={errIds.has(p.id)}
                    onChange={(v) => setValor(p.id, v)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}

        {/* CTA de envio — sticky no rodapé (acima da safe-area) */}
        {perguntas.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-inset-bottom">
            <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground hidden sm:block">
                Suas respostas vão direto pra equipe da SAL.
              </span>
              <Button
                onClick={enviar}
                disabled={enviando}
                className="h-11 w-full sm:w-auto touch-feedback"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {jaRespondido ? "Reenviar respostas" : "Enviar respostas"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Campo individual por tipo ────────────────────────────────────────
function CampoPergunta({
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

const ERRO_RING = "border-destructive ring-2 ring-destructive/30";

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
function CampoUpload({
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
function agruparPorSecao(
  perguntas: BriefingPergunta[]
): { secao: string | undefined; perguntas: BriefingPergunta[] }[] {
  const grupos: { secao: string | undefined; perguntas: BriefingPergunta[] }[] = [];
  for (const p of perguntas) {
    const sec = p.secao;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.secao === sec) {
      ultimo.perguntas.push(p);
    } else {
      grupos.push({ secao: sec, perguntas: [p] });
    }
  }
  return grupos;
}

function respostaVazia(v: Valor | undefined): boolean {
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
