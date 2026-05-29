"use client";
/**
 * PropostaDocumento — corpo "documento" puro da proposta.
 *
 * Extraído de `proposta-publica.tsx` pra ser reusado por:
 *  - a página pública (`proposta-publica.tsx`) — com chrome interativo
 *    (CTA aceitar/recusar, toolbar, TOC, CTA fixo) passado via `children`.
 *  - a página de print (`/p/proposta/print/[id]`) — render limpo A4 pro
 *    Chromium headless converter em PDF fiel à web (`modoApresentacao`).
 *
 * Renderiza o MESMO HTML+CSS da pública (capa + sequência intercalada de
 * seções de texto e blocos visuais), e detém TODO o styled-jsx global —
 * assim pública e print ficam pixel-idênticas, sem duplicação de estilo.
 *
 * Quando `modoApresentacao` é true:
 *  - esconde o banner de "versão antiga" (chrome de navegação interna);
 *  - não renderiza `children` (toolbar/TOC/CTA/CTA fixo/diálogos ficam de fora);
 *  - aplica estilos de print (A4, fundo branco amigável, print-color-adjust)
 *    quando `print` também é true.
 */
import { BlockRenderer } from "@/components/editor";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { normalizarExtras, type PropostaExtras } from "@/lib/proposta-blocos";
import {
  PacotesPublico,
  CasesPublico,
  KpisPublico,
  EquipePublico,
  FaqPublico,
  TimelinePublico,
  GarantiasPublico,
} from "@/components/proposta-publica-blocos";

export type PropostaDocumentoData = {
  id: string;
  numero: string;
  titulo: string;
  clienteNome: string;
  clienteEmail: string | null;
  logoUrl: string | null;
  corPrimaria: string | null;
  capaImagemUrl: string | null;
  extras: unknown;
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
  aceiteNome: string | null;
  aceiteCpfCnpj: string | null;
  autorNome: string | null;
  autorEmail: string | null;
  versao: number;
  versaoAtual: boolean;
  versaoAtualToken: string | null;
};

