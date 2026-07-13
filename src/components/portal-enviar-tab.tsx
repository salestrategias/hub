"use client";
/**
 * Portal v4 — aba ENVIAR, com DOIS modos (dois modelos de contrato):
 *
 *  1. "Só o material" (rápido) — cliente solta arquivos + recado; a SAL
 *     produz o conteúdo. Zero campos obrigatórios além do arquivo.
 *  2. "Conteúdo pronto" (completo) — pra clientes de CONSULTORIA: o
 *     cliente publica o post/anúncio completo (título, legenda, formato,
 *     data, hashtags / plataforma, headline...) e a SAL só revisa e
 *     aprova na triagem. Nada de produção do lado da SAL.
 *
 * Os dois modos usam os mesmos endpoints de submissão (POST /posts e
 * /criativos-enviar) — o rápido manda o mínimo (servidor aplica
 * defaults), o completo manda tudo preenchido.
 *
 * Abaixo do form: "Meus envios" com o status da revisão de cada item.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Zap, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { fetchPortal } from "@/lib/portal-fetch";
import {
  UploaderArquivos,
  MinhasSubmissoes,
  type ArquivoLocal,
  type Submissao,
} from "@/components/portal-enviar-conteudo";

type TipoEnvio = "post" | "criativo";
type ModoEnvio = "rapido" | "completo";

const FORMATO_POST = [
  { v: "FEED", l: "Post estático" },
  { v: "CARROSSEL", l: "Carrossel" },
  { v: "REELS", l: "Reels / Vídeo" },
  { v: "STORIES", l: "Stories" },
];

const PLATAFORMA_CRIATIVO = [
  { v: "META_ADS", l: "Meta Ads (Face/Insta)" },
  { v: "GOOGLE_ADS", l: "Google Ads" },
  { v: "TIKTOK_ADS", l: "TikTok Ads" },
  { v: "YOUTUBE_ADS", l: "YouTube Ads" },
  { v: "LINKEDIN_ADS", l: "LinkedIn Ads" },
];

const FORMATO_CRIATIVO = [
  { v: "POST_IMAGEM", l: "Post imagem" },
  { v: "POST_VIDEO", l: "Post vídeo" },
  { v: "CARROSSEL", l: "Carrossel" },
  { v: "STORY", l: "Story" },
  { v: "REELS_AD", l: "Reels Ad" },
  { v: "RESPONSIVE_DISPLAY", l: "Display responsivo" },
  { v: "SEARCH_AD", l: "Search Ad" },
  { v: "PERFORMANCE_MAX", l: "Performance Max" },
];

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 60);
}

export function PortalEnviarTab({
  token,
  clienteNome,
}: {
  token: string;
  clienteNome: string;
}) {
  const [modo, setModo] = useState<ModoEnvio>("rapido");
  const [tipo, setTipo] = useState<TipoEnvio>("post");

  // Comum aos dois modos
  const [arquivos, setArquivos] = useState<ArquivoLocal[]>([]);
  const [texto, setTexto] = useState(""); // rápido: recado · completo: legenda/texto do anúncio
  const [processando, setProcessando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Só no modo completo
  const [titulo, setTitulo] = useState("");
  const [dataPublicacao, setDataPublicacao] = useState("");
  const [formato, setFormato] = useState("FEED");
  const [hashtags, setHashtags] = useState("");
  const [plataforma, setPlataforma] = useState("META_ADS");
  const [headline, setHeadline] = useState("");

  const [subsPosts, setSubsPosts] = useState<Submissao[]>([]);
  const [subsCriativos, setSubsCriativos] = useState<Submissao[]>([]);

  const carregarSubmissoes = useCallback(async () => {
    try {
      const [rp, rc] = await Promise.all([
        fetchPortal(`/api/p/cliente/${token}/posts`),
        fetchPortal(`/api/p/cliente/${token}/criativos-enviar`),
      ]);
      if (rp.ok) {
        const d = await rp.json().catch(() => null);
        if (Array.isArray(d)) setSubsPosts(d);
      }
      if (rc.ok) {
        const d = await rc.json().catch(() => null);
        if (Array.isArray(d)) setSubsCriativos(d);
      }
    } catch {
      /* lista é complementar */
    }
  }, [token]);

  useEffect(() => {
    void carregarSubmissoes();
  }, [carregarSubmissoes]);

  function trocarTipo(t: TipoEnvio) {
    setTipo(t);
    setFormato(t === "post" ? "FEED" : "POST_IMAGEM");
  }

  const completo = modo === "completo";

  // Validação client-side por modo
  const faltaNoCompleto = completo
    ? !titulo.trim()
      ? "Dê um título pro conteúdo"
      : tipo === "post" && !dataPublicacao
        ? "Escolha a data de publicação"
        : null
    : null;
  const vazioNoRapido = !completo && arquivos.length === 0 && texto.trim().length <= 2;
  const podeEnviar = !processando && !enviando && !faltaNoCompleto && !vazioNoRapido;

  async function enviar() {
    if (processando || enviando) return;
    if (faltaNoCompleto) {
      toast.error(faltaNoCompleto);
      return;
    }
    if (vazioNoRapido) {
      toast.error("Adicione pelo menos um arquivo ou escreva um recado");
      return;
    }
    setEnviando(true);
    try {
      const arquivosBody = arquivos.map((a, i) => ({ ...a, ordem: (i + 1) * 10 }));
      const body =
        tipo === "post"
          ? completo
            ? {
                titulo: titulo.trim(),
                legenda: texto.trim() || null,
                formato,
                dataPublicacao,
                hashtags: parseHashtags(hashtags),
                arquivos: arquivosBody,
              }
            : {
                titulo: null,
                legenda: texto.trim() || null,
                arquivos: arquivosBody,
              }
          : completo
            ? {
                titulo: titulo.trim(),
                textoPrincipal: texto.trim() || null,
                headline: headline.trim() || null,
                plataforma,
                formato,
                arquivos: arquivosBody,
              }
            : {
                titulo: null,
                textoPrincipal: texto.trim() || null,
                arquivos: arquivosBody,
              };
      const endpoint = tipo === "post" ? "posts" : "criativos-enviar";
      const res = await fetchPortal(`/api/p/cliente/${token}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao enviar");
        return;
      }
      toast.success(
        completo
          ? "Enviado! A SAL revisa e te retorna por aqui."
          : arquivos.length > 0
            ? `${arquivos.length} ${arquivos.length === 1 ? "arquivo enviado" : "arquivos enviados"}! A SAL foi avisada.`
            : "Enviado! A SAL foi avisada."
      );
      // Limpa o form pro próximo envio
      setArquivos([]);
      setTexto("");
      setTitulo("");
      setDataPublicacao("");
      setHashtags("");
      setHeadline("");
      void carregarSubmissoes();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho da aba */}
      <section className="space-y-1">
        <h1 className="font-display text-lg font-semibold leading-tight">Enviar pra SAL</h1>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {completo
            ? "Publique o conteúdo pronto — a SAL revisa e aprova."
            : "Fotos, vídeos e ideias — solte aqui que a SAL transforma em conteúdo."}
        </p>
      </section>

      {/* Modo: só material × conteúdo pronto */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModo("rapido")}
          aria-pressed={!completo}
          className={`touch-feedback rounded-xl border p-3 text-left transition-colors ${
            !completo ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
        >
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Zap className="h-3.5 w-3.5 text-primary" /> Só o material
          </span>
          <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
            você manda, a SAL produz
          </span>
        </button>
        <button
          type="button"
          onClick={() => setModo("completo")}
          aria-pressed={completo}
          className={`touch-feedback rounded-xl border p-3 text-left transition-colors ${
            completo ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
        >
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <FileCheck2 className="h-3.5 w-3.5 text-primary" /> Conteúdo pronto
          </span>
          <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
            completo, só pra SAL aprovar
          </span>
        </button>
      </div>

      {/* Tipo do conteúdo */}
      <div className="space-y-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {completo ? "É um..." : "Esse material é pra..."}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => trocarTipo("post")}
            aria-pressed={tipo === "post"}
            className={`touch-feedback rounded-xl border p-3 text-left transition-colors ${
              tipo === "post" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
          >
            <span className="block text-[13px] font-semibold">Redes sociais</span>
            <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
              posts, stories, reels
            </span>
          </button>
          <button
            type="button"
            onClick={() => trocarTipo("criativo")}
            aria-pressed={tipo === "criativo"}
            className={`touch-feedback rounded-xl border p-3 text-left transition-colors ${
              tipo === "criativo" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
          >
            <span className="block text-[13px] font-semibold">Anúncio</span>
            <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
              tráfego pago
            </span>
          </button>
        </div>
        {!completo && (
          <p className="text-[10.5px] text-muted-foreground">
            Na dúvida, deixe em &quot;Redes sociais&quot; — a SAL classifica na revisão.
          </p>
        )}
      </div>

      {/* ── Modo COMPLETO: campos do conteúdo pronto ── */}
      {completo && (
        <>
          <CampoTab label="Título">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipo === "post" ? "Ex: Promoção de inverno" : "Ex: Anúncio coleção nova"}
              className="h-11 text-base sm:text-sm"
            />
          </CampoTab>

          {tipo === "criativo" && (
            <CampoTab label="Plataforma">
              <SelectNativo value={plataforma} onChange={setPlataforma} options={PLATAFORMA_CRIATIVO} />
            </CampoTab>
          )}

          <CampoTab label="Formato">
            <SelectNativo
              value={formato}
              onChange={setFormato}
              options={tipo === "post" ? FORMATO_POST : FORMATO_CRIATIVO}
            />
          </CampoTab>

          {tipo === "post" && (
            <CampoTab label="Data de publicação">
              <Input
                type="date"
                value={dataPublicacao}
                onChange={(e) => setDataPublicacao(e.target.value)}
                className="h-11 text-base sm:text-sm"
              />
            </CampoTab>
          )}

          {tipo === "criativo" && (
            <CampoTab label="Headline (opcional)">
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Título curto do anúncio"
                className="h-11 text-base sm:text-sm"
              />
            </CampoTab>
          )}
        </>
      )}

      {/* Artes / arquivos */}
      <div className="space-y-1.5">
        {completo && (
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Artes / vídeo
          </Label>
        )}
        <UploaderArquivos
          value={arquivos}
          onChange={setArquivos}
          onProcessandoChange={setProcessando}
          grande={!completo}
        />
      </div>

      {/* Texto: recado (rápido) ou legenda/texto do anúncio (completo) */}
      <CampoTab
        label={
          completo
            ? tipo === "post"
              ? "Legenda"
              : "Texto do anúncio"
            : "Recado pra SAL (opcional)"
        }
      >
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            completo
              ? tipo === "post"
                ? "A legenda completa do post, do jeito que deve ser publicada."
                : "O texto principal do anúncio, do jeito que deve ir pro ar."
              : `Ex: "Fotos da vitrine nova, chegou coleção de inverno."`
          }
          rows={completo ? 5 : 3}
          className={`text-base sm:text-sm ${completo ? "min-h-[120px]" : "min-h-[84px]"}`}
        />
      </CampoTab>

      {/* Hashtags — só post completo */}
      {completo && tipo === "post" && (
        <CampoTab label="Hashtags (opcional)">
          <Input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#promo #inverno (separe por espaço)"
            className="h-11 text-base sm:text-sm"
          />
        </CampoTab>
      )}

      {/* Enviar */}
      <Button
        onClick={enviar}
        disabled={!podeEnviar}
        className="h-12 w-full text-sm touch-feedback"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {completo ? "Enviar pra aprovação da SAL" : "Enviar pra SAL"}
      </Button>
      {!enviando && faltaNoCompleto && (
        <p className="-mt-3 text-center text-[10.5px] text-muted-foreground">{faltaNoCompleto}.</p>
      )}
      {!enviando && vazioNoRapido && (
        <p className="-mt-3 text-center text-[10.5px] text-muted-foreground">
          Adicione pelo menos um arquivo ou escreva um recado.
        </p>
      )}

      {/* Meus envios */}
      {(subsPosts.length > 0 || subsCriativos.length > 0) && (
        <div className="space-y-5 border-t border-border pt-5">
          <MinhasSubmissoes modo="post" submissoes={subsPosts} />
          <MinhasSubmissoes modo="criativo" submissoes={subsCriativos} />
        </div>
      )}

      {subsPosts.length === 0 && subsCriativos.length === 0 && (
        <Card>
          <CardContent className="p-5 text-center text-[12px] text-muted-foreground">
            O que você enviar aparece aqui com o status da revisão
            (Em revisão → Aprovado ou Ajuste).
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CampoTab({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Select nativo estilizado como Input — melhor pra mobile/touch que um
 * dropdown custom (evita conflito de portais/scroll).
 */
function SelectNativo({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-11 sm:h-10 w-full items-center rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}
