"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Target, Inbox, CalendarRange, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho do dashboard — saudação contextual + acesso rápido.
 *
 * - "Bom dia / Boa tarde / Boa noite" baseado na hora local do browser
 * - Nome curto (primeiro nome) do user logado
 * - Linha de contexto: data por extenso em pt-BR + 1-2 fatos úteis (server)
 * - 4 tiles de acesso rápido pros módulos-chave
 *
 * Client component porque a faixa do cumprimento depende da hora do browser
 * (timezone do user). Os números/fatos vêm prontos do server via props.
 */

type Contexto = {
  tarefasHoje: number;
  revisoesPendentes: number;
  propostasAtivas: number;
  pipelineCount: number;
  postsSemana: number;
};

export function DashboardGreeting({ contexto }: { contexto?: Contexto }) {
  const { data: session } = useSession();
  const [agora, setAgora] = useState<Date>(() => new Date());

  // Atualiza a saudação à meia-noite (caso a aba fique aberta noite-virando-dia)
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hora = agora.getHours();
  const cumprimento =
    hora < 5 ? "Boa madrugada" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const primeiroNome = (session?.user?.name ?? "").split(" ")[0] || "";

  // "Quarta, 4 de junho" — capitaliza o dia da semana (locale pt-BR vem minúsculo)
  const dataExtenso = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dataFormatada = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);

  // Monta a linha de contexto só com fatos que realmente existem (>0).
  const fatos: React.ReactNode[] = [];
  if (contexto) {
    if (contexto.tarefasHoje > 0) {
      fatos.push(
        <span key="tarefas">
          {contexto.tarefasHoje} {contexto.tarefasHoje === 1 ? "tarefa" : "tarefas"} pra hoje
        </span>
      );
    }
    if (contexto.revisoesPendentes > 0) {
      fatos.push(
        <span key="revisoes" className="font-semibold text-amber-600 dark:text-amber-400">
          {contexto.revisoesPendentes}{" "}
          {contexto.revisoesPendentes === 1 ? "revisão do cliente" : "revisões do cliente"} esperando
        </span>
      );
    }
    if (fatos.length === 0 && contexto.propostasAtivas > 0) {
      fatos.push(
        <span key="propostas">
          {contexto.propostasAtivas}{" "}
          {contexto.propostasAtivas === 1 ? "proposta aberta" : "propostas abertas"}
        </span>
      );
    }
  }

  return (
    <div className="animate-slide-up space-y-4 sm:space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-semibold tracking-tight leading-tight">
          {cumprimento}
          {primeiroNome && (
            <>
              , <span className="text-primary">{primeiroNome}</span>
            </>
          )}{" "}
          <span aria-hidden>👋</span>
        </h1>
        <p className="text-[13px] sm:text-sm text-muted-foreground font-medium">
          {dataFormatada}
          {fatos.map((f, i) => (
            <span key={i}>
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              {f}
            </span>
          ))}
        </p>
      </div>

      {/* Acesso rápido — 4 tiles pros módulos-chave */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <QuickTile
          href="/leads"
          icon={Target}
          tone="primary"
          titulo="Pipeline"
          sub={
            contexto && contexto.pipelineCount > 0
              ? `${contexto.pipelineCount} ${contexto.pipelineCount === 1 ? "lead ativo" : "leads ativos"}`
              : "Comercial"
          }
        />
        <QuickTile
          href="/editorial?revisao=pendente"
          icon={Inbox}
          tone="amber"
          titulo="Revisar"
          sub={
            contexto && contexto.revisoesPendentes > 0
              ? `${contexto.revisoesPendentes} do cliente`
              : "Em dia"
          }
        />
        <QuickTile
          href="/editorial"
          icon={CalendarRange}
          tone="blue"
          titulo="Editorial"
          sub={
            contexto && contexto.postsSemana > 0
              ? `${contexto.postsSemana} ${contexto.postsSemana === 1 ? "post" : "posts"}/semana`
              : "Calendário"
          }
        />
        <QuickTile
          href="/propostas"
          icon={FileText}
          tone="emerald"
          titulo="Propostas"
          sub={
            contexto && contexto.propostasAtivas > 0
              ? `${contexto.propostasAtivas} ${contexto.propostasAtivas === 1 ? "aberta" : "abertas"}`
              : "Comercial"
          }
        />
      </div>
    </div>
  );
}

const TONES = {
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
} as const;

function QuickTile({
  href,
  icon: Icon,
  tone,
  titulo,
  sub,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONES;
  titulo: string;
  sub: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="flex items-center gap-3 p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
        <span
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            TONES[tone]
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight">{titulo}</div>
          <div className="text-[11.5px] text-muted-foreground truncate">{sub}</div>
        </div>
      </Card>
    </Link>
  );
}
