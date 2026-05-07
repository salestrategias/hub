"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, ListChecks, FileText, Sparkles, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type ReuniaoHoje = {
  id: string;
  titulo: string;
  hora: string;
  cliente: string | null;
};

type TarefaHoje = {
  id: string;
  titulo: string;
  prioridade: string;
  cliente: string | null;
};

type PostHoje = {
  id: string;
  titulo: string;
  cliente: string | null;
  status: string;
};

export function DashboardHoje({
  reunioes,
  tarefas,
  posts,
}: {
  reunioes: ReuniaoHoje[];
  tarefas: TarefaHoje[];
  posts: PostHoje[];
}) {
  const total = reunioes.length + tarefas.length + posts.length;

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "120ms" }}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-sm font-semibold">Hoje</h2>
          </div>
          <span className="text-[10.5px] text-muted-foreground/70 font-mono">{total} {total === 1 ? "item" : "itens"}</span>
        </div>

        {total === 0 ? (
          <div className="py-8 text-center">
            <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Sem compromissos pra hoje. Aproveita.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reunioes.length > 0 && (
              <Section icon={Mic} label="Reuniões" count={reunioes.length}>
                {reunioes.map((r) => (
                  <Item
                    key={r.id}
                    href={`/reunioes/${r.id}`}
                    titulo={r.titulo}
                    subtitulo={r.cliente ?? "Interna"}
                    badge={r.hora}
                  />
                ))}
              </Section>
            )}

            {tarefas.length > 0 && (
              <Section icon={ListChecks} label="Tarefas urgentes" count={tarefas.length}>
                {tarefas.map((t) => (
                  <Item
                    key={t.id}
                    href={`/tarefas?tarefa=${t.id}`}
                    titulo={t.titulo}
                    subtitulo={t.cliente ?? "Sem cliente"}
                    badge={t.prioridade}
                    badgeVariant={t.prioridade === "URGENTE" ? "destructive" : "warning"}
                  />
                ))}
              </Section>
            )}

            {posts.length > 0 && (
              <Section icon={FileText} label="Posts pra publicar" count={posts.length}>
                {posts.map((p) => (
                  <Item
                    key={p.id}
                    href={`/editorial?post=${p.id}`}
                    titulo={p.titulo || "(sem título)"}
                    subtitulo={p.cliente ?? "Sem cliente"}
                    badge={p.status}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon: Icon,
  label,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 px-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground/50 font-mono">{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Item({
  href,
  titulo,
  subtitulo,
  badge,
  badgeVariant = "default",
}: {
  href: string;
  titulo: string;
  subtitulo: string;
  badge: string;
  badgeVariant?: "default" | "destructive" | "warning";
}) {
  const variantClass =
    badgeVariant === "destructive"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : badgeVariant === "warning"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-secondary text-muted-foreground border-border";

  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 -mx-1 rounded-md hover:bg-secondary/60 transition group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium truncate">{titulo}</div>
        <div className="text-[10.5px] text-muted-foreground truncate">{subtitulo}</div>
      </div>
      <span className={cn("text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border", variantClass)}>
        {badge}
      </span>
    </Link>
  );
}
