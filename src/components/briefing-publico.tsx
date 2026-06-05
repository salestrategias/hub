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
 * WIZARD por seção: em vez de despejar tudo numa página só (longo/cansativo),
 * agrupa as perguntas por `secao` (preservando a ordem) e mostra UMA etapa por
 * vez, com barra de progresso, "Etapa X de N" + nome da seção, e navegação
 * Voltar / Próximo / Enviar. Perguntas sem `secao` viram a etapa "Geral"; se o
 * briefing inteiro não tiver seções, fatiamos em páginas de ~6 perguntas.
 *
 * - Valida só as obrigatórias DA ETAPA ao avançar/enviar (ring vermelho + rola
 *   até a 1ª pendente). Só envia no fim.
 * - Pré-preenche com `respostasIniciais` (revisar/reenviar).
 * - Pós-envio: estado de agradecimento; permite reabrir pra editar.
 *
 * Mobile-first: inputs h-11 / text-base no mobile, barra de navegação sticky no
 * rodapé (safe-area; no modo embutido sobe acima da bottom-nav do portal), sem
 * <style jsx>. Assume tema claro (resto do /p), mas usa só tokens (theme-aware).
 */
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Pencil, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { BriefingPergunta } from "@/lib/briefing";
import {
  CampoPergunta,
  respostaVazia,
  type Valor,
  type Respostas,
} from "@/components/briefing-campos";

// Sem seções? fatia o briefing em páginas de ~6 perguntas pra não virar
// página única gigante.
const PERGUNTAS_POR_PAGINA = 6;

type Etapa = { titulo: string; perguntas: BriefingPergunta[] };

