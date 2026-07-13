"use client";
/**
 * Portal v4 — aba MAIS: reúne as áreas de consulta (Reuniões, Relatórios,
 * Briefings, Tarefas) que antes disputavam espaço na bottom-nav, mais o
 * contato direto com a SAL.
 *
 * Padrão de navegação: menu em lista → subview com botão voltar. As
 * subviews reusam os componentes existentes sem mudança.
 */
import { useState } from "react";
import {
  Mic,
  BarChart3,
  ClipboardList,
  ListChecks,
  ChevronRight,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PortalReunioes } from "@/components/portal-reunioes";
import { PortalRelatorios } from "@/components/portal-relatorios";
import { PortalTarefas } from "@/components/portal-tarefas";
import { PortalBriefing } from "@/components/portal-briefing";

type Secao = "menu" | "reunioes" | "relatorios" | "briefings" | "tarefas";

const WHATSAPP_SAL = "5551993380278";

export function PortalMais({
  token,
  clienteNome,
  permissoes,
  briefingsPendentes,
  temBriefings,
  onPendenciasMudaram,
}: {
  token: string;
  clienteNome: string;
  permissoes: {
    verTarefas: boolean;
    verReunioes: boolean;
    verRelatorios: boolean;
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
      descricao: "Perguntas da SAL pra afinar sua estratégia",
      icon: ClipboardList,
      visivel: temBriefings,
      badge: briefingsPendentes,
    },
    {
      id: "relatorios",
      label: "Relatórios",
      descricao: "Resultados do mês em PDF",
      icon: BarChart3,
      visivel: permissoes.verRelatorios,
    },
    {
      id: "reunioes",
      label: "Reuniões",
      descricao: "Resumos e combinados das conversas",
      icon: Mic,
      visivel: permissoes.verReunioes,
    },
    {
      id: "tarefas",
      label: "Tarefas",
      descricao: "No que a SAL está trabalhando pra você",
      icon: ListChecks,
      visivel: permissoes.verTarefas,
    },
  ];
  const visiveis = itens.filter((i) => i.visivel);

  if (secao !== "menu") {
    const atual = itens.find((i) => i.id === secao);
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSecao("menu")}
          className="touch-feedback flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <h1 className="font-display text-lg font-semibold leading-tight">{atual?.label}</h1>
        {secao === "reunioes" && <PortalReunioes token={token} />}
        {secao === "relatorios" && <PortalRelatorios token={token} />}
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
    <div className="space-y-4">
      <section className="space-y-1">
        <h1 className="font-display text-lg font-semibold leading-tight">Mais</h1>
        <p className="text-[13px] text-muted-foreground">
          Relatórios, reuniões e tudo que a SAL registra pra você.
        </p>
      </section>

      {visiveis.length > 0 && (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {visiveis.map((i) => {
              const Icon = i.icon;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setSecao(i.id)}
                  className="touch-feedback flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-[18px] w-[18px] text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13.5px] font-medium leading-tight">
                      {i.label}
                      {!!i.badge && i.badge > 0 && (
                        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                          {i.badge > 9 ? "9+" : i.badge}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11.5px] text-muted-foreground leading-snug mt-0.5">
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
      <a
        href={`https://wa.me/${WHATSAPP_SAL}?text=${encodeURIComponent(
          `Olá! Sou da ${clienteNome} e estou falando pelo portal.`
        )}`}
        target="_blank"
        rel="noreferrer"
        className="touch-feedback block"
      >
        <Card className="border-emerald-500/30 hover:border-emerald-500/50 transition-colors">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <MessageCircle className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium leading-tight">
                Falar com a SAL no WhatsApp
              </span>
              <span className="block text-[11.5px] text-muted-foreground leading-snug mt-0.5">
                Dúvidas, urgências ou aquele papo rápido
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </CardContent>
        </Card>
      </a>

      <p className="text-center text-[10.5px] text-muted-foreground/70">
        Portal do Cliente · SAL Estratégias de Marketing
      </p>
    </div>
  );
}
