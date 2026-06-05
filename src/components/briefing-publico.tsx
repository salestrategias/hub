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
import Image from "next/image";
import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Pencil } from "lucide-react";
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
    <main className={cn(embutido ? "" : "min-h-screen safe-area-inset-top")}>
      <div
        className={cn(
          "mx-auto w-full max-w-2xl",
          embutido ? "px-0 pt-1 pb-40 sm:pb-36" : "px-4 sm:px-6 py-6 sm:py-10 pb-32"
        )}
      >
        {/* Cabeçalho: logo SAL + identificação do briefing */}
        <header className="mb-6 sm:mb-8">
          <MarcaSal className="mb-5 sm:mb-6" />
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

        {/* CTA de envio — fixo no rodapé (acima da safe-area). Embutido no
            portal: sobe acima da bottom-nav (z + offset) no mobile; em ≥ sm não
            há bottom-nav, então volta pro bottom-0. */}
        {perguntas.length > 0 && (
          <div
            className={cn(
              "fixed inset-x-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-inset-bottom",
              embutido
                ? "z-40 bottom-[calc(56px+env(safe-area-inset-bottom))] sm:bottom-0"
                : "z-10 bottom-0"
            )}
          >
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