export function PropostaDocumento({
  proposta,
  modoApresentacao = false,
  print = false,
  children,
}: {
  proposta: PropostaDocumentoData;
  /** Esconde chrome interativo + banner de versão (usado pela página de print). */
  modoApresentacao?: boolean;
  /** Aplica CSS de print (A4, fundo branco). Só faz sentido com modoApresentacao. */
  print?: boolean;
  /** Chrome interativo da pública (CTA, toolbar, TOC, CTA fixo, diálogos). */
  children?: React.ReactNode;
}) {
  const corPrim = proposta.corPrimaria ?? "#7E30E1";
  const corPrimEscura = escurecer(corPrim, 0.3);
  const corPrimClara = clarear(corPrim, 0.4);
  const extras = normalizarExtras(proposta.extras);

  return (
    <div
      className={cn("proposta-publica", modoApresentacao && "proposta-print")}
      style={
        {
          // Custom properties consumidas pelo CSS global abaixo
          ["--cor-primaria" as string]: corPrim,
          ["--cor-primaria-escura" as string]: corPrimEscura,
          ["--cor-primaria-clara" as string]: corPrimClara,
        } as React.CSSProperties
      }
    >
      {!modoApresentacao && !proposta.versaoAtual && (
        <div className="banner-versao-antiga" role="alert">
          <div className="banner-versao-antiga-inner">
            <AlertTriangle className="h-5 w-5" />
            <div style={{ flex: 1 }}>
              <strong>Esta proposta foi revisada.</strong> Você está vendo a versão {proposta.versao}
              {" "}— existe uma versão mais recente disponível.
            </div>
            {proposta.versaoAtualToken && (
              <a
                href={`/p/proposta/${proposta.versaoAtualToken}`}
                className="banner-versao-antiga-cta"
              >
                Ver versão atual →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Capa */}
      <section
        className={cn("capa", proposta.capaImagemUrl && "capa-com-hero")}
        style={
          proposta.capaImagemUrl
            ? ({ ["--capa-hero-url" as string]: `url("${proposta.capaImagemUrl}")` } as React.CSSProperties)
            : undefined
        }
      >
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

      {/* Sequência interceptada: seções texto + blocos extras nas posições estratégicas */}
      {renderizarSequencia(proposta, extras)}

      {/* Chrome interativo (CTA aceite/recusa, toolbar, TOC, CTA fixo) — só na pública */}
      {!modoApresentacao && children}

      <style dangerouslySetInnerHTML={{ __html: `
        .proposta-publica {
          max-width: 920px;
          margin: 0 auto;
          padding: 0;
          font-family: var(--font-inter), Inter, system-ui, sans-serif;
        }
        /* Banner avisando que a proposta sendo visualizada não é a versão atual */
        .banner-versao-antiga {
          background: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%);
          color: #FFFFFF;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 500;
        }
        .banner-versao-antiga-inner {
          max-width: 920px;
          margin: 0 auto;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .banner-versao-antiga strong {
          font-weight: 700;
        }
        .banner-versao-antiga-cta {
          background: rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.4);
          transition: background 0.15s;
        }
        .banner-versao-antiga-cta:hover {
          background: rgba(255, 255, 255, 0.3);
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
        /* Hero opcional — substitui gradiente roxo por imagem custom com overlay */
        .capa-com-hero {
          background: #000 !important;
        }
        .capa-com-hero::before {
          background-image:
            linear-gradient(180deg, rgba(14,14,20,0.55) 0%, rgba(14,14,20,0.85) 100%),
            var(--capa-hero-url);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
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
        .cta-assinatura {
          margin-top: 32px;
          padding: 22px 28px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 14px;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
          text-align: center;
        }
        .cta-assinatura-titulo {
          font-size: 10px;
          color: #10B981;
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .cta-assinatura-linha { color: #E5E5EE; font-size: 16px; font-weight: 600; line-height: 1.5; }
        .cta-assinatura-doc { font-family: var(--font-mono); font-size: 13px; color: #9696A8; font-weight: 500; }
        .cta-assinatura-sub { font-size: 11px; color: #9696A8; font-weight: 400; margin-top: 6px; }

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

        /* ──────────────────────────────────────────────────────────────
           BLOCOS EXTRAS
           ────────────────────────────────────────────────────────────── */
        .bloco {
          padding: 80px 60px;
          background: #0E0E14;
          color: #E5E5EE;
          position: relative;
        }
        .bloco-pacotes { background: linear-gradient(180deg, #0E0E14 0%, #1A0F2E 100%); }
        .bloco-cases { background: #14141C; }
        .bloco-kpis { background: linear-gradient(135deg, #14141C 0%, #1A0F2E 100%); }
        .bloco-equipe { background: #0E0E14; }
        .bloco-faq { background: #14141C; }
        .bloco-inner { max-width: 920px; margin: 0 auto; }
        .bloco-titulo {
          font-size: 32px;
          font-weight: 700;
          color: #FFFFFF;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }
        .bloco-subtitulo {
          color: #9696A8;
          font-size: 15px;
          margin: 0 0 40px 0;
        }

        /* PACOTES */
        .pacotes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }
        .pacote {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
          transition: transform 0.2s, border-color 0.2s;
        }
        .pacote:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.15); }
        .pacote-destaque {
          border: 2px solid var(--cor-primaria);
          background: linear-gradient(180deg, rgba(126,48,225,0.08) 0%, rgba(255,255,255,0.03) 100%);
          transform: scale(1.02);
        }
        .pacote-destaque:hover { transform: scale(1.02) translateY(-4px); }
        .pacote-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--cor-primaria);
          color: #FFFFFF;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .pacote-header { display: flex; flex-direction: column; gap: 6px; }
        .pacote-subtitulo {
          font-size: 11px;
          color: #9696A8;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .pacote-nome { font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 0; }
        .pacote-valor { font-size: 28px; font-weight: 700; color: var(--cor-primaria); margin: 4px 0 0 0; letter-spacing: -0.02em; }
        .pacote-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .pacote-feature { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.4; }
        .pacote-feature-destaque { font-weight: 600; color: #FFFFFF; }
        .pacote-check { color: #10B981; flex-shrink: 0; margin-top: 1px; }
        .pacote-x { color: #6B7280; flex-shrink: 0; margin-top: 1px; opacity: 0.5; }
        .pacote-cta {
          display: block;
          margin-top: auto;
          padding: 12px;
          background: rgba(126, 48, 225, 0.1);
          border: 1px solid rgba(126, 48, 225, 0.2);
          border-radius: 10px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--cor-primaria);
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s, border-color 0.15s;
        }
        .pacote-cta:hover {
          background: rgba(126, 48, 225, 0.18);
          border-color: rgba(126, 48, 225, 0.45);
          transform: translateY(-1px);
        }
        .pacote-destaque .pacote-cta {
          background: var(--cor-primaria);
          color: #FFFFFF;
          border-color: transparent;
        }
        .pacote-destaque .pacote-cta:hover {
          background: var(--cor-primaria-escura);
          filter: brightness(1.05);
        }

        /* CASES */
        .cases-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
        }
        .case-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform 0.2s, border-color 0.2s;
        }
        .case-card:hover { transform: translateY(-4px); border-color: var(--cor-primaria); }
        .case-metrica {
          font-size: 40px;
          font-weight: 800;
          color: var(--cor-primaria);
          line-height: 1;
          margin-bottom: 8px;
          letter-spacing: -0.04em;
          font-family: var(--font-inter-tight), var(--font-inter);
        }
        .case-cliente { font-size: 17px; font-weight: 700; color: #FFFFFF; margin: 0; }
        .case-segmento { font-size: 11px; color: #9696A8; text-transform: uppercase; letter-spacing: 1.5px; margin: 0; }
        .case-resultado { font-size: 14px; color: #E5E5EE; line-height: 1.5; margin: 8px 0 0 0; font-weight: 500; }
        .case-descricao { font-size: 13px; color: #9696A8; line-height: 1.6; margin: 4px 0 0 0; }

        /* KPIs */
        .kpis-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .kpi-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 24px 20px;
          text-align: center;
          transition: transform 0.2s, border-color 0.2s;
        }
        .kpi-card:hover { transform: translateY(-3px); border-color: var(--cor-primaria); }
        .kpi-label { font-size: 11px; color: #9696A8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
        .kpi-valores { display: inline-flex; align-items: baseline; gap: 8px; }
        .kpi-atual { font-size: 22px; color: #6B7280; text-decoration: line-through; font-weight: 600; }
        .kpi-arrow { color: var(--cor-primaria); }
        .kpi-meta { font-size: 34px; font-weight: 800; color: var(--cor-primaria); letter-spacing: -0.02em; }
        .kpi-variacao { font-size: 13px; color: #10B981; margin-top: 6px; font-weight: 700; }

        /* EQUIPE */
        .equipe-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 28px;
        }
        .membro-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
        }
        .membro-foto {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          overflow: hidden;
          background: rgba(255,255,255,0.05);
          border: 2px solid var(--cor-primaria);
          margin-bottom: 8px;
        }
        .membro-foto img { width: 100%; height: 100%; object-fit: cover; }
        .membro-foto-fallback {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 36px; font-weight: 700; color: var(--cor-primaria);
        }
        .membro-nome { font-size: 17px; font-weight: 700; color: #FFFFFF; margin: 0; }
        .membro-cargo { font-size: 12px; color: var(--cor-primaria); text-transform: uppercase; letter-spacing: 1.5px; margin: 0; }
        .membro-bio { font-size: 13px; color: #9696A8; line-height: 1.5; margin: 8px 0 0 0; }
        .membro-linkedin {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #B794F4;
          text-decoration: none;
          font-size: 11px;
          margin-top: 6px;
          padding: 4px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          transition: background 0.15s;
        }
        .membro-linkedin:hover { background: rgba(255,255,255,0.05); }

        /* TIMELINE */
        .bloco-timeline { background: linear-gradient(135deg, #0E0E14 0%, #14141C 100%); }
        .timeline-horizontal {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 24px;
          margin-top: 24px;
          position: relative;
        }
        .timeline-horizontal .timeline-item {
          flex: 1 1 200px;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
        }
        .timeline-vertical {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 24px;
          padding-left: 24px;
          position: relative;
        }
        .timeline-vertical::before {
          content: "";
          position: absolute;
          left: 12px;
          top: 12px;
          bottom: 12px;
          width: 2px;
          background: rgba(255,255,255,0.1);
        }
        .timeline-vertical .timeline-item {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          position: relative;
        }
        .timeline-vertical .timeline-marker { margin-left: -36px; }
        .timeline-marker {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9696A8;
          flex-shrink: 0;
          z-index: 2;
          position: relative;
        }
        .timeline-concluido .timeline-marker {
          background: var(--cor-primaria);
          border-color: var(--cor-primaria);
          color: #FFFFFF;
        }
        .timeline-em_andamento .timeline-marker {
          border-color: var(--cor-primaria);
          background: rgba(126,48,225,0.15);
          color: var(--cor-primaria);
        }
        .timeline-pulse {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--cor-primaria);
          animation: timeline-pulse 1.5s ease-in-out infinite;
        }
        @keyframes timeline-pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .timeline-line {
          position: absolute;
          top: 16px;
          left: calc(50% + 16px);
          right: calc(-50% + 16px);
          height: 2px;
          background: rgba(255,255,255,0.1);
          z-index: 1;
        }
        .timeline-concluido + .timeline-item .timeline-line { background: var(--cor-primaria); }
        .timeline-content { margin-top: 12px; }
        .timeline-vertical .timeline-content { margin-top: 0; flex: 1; }
        .timeline-periodo {
          font-size: 10px;
          color: var(--cor-primaria);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .timeline-titulo { font-size: 15px; font-weight: 700; color: #FFFFFF; margin: 0 0 4px 0; }
        .timeline-descricao { font-size: 12.5px; color: #9696A8; line-height: 1.5; margin: 0; }

        /* GARANTIAS */
        .bloco-garantias { background: linear-gradient(180deg, #14141C 0%, #0E0E14 100%); }
        .garantias-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }
        .garantia-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 22px 20px;
          text-align: center;
          transition: transform 0.2s, border-color 0.2s;
        }
        .garantia-card:hover { transform: translateY(-3px); border-color: var(--cor-primaria); }
        .garantia-icone { font-size: 36px; line-height: 1; margin-bottom: 10px; }
        .garantia-titulo { font-size: 14px; font-weight: 700; color: #FFFFFF; margin: 0 0 4px 0; }
        .garantia-descricao { font-size: 12px; color: #9696A8; line-height: 1.5; margin: 0; }

        /* FAQ */
        .faq-lista { display: flex; flex-direction: column; gap: 8px; }
        .faq-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 18px 22px;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          color: inherit;
          font-family: inherit;
        }
        .faq-item:hover { border-color: rgba(255,255,255,0.15); }
        .faq-item-aberta { border-color: var(--cor-primaria); background: rgba(126,48,225,0.05); }
        .faq-pergunta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          font-size: 15px;
          font-weight: 600;
          color: #FFFFFF;
        }
        .faq-chevron { color: #9696A8; transition: transform 0.2s; flex-shrink: 0; }
        .faq-chevron-aberta { transform: rotate(180deg); color: var(--cor-primaria); }
        .faq-resposta {
          color: #9696A8;
          font-size: 14px;
          line-height: 1.6;
          margin: 12px 0 0 0;
        }

        /* ──────────────────────────────────────────────────────────────
           TOC LATERAL FIXO (desktop only)
           ────────────────────────────────────────────────────────────── */
        .toc {
          position: fixed;
          left: max(16px, calc((100vw - 920px) / 2 - 200px));
          top: 50%;
          transform: translateY(-50%);
          background: rgba(20,20,28,0.85);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 12px 8px;
          z-index: 30;
          max-width: 170px;
          max-height: 70vh;
          overflow-y: auto;
        }
        .toc-header {
          font-size: 9.5px;
          color: #9696A8;
          text-transform: uppercase;
          letter-spacing: 2px;
          padding: 0 10px 8px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .toc-lista { list-style: none; margin: 8px 0 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .toc-link {
          display: block;
          padding: 7px 10px;
          font-size: 12px;
          color: #9696A8;
          text-decoration: none;
          border-radius: 6px;
          border-left: 2px solid transparent;
          transition: color 0.15s, background 0.15s, border-color 0.15s;
        }
        .toc-link:hover { color: #E5E5EE; background: rgba(255,255,255,0.03); }
        .toc-link-ativo {
          color: var(--cor-primaria);
          font-weight: 600;
          border-left-color: var(--cor-primaria);
          background: rgba(126,48,225,0.08);
        }
        @media (max-width: 1280px) { .toc { display: none; } }

        /* ──────────────────────────────────────────────────────────────
           CTA FIXO NO RODAPÉ (sempre visível, mobile-first)
           ────────────────────────────────────────────────────────────── */
        .cta-fixo {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(20,20,28,0.92);
          backdrop-filter: blur(14px);
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 12px 24px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
          z-index: 40;
        }
        .cta-fixo-inner {
          max-width: 920px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cta-fixo-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0px; }
        .cta-fixo-numero { font-size: 10px; color: #9696A8; text-transform: uppercase; letter-spacing: 1.5px; }
        .cta-fixo-valor { font-size: 18px; font-weight: 700; color: #FFFFFF; line-height: 1.2; }
        .cta-fixo-valor-sub { font-size: 11px; color: #9696A8; font-weight: 500; margin-left: 4px; }
        .cta-fixo-acoes { display: flex; gap: 8px; flex-shrink: 0; }
        .cta-fixo-btn-recusar { color: #E5E5EE !important; border-color: rgba(255,255,255,0.15) !important; background: transparent !important; }
        .cta-fixo-btn-aceitar { background: #10B981 !important; color: white !important; border: none !important; }
        .cta-fixo-btn-aceitar:hover { background: #059669 !important; }

        /* Ajusta toolbar/proposta-publica pra não sobrepor o CTA fixo */
        .toolbar { bottom: 84px !important; }
        .proposta-publica { padding-bottom: 80px; }
        @media (max-width: 720px) {
          .toolbar { bottom: 100px !important; }
          .bloco { padding: 60px 28px; }
          .bloco-titulo { font-size: 24px; }
          .pacote { padding: 24px 20px; }
          .case-metrica { font-size: 32px; }
          .kpi-meta { font-size: 28px; }
        }
      `}} />

      {/* ──────────────────────────────────────────────────────────────
          MODO PRINT (documento limpo pro Chromium headless → PDF)
          Só injetado quando `print` é true (página /p/proposta/print/[id]).
          - largura cheia (margens vêm do page.pdf do puppeteer);
          - desativa animações/hover que não fazem sentido no papel;
          - preserva cores de fundo escuras (print-color-adjust);
          - evita cortar cards no meio entre páginas A4.
          ────────────────────────────────────────────────────────────── */}
      {print && (
        <style dangerouslySetInnerHTML={{ __html: `
          .proposta-print {
            max-width: 100%;
            padding-bottom: 0;
          }
          .proposta-print .capa {
            min-height: auto;
            padding: 72px 56px;
          }
          .proposta-print .pacote,
          .proposta-print .pacote-destaque,
          .proposta-print .case-card,
          .proposta-print .kpi-card,
          .proposta-print .garantia-card,
          .proposta-print .membro-card,
          .proposta-print .faq-item {
            transition: none;
            transform: none;
          }
          .proposta-print .timeline-pulse {
            animation: none;
          }
          html, body, .proposta-print {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #FFFFFF;
          }
          .secao, .bloco, .capa, .cta {
            break-inside: avoid;
          }
        `}} />
      )}
    </div>
  );
}

function Secao({
  label,
  conteudo,
  id,
  children,
}: {
  label: string;
  conteudo: string;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="secao" id={id}>
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

// ─── Sequência intercalada de seções + blocos extras ──────────────────

type PropostaParaRender = {
  id: string;
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
};

function renderizarSequencia(proposta: PropostaParaRender, extras: PropostaExtras) {
  const nodes: React.ReactNode[] = [];

  // Capa custom (apresentação)
  if (proposta.capa && hasContent(proposta.capa)) {
    nodes.push(<Secao key="capa" id="apresentacao" label="Apresentação" conteudo={proposta.capa} />);
  }

  // Diagnóstico
  if (proposta.diagnostico && hasContent(proposta.diagnostico)) {
    nodes.push(
      <Secao key="diagnostico" id="diagnostico" label="Diagnóstico" conteudo={proposta.diagnostico} />
    );
  }

  // BLOCO: Cases (após diagnóstico — prova social)
  if (extras.cases?.visivel) {
    nodes.push(<CasesPublico key="cases" bloco={extras.cases} />);
  }

  // Objetivo
  if (proposta.objetivo && hasContent(proposta.objetivo)) {
    nodes.push(<Secao key="objetivo" id="objetivo" label="Objetivo" conteudo={proposta.objetivo} />);
  }

  // BLOCO: KPIs (após objetivo — metas SMART)
  if (extras.kpis?.visivel) {
    nodes.push(<KpisPublico key="kpis" bloco={extras.kpis} />);
  }

  // Escopo
  if (proposta.escopo && hasContent(proposta.escopo)) {
    nodes.push(
      <Secao key="escopo" id="escopo" label="Estratégia & escopo" conteudo={proposta.escopo} />
    );
  }

  // Cronograma (texto OU timeline visual)
  if (extras.timeline?.visivel) {
    nodes.push(<TimelinePublico key="timeline" bloco={extras.timeline} />);
  } else if (proposta.cronograma && hasContent(proposta.cronograma)) {
    nodes.push(
      <Secao key="cronograma" id="cronograma" label="Cronograma" conteudo={proposta.cronograma} />
    );
  }

  // Investimento + resumo financeiro
  if (proposta.investimento && hasContent(proposta.investimento)) {
    nodes.push(
      <Secao key="investimento" id="investimento" label="Investimento" conteudo={proposta.investimento}>
        <ResumoInvestimento
          valorMensal={proposta.valorMensal}
          valorTotal={proposta.valorTotal}
          duracaoMeses={proposta.duracaoMeses}
        />
      </Secao>
    );
  }

  // BLOCO: Pacotes (após investimento — comparativo)
  if (extras.pacotes?.visivel) {
    nodes.push(<PacotesPublico key="pacotes" bloco={extras.pacotes} />);
  }

  // BLOCO: Garantias (após investimento/pacotes — antes dos próximos passos)
  if (extras.garantias?.visivel) {
    nodes.push(<GarantiasPublico key="garantias" bloco={extras.garantias} />);
  }

  // Próximos passos
  if (proposta.proximosPassos && hasContent(proposta.proximosPassos)) {
    nodes.push(
      <Secao
        key="proximos"
        id="proximos-passos"
        label="Próximos passos"
        conteudo={proposta.proximosPassos}
      />
    );
  }

  // Termos
  if (proposta.termos && hasContent(proposta.termos)) {
    nodes.push(<Secao key="termos" id="termos" label="Termos & condições" conteudo={proposta.termos} />);
  }

  // BLOCO: Equipe (antes do CTA — humaniza)
  if (extras.equipe?.visivel) {
    nodes.push(<EquipePublico key="equipe" bloco={extras.equipe} />);
  }

  // BLOCO: FAQ (antes do CTA — mata objeções)
  if (extras.faq?.visivel) {
    nodes.push(<FaqPublico key="faq" bloco={extras.faq} />);
  }

  return nodes;
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

export function hasContent(jsonOrText: string): boolean {
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

export function formatBRL(n: number): string {
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
