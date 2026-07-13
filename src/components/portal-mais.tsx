"use client";
/**
 * MAIS v5 — Briefings, Reuniões, Tarefas e o canal direto com a SAL.
 * (Relatórios ganhou aba própria — Resultados.)
 *
 * Menu em lista → subview com voltar. As subviews reusam os componentes
 * existentes sem mudança.
 */
import { useState } from "react";
import {
  Mic,
  ClipboardList,
  ListChecks,
  ChevronRight,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PortalReunioes } from "@/components/portal-reunioes";
import { PortalTarefas } from "@/components/portal-tarefas";
import { PortalBriefing } from "@/components/portal-briefing";

type Secao = "menu" | "reunioes" | "briefings" | "tarefas";

const WHATSAPP_SAL = "5551993380278";

export function PortalMais({
  token,
  clienteNome,
  corMarca,
  permissoes,
  briefingsPendentes,
  temBriefings,
  onPendenciasMudaram,
}: {
  token: string;
  clienteNome: string;
  corMarca: string;
  permissoes: {
    verTarefas: boolean;
    verReunioes: boolean;
  };
  briefingsPendentes: number;
  temBriefings: boolean;
  onPendenciasMudaram?: () => void;
}) {
  const [secao, setSecao] = useState<Secao>("menu");

  const itens: {
    id: Secao;
    label: string;
    descricao: string;
    icon: typeof Mic;
    visivel: boolean;
    badge?: number;
  }[] = [
    {
      id: "briefings",
      label: "Briefings",
      descricao: "perguntas da SAL pra afinar sua estratégia",
      icon: ClipboardList,
      visivel: temBriefings,
      badge: briefingsPendentes,
    },
    {
      id: "reunioes",
      label: "Reuniões",
      descricao: "resumos e combinados das conversas",
      icon: Mic,
      visivel: permissoes.verReunioes,
    },
    {
      id: "tarefas",
      label: "Tarefas",
      descricao: "no que a SAL está trabalhando pra você",
      icon: ListChecks,
      visivel: permissoes.verTarefas,
    },
  ];
  const visiveis = itens.filter((i) => i.visivel);

  if (secao !== "menu") {
    const atual = itens.find((i) => i.id === secao);
    return (
      <div className="p5-screen space-y-4">
        <button
          type="button"
          onClick={() => setSecao("menu")}
          className="touch-feedback flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <h1 className="font-display text-[22px] font-extrabold tracking-tight leading-tight">
          {atual?.label}
        </h1>
        {secao === "reunioes" && <PortalReunioes token={token} />}
        {secao === "tarefas" && <PortalTarefas token={token} />}
        {secao === "briefings" && (
          <PortalBriefing
            token={token}
            clienteNome={clienteNome}
            onPendenciasMudaram={onPendenciasMudaram}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p5-screen space-y-4">
      <section className="pt-1">
        <h1 className="font-display text-[26px] font-extrabold tracking-tight leading-tight">Mais</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">
          Reuniões, briefings e tudo que a SAL registra pra você.
        </p>
      </section>

      {visiveis.length > 0 && (
        <Card className="p5-card">
          <CardContent className="divide-y divide-border p-0">
            {visiveis.map((i) => {
              const Icon = i.icon;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setSecao(i.id)}
                  className="touch-feedback flex w-full items-center gap-3 px-4 py-4 text-left"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                    style={{ background: `color-mix(in srgb, ${corMarca} 12%, transparent)` }}
                  >
                    <Icon className="h-[18px] w-[18px]" style={{ color: corMarca }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13.5px] font-bold leading-tight">
                      {i.label}
                      {!!i.badge && i.badge > 0 && (
                        <span
                          className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white"
                          style={{ background: corMarca }}
                        >
                          {i.badge > 9 ? "9+" : i.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                      {i.descricao}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Contato direto */}
      <section>
        <h2 className="mb-2.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[.09em] text-muted-foreground/80">
          Fale com a gente
        </h2>
        <a
          href={`https://wa.me/${WHATSAPP_SAL}?text=${encodeURIComponent(
            `Olá! Sou da ${clienteNome} e estou falando pelo portal.`
          )}`}
          target="_blank"
          rel="noreferrer"
          className="touch-feedback block"
        >
          <Card className="p5-card">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-emerald-500/12">
                <MessageCircle className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold leading-tight">
                  WhatsApp da SAL
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                  dúvidas, urgências ou aquele papo rápido
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </CardContent>
          </Card>
        </a>
      </section>

      <p className="pt-2 text-center text-[10.5px] text-muted-foreground/70">
        Portal do Cliente · SAL Estratégias de Marketing
      </p>
    </div>
  );
}
