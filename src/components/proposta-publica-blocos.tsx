"use client";
/**
 * Renderização pública dos 5 blocos extras de proposta.
 *
 * Cada componente recebe o bloco direto e renderiza HTML+CSS-in-JS
 * estilizado, usando `var(--cor-primaria)` pra herdar a cor da proposta.
 *
 * Estilos definidos em proposta-publica.tsx (styled-jsx global).
 */
import { useState } from "react";
import { Check, X, Star, ChevronDown, Linkedin, TrendingUp, CheckCircle2, Circle } from "lucide-react";
import type {
  BlocoPacotes,
  BlocoCases,
  BlocoKpis,
  BlocoEquipe,
  BlocoFaq,
  BlocoTimeline,
  BlocoGarantias,
} from "@/lib/proposta-blocos";

// ─── PACOTES ──────────────────────────────────────────────────────────

export function PacotesPublico({ bloco }: { bloco: BlocoPacotes }) {
  if (!bloco.visivel || bloco.pacotes.length === 0) return null;
  return (
    <section className="bloco bloco-pacotes" id="pacotes">
      <div className="bloco-inner">
        <h2 className="bloco-titulo">{bloco.titulo}</h2>
        {bloco.subtitulo && <p className="bloco-subtitulo">{bloco.subtitulo}</p>}
        <div className="pacotes-grid">
          {bloco.pacotes.map((p) => (
            <div key={p.id} className={`pacote ${p.destaque ? "pacote-destaque" : ""}`}>
              {p.destaque && (
                <span className="pacote-badge">
                  <Star className="h-3 w-3" /> Recomendado
                </span>
              )}
              <div className="pacote-header">
                {p.subtitulo && <span className="pacote-subtitulo">{p.subtitulo}</span>}
                <h3 className="pacote-nome">{p.nome}</h3>
                <p className="pacote-valor">{p.valor}</p>
              </div>
              <ul className="pacote-features">
                {p.features.map((f, idx) => (
                  <li key={idx} className={`pacote-feature ${f.destaque ? "pacote-feature-destaque" : ""}`}>
                    {f.incluso ? (
                      <Check className="h-4 w-4 pacote-check" />
                    ) : (
                      <X className="h-4 w-4 pacote-x" />
                    )}
                    <span>{f.texto}</span>
                  </li>
                ))}
              </ul>
              {p.cta && <div className="pacote-cta">{p.cta}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CASES ────────────────────────────────────────────────────────────

export function CasesPublico({ bloco }: { bloco: BlocoCases }) {
  if (!bloco.visivel || bloco.cases.length === 0) return null;
  return (
    <section className="bloco bloco-cases" id="cases">
      <div className="bloco-inner">
        <h2 className="bloco-titulo">{bloco.titulo}</h2>
        {bloco.subtitulo && <p className="bloco-subtitulo">{bloco.subtitulo}</p>}
        <div className="cases-grid">
          {bloco.cases.map((c) => (
            <div key={c.id} className="case-card">
              {c.metricaPrincipal && <div className="case-metrica">{c.metricaPrincipal}</div>}
              <h3 className="case-cliente">{c.cliente}</h3>
              {c.segmento && <p className="case-segmento">{c.segmento}</p>}
              <p className="case-resultado">{c.resultado}</p>
              {c.descricao && <p className="case-descricao">{c.descricao}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── KPIs ─────────────────────────────────────────────────────────────

export function KpisPublico({ bloco }: { bloco: BlocoKpis }) {
  if (!bloco.visivel || bloco.kpis.length === 0) return null;
  return (
    <section className="bloco bloco-kpis" id="kpis">
      <div className="bloco-inner">
        <h2 className="bloco-titulo">{bloco.titulo}</h2>
        {bloco.subtitulo && <p className="bloco-subtitulo">{bloco.subtitulo}</p>}
        <div className="kpis-grid">
          {bloco.kpis.map((k) => (
            <div key={k.id} className="kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-valores">
                {k.valorAtual && (
                  <>
                    <span className="kpi-atual">{k.valorAtual}</span>
                    <TrendingUp className="kpi-arrow h-4 w-4" />
                  </>
                )}
                <span className="kpi-meta">{k.valorMeta}</span>
              </div>
              {k.variacao && <div className="kpi-variacao">{k.variacao}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── EQUIPE ───────────────────────────────────────────────────────────

export function EquipePublico({ bloco }: { bloco: BlocoEquipe }) {
  if (!bloco.visivel || bloco.membros.length === 0) return null;
  return (
    <section className="bloco bloco-equipe" id="equipe">
      <div className="bloco-inner">
        <h2 className="bloco-titulo">{bloco.titulo}</h2>
        {bloco.subtitulo && <p className="bloco-subtitulo">{bloco.subtitulo}</p>}
        <div className="equipe-grid">
          {bloco.membros.map((m) => (
            <div key={m.id} className="membro-card">
              <div className="membro-foto">
                {m.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.fotoUrl} alt={m.nome} />
                ) : (
                  <div className="membro-foto-fallback">{m.nome.charAt(0)}</div>
                )}
              </div>
              <h3 className="membro-nome">{m.nome}</h3>
              <p className="membro-cargo">{m.cargo}</p>
              {m.bio && <p className="membro-bio">{m.bio}</p>}
              {m.linkedinUrl && (
                <a
                  href={m.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="membro-linkedin"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TIMELINE (cronograma visual) ─────────────────────────────────────

export function TimelinePublico({ bloco }: { bloco: BlocoTimeline }) {
  if (!bloco.visivel || bloco.marcos.length === 0) return null;
  const horizontal = bloco.orientacao !== "vertical";

  return (
    <section className="bloco bloco-timeline" id="timeline">
      <div className="bloco-inner">
        <h2 className="bloco-titulo">{bloco.titulo}</h2>
        {bloco.subtitulo && <p className="bloco-subtitulo">{bloco.subtitulo}</p>}

        <div className={horizontal ? "timeline-horizontal" : "timeline-vertical"}>
          {bloco.marcos.map((m, idx) => {
            const status = m.status ?? "pendente";
            return (
              <div key={m.id} className={`timeline-item timeline-${status}`}>
                <div className="timeline-marker">
                  {status === "concluido" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : status === "em_andamento" ? (
                    <span className="timeline-pulse" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                {horizontal && idx < bloco.marcos.length - 1 && <div className="timeline-line" />}
                <div className="timeline-content">
                  <div className="timeline-periodo">{m.periodo}</div>
                  <h3 className="timeline-titulo">{m.titulo}</h3>
                  {m.descricao && <p className="timeline-descricao">{m.descricao}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── GARANTIAS (selos de confiança) ───────────────────────────────────

export function GarantiasPublico({ bloco }: { bloco: BlocoGarantias }) {
  if (!bloco.visivel || bloco.garantias.length === 0) return null;
  return (
    <section className="bloco bloco-garantias" id="garantias">
      <div className="bloco-inner">
        <h2 className="bloco-titulo">{bloco.titulo}</h2>
        {bloco.subtitulo && <p className="bloco-subtitulo">{bloco.subtitulo}</p>}
        <div className="garantias-grid">
          {bloco.garantias.map((g) => (
            <div key={g.id} className="garantia-card">
              <div className="garantia-icone">{g.icone}</div>
              <h3 className="garantia-titulo">{g.titulo}</h3>
              {g.descricao && <p className="garantia-descricao">{g.descricao}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────

export function FaqPublico({ bloco }: { bloco: BlocoFaq }) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  if (!bloco.visivel || bloco.perguntas.length === 0) return null;

  function toggle(id: string) {
    setAbertas((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="bloco bloco-faq" id="faq">
      <div className="bloco-inner">
        <h2 className="bloco-titulo">{bloco.titulo}</h2>
        {bloco.subtitulo && <p className="bloco-subtitulo">{bloco.subtitulo}</p>}
        <div className="faq-lista">
          {bloco.perguntas.map((f) => {
            const aberta = abertas.has(f.id);
            return (
              <button
                key={f.id}
                className={`faq-item ${aberta ? "faq-item-aberta" : ""}`}
                onClick={() => toggle(f.id)}
                aria-expanded={aberta}
              >
                <div className="faq-pergunta">
                  <span>{f.pergunta}</span>
                  <ChevronDown className={`faq-chevron h-4 w-4 ${aberta ? "faq-chevron-aberta" : ""}`} />
                </div>
                {aberta && <p className="faq-resposta">{f.resposta}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
