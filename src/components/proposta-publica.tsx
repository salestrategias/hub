"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { CheckCircle2, XCircle, Lock, Download, Loader2, Clock, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizarExtras, type PropostaExtras } from "@/lib/proposta-blocos";
import {
  PropostaDocumento,
  type PropostaDocumentoData,
  formatBRL,
  hasContent,
} from "@/components/proposta-documento";

// Re-export do tipo de dados (compatibilidade): a pública e a print compartilham
// o mesmo shape. Mantido aqui pra não quebrar imports existentes.
type PropostaPublicaData = PropostaDocumentoData;

export function PropostaPublica({ token }: { token: string }) {
  const [proposta, setProposta] = useState<PropostaPublicaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaSenha, setPrecisaSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [autenticando, setAutenticando] = useState(false);
  const [aceitarOpen, setAceitarOpen] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);

  const carregar = useCallback(
    async (senhaProvida?: string) => {
      setLoading(true);
      setErro(null);
      try {
        const url = `/api/p/proposta/${token}`;
        const opts: RequestInit = senhaProvida
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ senha: senhaProvida }),
            }
          : { method: "GET" };
        const res = await fetch(url, opts);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error ?? "Falha ao carregar");
        }
        const data = await res.json();
        if (data.precisaSenha) {
          setPrecisaSenha(true);
          setLoading(false);
          return;
        }
        setProposta(data);
        setPrecisaSenha(false);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      } finally {
        setLoading(false);
        setAutenticando(false);
      }
    },
    [token]
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function tentarSenha() {
    if (!senha.trim()) return;
    setAutenticando(true);
    await carregar(senha);
  }

  // ─── Estados ─────────────────────────────────────────────────

  if (precisaSenha) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="h-14 w-14 rounded-full bg-sal-600/15 text-sal-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Proposta protegida</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Esta proposta foi enviada com senha. Digite-a abaixo pra continuar.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              onKeyDown={(e) => e.key === "Enter" && tentarSenha()}
              autoFocus
            />
            <Button onClick={tentarSenha} disabled={autenticando} className="w-full">
              {autenticando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar proposta"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sal-400" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <XCircle className="h-12 w-12 text-rose-400 mx-auto" />
          <h1 className="font-display text-xl font-semibold">Não foi possível abrir a proposta</h1>
          <p className="text-sm text-muted-foreground">{erro}</p>
          <p className="text-[11px] text-muted-foreground/70">
            Se você acha que isso é um erro, entre em contato com quem enviou o link.
          </p>
        </div>
      </div>
    );
  }

  if (!proposta) return null;

  const aceita = proposta.status === "ACEITA";
  const recusada = proposta.status === "RECUSADA";
  const decidida = aceita || recusada;
  const extras = normalizarExtras(proposta.extras);

  // TOC: monta lista de âncoras visíveis pra navegação lateral
  const tocItems = construirToc(proposta, extras);

  return (
    <>
      {/*
        O corpo "documento" (capa + sequência + styled-jsx) vem do componente
        compartilhado PropostaDocumento. O chrome interativo abaixo é passado
        como children — renderiza DENTRO do wrapper .proposta-publica, no mesmo
        lugar de antes. A página de print reusa PropostaDocumento sem children.
      */}
      <PropostaDocumento proposta={proposta}>
        {/* CTA Aceite / Recusa — ancora #cta usada pelos botões dos pacotes */}
        <section className="cta" id="cta">
          <div className="cta-inner">
            {aceita ? (
              <div className="cta-decidida cta-aceita">
                <CheckCircle2 className="h-10 w-10" />
                <h2>Proposta aceita</h2>
                <p>
                  Aceita em {new Date(proposta.aceitaEm!).toLocaleDateString("pt-BR")}.
                  Vamos entrar em contato com os próximos passos.
                </p>
                {(proposta.aceiteNome || proposta.aceiteCpfCnpj) && (
                  <div className="cta-assinatura">
                    <div className="cta-assinatura-titulo">Assinatura digital</div>
                    {proposta.aceiteNome && <div className="cta-assinatura-linha">{proposta.aceiteNome}</div>}
                    {proposta.aceiteCpfCnpj && (
                      <div className="cta-assinatura-linha cta-assinatura-doc">
                        {formatarCpfCnpjDisplay(proposta.aceiteCpfCnpj)}
                      </div>
                    )}
                    <div className="cta-assinatura-linha cta-assinatura-sub">
                      Aceito em{" "}
                      {new Date(proposta.aceitaEm!).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : recusada ? (
              <div className="cta-decidida cta-recusada">
                <XCircle className="h-10 w-10" />
                <h2>Proposta recusada</h2>
                <p>Recusada em {new Date(proposta.recusadaEm!).toLocaleDateString("pt-BR")}.</p>
              </div>
            ) : (
              <>
                <h2>Pronto para começar?</h2>
                <p>Aceite digital — vale como confirmação inicial. Em seguida emitimos o contrato.</p>
                <div className="cta-acoes">
                  <Button size="lg" onClick={() => setAceitarOpen(true)} className="cta-btn-aceitar">
                    <CheckCircle2 className="h-4 w-4" /> Aceitar proposta
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setRecusarOpen(true)}>
                    <XCircle className="h-4 w-4" /> Recusar
                  </Button>
                </div>
                {proposta.shareExpiraEm && (
                  <p className="cta-validade">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Esta proposta vale até{" "}
                    {new Date(proposta.shareExpiraEm).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Toolbar fixa: download PDF + contato */}
        <div className="toolbar">
          <a
            href={`/api/propostas/${proposta.id}/pdf?token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="toolbar-btn"
          >
            <Download className="h-3.5 w-3.5" /> Baixar PDF
          </a>
          {proposta.autorEmail && (
            <a href={`mailto:${proposta.autorEmail}?subject=Sobre a proposta ${proposta.numero}`} className="toolbar-btn">
              Dúvidas? Falar com {proposta.autorNome ?? "SAL"}
            </a>
          )}
        </div>

        {/* TOC lateral fixo — só em desktop */}
        {tocItems.length > 0 && <Toc itens={tocItems} />}

        {/* CTA fixo no rodapé — sempre visível, fade-in após scroll inicial */}
        {!decidida && (
          <div className="cta-fixo">
            <div className="cta-fixo-inner">
              <div className="cta-fixo-info">
                <span className="cta-fixo-numero">Proposta {proposta.numero}</span>
                {proposta.valorMensal && (
                  <span className="cta-fixo-valor">
                    {formatBRL(proposta.valorMensal)}<span className="cta-fixo-valor-sub">/mês</span>
                  </span>
                )}
              </div>
              <div className="cta-fixo-acoes">
                <Button onClick={() => setRecusarOpen(true)} variant="outline" size="sm" className="cta-fixo-btn-recusar">
                  Recusar
                </Button>
                <Button onClick={() => setAceitarOpen(true)} size="sm" className="cta-fixo-btn-aceitar">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aceitar
                </Button>
              </div>
            </div>
          </div>
        )}
      </PropostaDocumento>

      {aceitarOpen && (
        <AceitarDialog
          propostaId={proposta.id}
          token={token}
          numero={proposta.numero}
          onClose={() => setAceitarOpen(false)}
          onAceita={() => {
            setAceitarOpen(false);
            carregar();
          }}
        />
      )}
      {recusarOpen && (
        <RecusarDialog
          propostaId={proposta.id}
          token={token}
          numero={proposta.numero}
          onClose={() => setRecusarOpen(false)}
          onRecusada={() => {
            setRecusarOpen(false);
            carregar();
          }}
        />
      )}
    </>
  );
}

// ─── TOC (table of contents) lateral fixo ─────────────────────────────

type TocItem = { id: string; label: string };

function construirToc(proposta: PropostaPublicaData, extras: PropostaExtras): TocItem[] {
  const items: TocItem[] = [];
  if (proposta.capa && hasContent(proposta.capa)) items.push({ id: "apresentacao", label: "Apresentação" });
  if (proposta.diagnostico && hasContent(proposta.diagnostico)) items.push({ id: "diagnostico", label: "Diagnóstico" });
  if (extras.cases?.visivel) items.push({ id: "cases", label: "Cases" });
  if (proposta.objetivo && hasContent(proposta.objetivo)) items.push({ id: "objetivo", label: "Objetivo" });
  if (extras.kpis?.visivel) items.push({ id: "kpis", label: "Metas" });
  if (proposta.escopo && hasContent(proposta.escopo)) items.push({ id: "escopo", label: "Estratégia" });
  if (extras.timeline?.visivel) items.push({ id: "timeline", label: "Cronograma" });
  else if (proposta.cronograma && hasContent(proposta.cronograma)) items.push({ id: "cronograma", label: "Cronograma" });
  if (proposta.investimento && hasContent(proposta.investimento)) items.push({ id: "investimento", label: "Investimento" });
  if (extras.pacotes?.visivel) items.push({ id: "pacotes", label: "Pacotes" });
  if (extras.garantias?.visivel) items.push({ id: "garantias", label: "Garantias" });
  if (proposta.proximosPassos && hasContent(proposta.proximosPassos)) items.push({ id: "proximos-passos", label: "Próximos passos" });
  if (proposta.termos && hasContent(proposta.termos)) items.push({ id: "termos", label: "Termos" });
  if (extras.equipe?.visivel) items.push({ id: "equipe", label: "Equipe" });
  if (extras.faq?.visivel) items.push({ id: "faq", label: "FAQ" });
  return items;
}

function Toc({ itens }: { itens: TocItem[] }) {
  const [ativo, setAtivo] = useState<string>("");

  useEffect(() => {
    // Scrollspy: observa quais sections estão visíveis no viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setAtivo(entry.target.id);
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    itens.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [itens]);

  return (
    <nav className="toc" aria-label="Índice da proposta">
      <div className="toc-header">
        <List className="h-3 w-3" />
        <span>Navegação</span>
      </div>
      <ul className="toc-lista">
        {itens.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={cn("toc-link", ativo === it.id && "toc-link-ativo")}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AceitarDialog({
  propostaId,
  token,
  numero,
  onClose,
  onAceita,
}: {
  propostaId: string;
  token: string;
  numero: string;
  onClose: () => void;
  onAceita: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [concorda, setConcorda] = useState(false);

  // Validações de forma client-side (UX) — server revalida via modulo 11
  const digitos = cpfCnpj.replace(/\D/g, "");
  const cpfCnpjValido = digitos.length === 11 || digitos.length === 14;
  const nomeValido = nome.trim().length >= 5;
  const tudoOk = nomeValido && cpfCnpjValido && concorda;

  function formatarCpfCnpjDigitando(v: string): string {
    const d = v.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 11) {
      // CPF: 000.000.000-00
      return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
    }
    // CNPJ: 00.000.000/0000-00
    return d
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
      .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
  }

  async function confirmar() {
    if (!tudoOk) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/propostas/${propostaId}/aceitar?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          cpfCnpj: digitos,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      toast.success("Proposta aceita! 🎉");
      onAceita();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md dialog-bottom-sheet">
        <div className="sm:hidden flex justify-center -mt-1 mb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Aceitar proposta {numero}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm">
            Preencha os dados pra registrar o aceite digital com validade legal.
            Em seguida emitimos o contrato e enviamos o boleto da primeira fatura.
          </p>

          <div className="space-y-2">
            <Label htmlFor="aceite-nome" className="text-xs">
              Nome completo do signatário <span className="text-destructive">*</span>
            </Label>
            <Input
              id="aceite-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Marcelo Freitas"
              autoFocus
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aceite-doc" className="text-xs">
              CPF ou CNPJ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="aceite-doc"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatarCpfCnpjDigitando(e.target.value))}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              inputMode="numeric"
              className="h-10 font-mono"
            />
            {digitos.length > 0 && !cpfCnpjValido && (
              <p className="text-[11px] text-amber-500">
                Aguardando dígitos completos ({digitos.length}/{digitos.length <= 11 ? 11 : 14})
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-[12px] leading-snug">
            <input
              type="checkbox"
              checked={concorda}
              onChange={(e) => setConcorda(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              Declaro estar autorizado(a) a aceitar esta proposta em nome da empresa indicada,
              e concordo com os termos e condições apresentados.
            </span>
          </label>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
            <div>📅 Aceite registrado com data, hora, IP e user-agent.</div>
            <div>🔒 Tem valor jurídico como manifestação de vontade (Marco Civil + LGPD).</div>
            <div>📄 Contrato formal será emitido em até 24h com base nesse aceite.</div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-10">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={confirmar}
            disabled={enviando || !tudoOk}
            className={cn("bg-emerald-600 hover:bg-emerald-700 h-10 touch-feedback")}
          >
            {enviando ? "Confirmando..." : "Aceitar e assinar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecusarDialog({
  propostaId,
  token,
  numero,
  onClose,
  onRecusada,
}: {
  propostaId: string;
  token: string;
  numero: string;
  onClose: () => void;
  onRecusada: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    try {
      const res = await fetch(`/api/propostas/${propostaId}/recusar?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      toast.success("Resposta registrada. Obrigado pelo retorno.");
      onRecusada();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-400" />
            Recusar proposta {numero}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">
            Pode nos contar o motivo? Ajuda a melhorar futuras propostas (opcional).
          </p>
          <div className="space-y-1.5">
            <Label>Motivo da recusa</Label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: valor acima do orçamento atual, momento não é ideal, encontramos outro parceiro..."
              className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Voltar</Button>
          </DialogClose>
          <Button onClick={confirmar} disabled={enviando} variant="destructive">
            {enviando ? "Enviando..." : "Confirmar recusa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatarCpfCnpjDisplay(s: string): string {
  const d = s.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return s;
}