export function BriefingPublico({
  token,
  titulo,
  clienteNome,
  perguntas,
  respostasIniciais,
  jaRespondido,
  respondidoEm,
  onRespondido,
  embutido,
}: {
  token: string;
  titulo: string;
  clienteNome: string | null;
  perguntas: BriefingPergunta[];
  respostasIniciais: Respostas | null;
  jaRespondido: boolean;
  respondidoEm: string | null;
  /**
   * Chamado após gravar com sucesso (com o ISO do respondidoEm). Opcional —
   * a página pública não usa; o portal usa pra atualizar a contagem de
   * pendências e a lista quando o cliente responde embutido.
   */
  onRespondido?: (respondidoEm: string) => void;
  /**
   * Quando true, o form é renderizado EMBUTIDO dentro do Portal do Cliente
   * (não é a página pública full-screen): solta o `min-h-screen`/safe-area do
   * topo (a casca do portal já cuida disso) e levanta a barra de CTA fixa
   * acima da bottom-nav do portal no mobile. Default false (página pública).
   */
  embutido?: boolean;
}) {
  const [respostas, setRespostas] = useState<Respostas>(() => respostasIniciais ?? {});
  const [enviando, setEnviando] = useState(false);
  // Mostra o agradecimento se já veio respondido (e o cliente não clicou "editar").
  const [concluido, setConcluido] = useState(jaRespondido);
  const [quandoRespondeu, setQuandoRespondeu] = useState(respondidoEm);
  const [errIds, setErrIds] = useState<Set<string>>(new Set());

  // Etapas do wizard (uma seção = uma etapa; fallback chunk sem-seção).
  const etapas = useMemo(() => montarEtapas(perguntas), [perguntas]);
  const total = etapas.length;

  // Etapa atual + direção da transição (pra slide leve ao trocar de etapa).
  const [etapaIdx, setEtapaIdx] = useState(0);
  const [direcao, setDirecao] = useState<1 | -1>(1);
  // Clampa o índice se a lista de perguntas mudar (ex.: detalhe recarregado).
  const idx = Math.min(etapaIdx, Math.max(0, total - 1));
  const etapa = etapas[idx];
  const primeira = idx === 0;
  const ultima = idx >= total - 1;

  // Âncora pro topo do conteúdo da etapa: ao trocar, rola pra cá e foca a 1ª
  // pergunta (acessibilidade). Não usamos window.scrollTo direto porque no modo
  // embutido o scroll é do container do portal, não da janela.
  const conteudoRef = useRef<HTMLDivElement>(null);

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

  // Obrigatórias ainda vazias DENTRO da etapa informada.
  function faltandoNaEtapa(e: Etapa | undefined): string[] {
    if (!e) return [];
    return e.perguntas
      .filter((p) => p.obrigatoria && respostaVazia(respostas[p.id]))
      .map((p) => p.id);
  }

  // Valida a etapa atual. Se faltar, marca os erros, avisa e rola até a 1ª
  // pendência — retorna false (não avança/envia).
  function validarEtapa(): boolean {
    const faltam = faltandoNaEtapa(etapa);
    if (faltam.length > 0) {
      setErrIds(new Set(faltam));
      toast.error(
        faltam.length === 1
          ? "Falta responder 1 pergunta obrigatória nesta etapa."
          : `Faltam ${faltam.length} perguntas obrigatórias nesta etapa.`
      );
      const el = document.getElementById(`q-${faltam[0]}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  // Leva ao topo do conteúdo da etapa (funciona na página e embutido no portal).
  function rolarProTopo() {
    const node = conteudoRef.current;
    if (!node) return;
    // No embutido o ancestral rolável é o portal; scrollIntoView resolve os dois.
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function irPara(novo: number, dir: 1 | -1) {
    setDirecao(dir);
    setEtapaIdx(novo);
    setErrIds(new Set());
  }

  function voltar() {
    if (primeira) return;
    irPara(idx - 1, -1);
  }

  function proximo() {
    if (!validarEtapa()) return;
    if (ultima) {
      void enviar();
      return;
    }
    irPara(idx + 1, 1);
  }

  // Ao TROCAR de etapa: rola pro topo e foca a 1ª pergunta da etapa (a11y).
  // Pula o mount inicial (não roubar foco / não dar scroll-jump / não abrir
  // teclado no mobile ao abrir o briefing). Roda só na mudança de índice.
  const montou = useRef(false);
  useEffect(() => {
    if (!montou.current) {
      montou.current = true;
      return;
    }
    rolarProTopo();
    const node = conteudoRef.current;
    if (!node) return;
    const alvo = node.querySelector<HTMLElement>(
      "input:not([type=hidden]), textarea, select, [tabindex]"
    );
    // Foco discreto, sem roubar a rolagem (já rolamos acima).
    alvo?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  async function enviar() {
    // Defesa: revalida a etapa final antes de enviar (o caminho normal já
    // passou por validarEtapa em proximo()).
    if (!validarEtapa()) return;

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
      const quando = typeof d?.respondidoEm === "string" ? d.respondidoEm : new Date().toISOString();
      setQuandoRespondeu(quando);
      setConcluido(true);
      toast.success("Recebemos suas respostas. Obrigado!");
      window.scrollTo({ top: 0, behavior: "smooth" });
      onRespondido?.(quando);
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // ─── Estado de agradecimento (pós-envio / já respondido) ────────────
  if (concluido) {
    return (
      <main
        className={cn(
          "flex items-center justify-center px-4 py-10",
          embutido ? "min-h-[50vh]" : "min-h-screen safe-area-inset-top"
        )}
      >
        <div className="w-full max-w-md text-center space-y-4">
          <MarcaSal className="justify-center" />
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
            onClick={() => {
              setConcluido(false);
              setEtapaIdx(0);
              setDirecao(1);
              setErrIds(new Set());
            }}
          >
            <Pencil className="h-4 w-4" /> Revisar / editar respostas
          </Button>
          <p className="text-[11px] text-muted-foreground/60 pt-2">SAL Estratégias de Marketing</p>
        </div>
      </main>
    );
  }

  // ─── Briefing sem perguntas ─────────────────────────────────────────
  if (total === 0) {
    return (
      <main className={cn(embutido ? "" : "min-h-screen safe-area-inset-top")}>
        <div
          className={cn(
            "mx-auto w-full max-w-2xl",
            embutido ? "px-0 pt-1" : "px-4 sm:px-6 py-6 sm:py-10"
          )}
        >
          <CabecalhoMarca titulo={titulo} clienteNome={clienteNome} />
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Este briefing ainda não tem perguntas. Fale com quem enviou o link.
          </div>
        </div>
      </main>
    );
  }

  const pct = Math.round(((idx + 1) / total) * 100);

  // ─── Wizard ─────────────────────────────────────────────────────────
  return (
    <main className={cn(embutido ? "" : "min-h-screen safe-area-inset-top")}>
      <div
        className={cn(
          "mx-auto w-full max-w-2xl",
          embutido ? "px-0 pt-1 pb-44" : "px-4 sm:px-6 pt-6 sm:pt-10 pb-44"
        )}
      >
        {/* Cabeçalho FIXO (logo + identificação + progresso). Só o conteúdo da
            etapa abaixo é que troca. */}
        <header className="mb-5 sm:mb-6">
          <CabecalhoMarca titulo={titulo} clienteNome={clienteNome} compacto />

          {jaRespondido && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Você já respondeu este briefing. Pode revisar e reenviar — as respostas anteriores estão preenchidas.</span>
            </div>
          )}

          {/* Barra de progresso + indicador de etapa */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>
                Etapa {idx + 1} de {total}
              </span>
              <span aria-hidden="true">{pct}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={`Progresso do briefing: etapa ${idx + 1} de ${total}`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </header>

        {/* Conteúdo da etapa (transição leve fade/slide ao trocar) */}
        <div ref={conteudoRef} className="scroll-mt-4">
          <div
            key={idx}
            className={cn(
              "animate-in fade-in-0 duration-300 ease-out",
              direcao === 1 ? "slide-in-from-right-4" : "slide-in-from-left-4"
            )}
          >
            <div className="mb-4 sm:mb-5">
              <h2 className="font-display text-xl sm:text-2xl font-semibold leading-tight">
                {etapa.titulo}
              </h2>
              {etapa.perguntas.some((p) => p.obrigatoria) && (
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  <span className="text-destructive">*</span> campos obrigatórios
                </p>
              )}
            </div>

            <div className="space-y-5">
              {etapa.perguntas.map((p) => (
                <CampoPergunta
                  key={p.id}
                  pergunta={p}
                  valor={respostas[p.id]}
                  erro={errIds.has(p.id)}
                  onChange={(v) => setValor(p.id, v)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Navegação — sticky no rodapé (acima da safe-area). Embutido no
            portal: sobe acima da bottom-nav (z + offset) no mobile; em ≥ sm não
            há bottom-nav, então volta pro bottom-0. */}
        <div
          className={cn(
            "fixed inset-x-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-inset-bottom",
            embutido
              ? "z-40 bottom-[calc(56px+env(safe-area-inset-bottom))] sm:bottom-0"
              : "z-10 bottom-0"
          )}
        >
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-3 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={voltar}
              disabled={primeira || enviando}
              className={cn("h-11 touch-feedback", primeira && "invisible")}
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>

            {/* Pontos das etapas (≥ sm) — orientação rápida de onde está */}
            <div className="hidden sm:flex flex-1 items-center justify-center gap-1.5">
              {etapas.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === idx ? "w-5 bg-primary" : i < idx ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted-foreground/25"
                  )}
                />
              ))}
            </div>

            <Button
              type="button"
              onClick={proximo}
              disabled={enviando}
              className="h-11 flex-1 sm:flex-none touch-feedback"
            >
              {ultima ? (
                <>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {jaRespondido ? "Reenviar respostas" : "Enviar respostas"}
                </>
              ) : (
                <>
                  Próximo <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Cabeçalho de marca + identificação do briefing (logo SAL + título + cliente).
 * `compacto` reduz o espaçamento (usado no topo do wizard, onde o progresso vem
 * logo abaixo). Reusado pelo estado "sem perguntas".
 */
function CabecalhoMarca({
  titulo,
  clienteNome,
  compacto,
}: {
  titulo: string;
  clienteNome: string | null;
  compacto?: boolean;
}) {
  return (
    <div>
      <MarcaSal className={compacto ? "mb-4" : "mb-5 sm:mb-6"} />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Briefing
      </p>
      <h1 className="font-display text-xl sm:text-2xl font-semibold mt-1 leading-tight">{titulo}</h1>
      <p className="text-sm text-muted-foreground mt-1.5">
        {clienteNome ? <>para {clienteNome} · </> : null}
        <span className="font-medium text-foreground/80">SAL Estratégias de Marketing</span>
      </p>
    </div>
  );
}

/**
 * Lockup da marca SAL pro topo da página pública (header limpo e profissional).
 * Usa o logo full-color (`/sal-logo.svg`) — o `/p` é tema claro/fundo branco.
 * O SVG é um wordmark largo (viewBox 1536×864 ≈ 16:9); fixamos a altura.
 */
function MarcaSal({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/sal-logo.svg"
        alt="SAL Estratégias de Marketing"
        width={64}
        height={36}
        priority
        className="h-8 w-auto"
      />
      <span className="sr-only">SAL Estratégias de Marketing</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────
/**
 * Monta as etapas do wizard a partir das perguntas:
 *  - Agrupa por `secao` preservando a ordem de aparição (uma seção = uma etapa).
 *  - Perguntas SEM `secao` viram a etapa "Geral".
 *  - Se NENHUMA pergunta tiver seção (briefing "plano"), fatia em páginas de
 *    ~PERGUNTAS_POR_PAGINA pra não virar uma página única gigante.
 */
function montarEtapas(perguntas: BriefingPergunta[]): Etapa[] {
  if (perguntas.length === 0) return [];

  const temSecao = perguntas.some((p) => p.secao);

  // Sem nenhuma seção → fatia em páginas iguais.
  if (!temSecao) {
    const etapas: Etapa[] = [];
    for (let i = 0; i < perguntas.length; i += PERGUNTAS_POR_PAGINA) {
      etapas.push({ titulo: "Briefing", perguntas: perguntas.slice(i, i + PERGUNTAS_POR_PAGINA) });
    }
    // Se virou mais de uma página, numera pra orientar (1/2, 2/2…); senão só "Briefing".
    return etapas.length > 1
      ? etapas.map((e, i) => ({ ...e, titulo: `Parte ${i + 1}` }))
      : etapas;
  }

  // Com seções → agrupa por blocos contíguos de mesma seção (sem = "Geral").
  const etapas: Etapa[] = [];
  for (const p of perguntas) {
    const titulo = p.secao ?? "Geral";
    const ultima = etapas[etapas.length - 1];
    if (ultima && ultima.titulo === titulo) {
      ultima.perguntas.push(p);
    } else {
      etapas.push({ titulo, perguntas: [p] });
    }
  }
  return etapas;
}
