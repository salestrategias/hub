"use client";
import { useCallback, useEffect, useState } from "react";
import { BlockRenderer } from "@/components/editor";
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
import { CheckCircle2, XCircle, Lock, Download, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type PropostaPublicaData = {
  id: string;
  numero: string;
  titulo: string;
  clienteNome: string;
  clienteEmail: string | null;
  logoUrl: string | null;
  corPrimaria: string | null;
  capa: string | null;
  diagnostico: string | null;
  objetivo: string | null;
  escopo: string | null;
  cronograma: string | null;
  investimento: string | null;
  proximosPassos: string | null;
  termos: string | null;
  valorMensal: number | null;
  valorTotal: number | null;
  duracaoMeses: number | null;
  validadeDias: number;
  shareExpiraEm: string | null;
  status: "RASCUNHO" | "ENVIADA" | "VISTA" | "ACEITA" | "RECUSADA" | "EXPIRADA";
  enviadaEm: string | null;
  aceitaEm: string | null;
  recusadaEm: string | null;
  autorNome: string | null;
  autorEmail: string | null;
};

const SECOES: Array<{ key: keyof PropostaPublicaData; label: string }> = [
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "objetivo", label: "Objetivo" },
  { key: "escopo", label: "Estratégia & escopo" },
  { key: "cronograma", label: "Cronograma" },
  { key: "investimento", label: "Investimento" },
  { key: "proximosPassos", label: "Próximos passos" },
  { key: "termos", label: "Termos & condições" },
];

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
  const corPrim = proposta.corPrimaria ?? "#7E30E1";
  const corPrimEscura = escurecer(corPrim, 0.3);
  const corPrimClara = clarear(corPrim, 0.4);

  return (
    <>
      <div
        className="proposta-publica"
        style={
          {
            // Custom properties consumidas pelo CSS global abaixo
            ["--cor-primaria" as string]: corPrim,
            ["--cor-primaria-escura" as string]: corPrimEscura,
            ["--cor-primaria-clara" as string]: corPrimClara,
          } as React.CSSProperties
        }
      >
        {/* Capa */}
        <section className="capa">
          <div className="capa-inner">
            <div className="capa-brand">
              {proposta.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proposta.logoUrl} alt="Logo" className="capa-logo" />
              ) : (
                <>
                  <span className="brand-mark">SAL</span>
                  <span className="brand-sub">Estratégias de Marketing</span>
                </>
              )}
            </div>
            <div className="capa-content">
              <span className="capa-numero">Proposta {proposta.numero}</span>
              <h1 className="capa-titulo">{proposta.titulo}</h1>
              <div className="capa-separador" />
              <span className="capa-label">Preparada para</span>
              <p className="capa-cliente">{proposta.clienteNome}</p>
            </div>
            <div className="capa-bottom">
              <div>
                <p className="capa-meta">Por {proposta.autorNome ?? "SAL"}</p>
                <p className="capa-meta">{proposta.autorEmail ?? ""}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p className="capa-meta">
                  Emitida{" "}
                  {proposta.enviadaEm
                    ? new Date(proposta.enviadaEm).toLocaleDateString("pt-BR")
                    : new Date().toLocaleDateString("pt-BR")}
                </p>
                {proposta.shareExpiraEm && (
                  <p className="capa-meta">
                    Válida até {new Date(proposta.shareExpiraEm).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Seção: capa custom (se preenchida) */}
        {proposta.capa && hasContent(proposta.capa) && (
          <Secao label="Apresentação" conteudo={proposta.capa} />
        )}

        {/* Demais seções */}
        {SECOES.map((s) => {
          const conteudo = proposta[s.key] as string | null;
          if (!conteudo || !hasContent(conteudo)) return null;
          return (
            <Secao key={s.key as string} label={s.label} conteudo={conteudo}>
              {s.key === "investimento" && (
                <ResumoInvestimento
                  valorMensal={proposta.valorMensal}
                  valorTotal={proposta.valorTotal}
                  duracaoMeses={proposta.duracaoMeses}
                />
              )}
            </Secao>
          );
        })}

        {/* CTA Aceite / Recusa */}
        <section className="cta">
          <div className="cta-inner">
            {aceita ? (
              <div className="cta-decidida cta-aceita">
                <CheckCircle2 className="h-10 w-10" />
                <h2>Proposta aceita</h2>
                <p>
                  Aceita em {new Date(proposta.aceitaEm!).toLocaleDateString("pt-BR")}.
                  Vamos entrar em contato com os próximos passos.
                </p>
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
      </div>

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

      <style jsx global>{`
        .proposta-publica {
          max-width: 920px;
          margin: 0 auto;
          padding: 0;
          font-family: var(--font-inter), Inter, system-ui, sans-serif;
        }
        .capa {
          background: linear-gradient(135deg, #0E0E14 0%, #1A0F2E 100%);
          color: #FFFFFF;
          padding: 80px 60px;
          min-height: 75vh;
          display: flex;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .capa::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(ellipse 60% 40% at 80% 20%, rgba(126,48,225,0.25), transparent 60%);
          pointer-events: none;
        }
        .capa-inner {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 80px;
          position: relative;
          z-index: 1;
        }
        .capa-brand { display: flex; align-items: baseline; gap: 10px; }
        .capa-logo { max-height: 64px; max-width: 240px; object-fit: contain; }
        .brand-mark {
          font-size: 40px;
          font-weight: 800;
          background: linear-gradient(90deg, #B794F4 0%, var(--cor-primaria) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          letter-spacing: 2px;
        }
        .brand-sub {
          font-size: 11px;
          color: #9696A8;
          text-transform: uppercase;
          letter-spacing: 3px;
        }
        .capa-content { display: flex; flex-direction: column; gap: 12px; }
        .capa-numero { font-size: 11px; color: #9696A8; letter-spacing: 4px; text-transform: uppercase; }
        .capa-titulo { font-size: 48px; font-weight: 700; color: #FFFFFF; line-height: 1.1; margin: 0; letter-spacing: -0.02em; }
        .capa-separador { width: 80px; height: 4px; background: var(--cor-primaria); margin: 24px 0; border-radius: 2px; }
        .capa-label { font-size: 11px; color: #9696A8; letter-spacing: 3px; text-transform: uppercase; }
        .capa-cliente { font-size: 28px; font-weight: 600; color: #FFFFFF; margin: 0; }
        .capa-bottom {
          display: flex;
          justify-content: space-between;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .capa-meta { font-size: 12px; color: #9696A8; margin: 0; line-height: 1.6; }

        .secao {
          padding: 80px 60px;
          background: hsl(var(--background));
          border-bottom: 1px solid hsl(var(--border));
        }
        .secao-inner { max-width: 720px; margin: 0 auto; }
        .secao-label {
          font-size: 11px;
          color: var(--cor-primaria);
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .secao-titulo {
          font-size: 32px;
          font-weight: 700;
          color: hsl(var(--foreground));
          letter-spacing: -0.02em;
          margin: 0 0 32px 0;
        }
        .secao-conteudo {
          font-size: 15px;
          line-height: 1.7;
          color: hsl(var(--foreground));
        }
        .secao-conteudo .bn-container {
          --bn-colors-editor-background: transparent;
        }

        .resumo-invest {
          background: linear-gradient(135deg, rgba(126,48,225,0.08) 0%, rgba(126,48,225,0.02) 100%);
          border-left: 4px solid var(--cor-primaria);
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 24px;
        }
        .resumo-invest-item .label {
          font-size: 10px;
          color: hsl(var(--muted-foreground));
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: 600;
        }
        .resumo-invest-item .valor {
          font-size: 28px;
          font-weight: 700;
          color: var(--cor-primaria);
          margin-top: 4px;
          font-family: var(--font-inter-tight), var(--font-inter);
          letter-spacing: -0.02em;
        }

        .cta {
          padding: 100px 60px;
          background: linear-gradient(135deg, #0E0E14 0%, #1A0F2E 100%);
          color: #FFFFFF;
          text-align: center;
        }
        .cta-inner { max-width: 600px; margin: 0 auto; }
        .cta h2 {
          font-size: 36px;
          font-weight: 700;
          margin: 0 0 16px 0;
          letter-spacing: -0.02em;
        }
        .cta p { color: #9696A8; font-size: 15px; line-height: 1.6; margin: 0 0 32px 0; }
        .cta-acoes { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .cta-btn-aceitar { background: #10B981 !important; color: white !important; }
        .cta-btn-aceitar:hover { background: #059669 !important; }
        .cta-validade { color: #9696A8; font-size: 11px; margin-top: 24px; }

        .cta-decidida { padding: 24px; }
        .cta-decidida h2 { font-size: 32px; }
        .cta-aceita { color: #10B981; }
        .cta-recusada { color: #EF4444; }
        .cta-decidida svg { margin: 0 auto 16px; display: block; }

        .toolbar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          padding: 6px;
          background: rgba(20, 20, 28, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          z-index: 50;
        }
        .toolbar-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 11px;
          color: #E5E5EE;
          text-decoration: none;
          border-radius: 999px;
          transition: background 0.15s;
        }
        .toolbar-btn:hover { background: rgba(126, 48, 225, 0.15); color: #B794F4; }

        @media (max-width: 720px) {
          .capa, .secao, .cta { padding: 60px 28px; }
          .capa-titulo { font-size: 32px; }
          .secao-titulo { font-size: 24px; }
          .cta h2 { font-size: 28px; }
        }
      `}</style>
    </>
  );
}

function Secao({
  label,
  conteudo,
  children,
}: {
  label: string;
  conteudo: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="secao">
      <div className="secao-inner">
        <div className="secao-label">{label}</div>
        <h2 className="secao-titulo">{label}</h2>
        {children}
        <div className="secao-conteudo">
          <BlockRenderer value={conteudo} />
        </div>
      </div>
    </section>
  );
}

function ResumoInvestimento({
  valorMensal,
  valorTotal,
  duracaoMeses,
}: {
  valorMensal: number | null;
  valorTotal: number | null;
  duracaoMeses: number | null;
}) {
  if (!valorMensal && !valorTotal && !duracaoMeses) return null;
  return (
    <div className="resumo-invest">
      {valorMensal && (
        <div className="resumo-invest-item">
          <div className="label">Investimento mensal</div>
          <div className="valor">{formatBRL(valorMensal)}</div>
        </div>
      )}
      {valorTotal && (
        <div className="resumo-invest-item">
          <div className="label">Valor total</div>
          <div className="valor">{formatBRL(valorTotal)}</div>
        </div>
      )}
      {duracaoMeses && (
        <div className="resumo-invest-item">
          <div className="label">Duração</div>
          <div className="valor">{duracaoMeses} meses</div>
        </div>
      )}
    </div>
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

  async function confirmar() {
    setEnviando(true);
    try {
      const res = await fetch(`/api/propostas/${propostaId}/aceitar?token=${token}`, {
        method: "POST",
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Aceitar proposta {numero}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">
            Confirmando o aceite digital, vamos entrar em contato em até 24h com:
          </p>
          <ul className="text-sm space-y-1.5 text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
              <span>Contrato formal pra assinatura</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
              <span>Boleto/PIX da primeira fatura</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
              <span>Agenda de kickoff</span>
            </li>
          </ul>
          <p className="text-[11px] text-muted-foreground/70 pt-2">
            Este aceite registra IP e timestamp e tem validade legal como confirmação inicial.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={confirmar} disabled={enviando} className={cn("bg-emerald-600 hover:bg-emerald-700")}>
            {enviando ? "Confirmando..." : "Sim, aceito a proposta"}
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

function hasContent(jsonOrText: string): boolean {
  if (!jsonOrText) return false;
  const trimmed = jsonOrText.trim();
  if (!trimmed) return false;
  // JSON BlockNote vazio = `[{"type":"paragraph","content":""}]`
  if (trimmed.startsWith("[")) {
    try {
      const blocks = JSON.parse(trimmed) as Array<{ content?: unknown }>;
      return blocks.some((b) => {
        const c = b.content;
        if (typeof c === "string") return c.trim().length > 0;
        if (Array.isArray(c) && c.length > 0) return true;
        return false;
      });
    } catch {
      return false;
    }
  }
  return true;
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

/**
 * Escurece um hex `#RRGGBB` multiplicando cada canal por (1 - factor).
 * Usado pra gerar a variante "escura" da cor primária (gradiente da capa).
 */
function escurecer(hex: string, factor: number): string {
  return ajustar(hex, -factor);
}

function clarear(hex: string, factor: number): string {
  return ajustar(hex, factor);
}

function ajustar(hex: string, delta: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  let r = (v >> 16) & 0xff;
  let g = (v >> 8) & 0xff;
  let b = v & 0xff;
  if (delta < 0) {
    r = Math.max(0, Math.round(r * (1 + delta)));
    g = Math.max(0, Math.round(g * (1 + delta)));
    b = Math.max(0, Math.round(b * (1 + delta)));
  } else {
    r = Math.min(255, Math.round(r + (255 - r) * delta));
    g = Math.min(255, Math.round(g + (255 - g) * delta));
    b = Math.min(255, Math.round(b + (255 - b) * delta));
  }
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
