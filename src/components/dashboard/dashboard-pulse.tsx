"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mic, StickyNote, ListChecks, FolderKanban, Activity } from "lucide-react";

type AtividadeItem = {
  id: string;
  tipo: "NOTA" | "REUNIAO" | "POST" | "TAREFA" | "PROJETO";
  titulo: string;
  subtitulo?: string;
  href: string;
  createdAt: string;
};

type StatusBreakdown = {
  rascunho: number;
  aprovado: number;
  publicado: number;
  total: number;
};

const ICONES = {
  NOTA: StickyNote,
  REUNIAO: Mic,
  POST: FileText,
  TAREFA: ListChecks,
  PROJETO: FolderKanban,
};

export function DashboardPulse({
  atividades,
  posts,
  tarefasAbertas,
  tarefasConcluidasMes,
}: {
  atividades: AtividadeItem[];
  posts: StatusBreakdown;
  tarefasAbertas: number;
  tarefasConcluidasMes: number;
}) {
  return (
    <div className="grid lg:grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: "240ms" }}>
      <PostsBreakdown posts={posts} />
      <TarefasBreakdown abertas={tarefasAbertas} concluidasMes={tarefasConcluidasMes} />
      <AtividadeRecente items={atividades} />
    </div>
  );
}

function PostsBreakdown({ posts }: { posts: StatusBreakdown }) {
  const pct = (n: number) => (posts.total > 0 ? (n / posts.total) * 100 : 0);
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-sal-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posts no mês</h3>
        </div>

        <div className="text-[28px] font-display font-semibold leading-none">{posts.total}</div>

        {posts.total > 0 ? (
          <>
            <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
              <div className="bg-amber-500/70" style={{ width: `${pct(posts.rascunho)}%` }} title={`${posts.rascunho} rascunho`} />
              <div className="bg-blue-500/70" style={{ width: `${pct(posts.aprovado)}%` }} title={`${posts.aprovado} aprovado`} />
              <div className="bg-emerald-500/70" style={{ width: `${pct(posts.publicado)}%` }} title={`${posts.publicado} publicado`} />
            </div>
            <div className="grid grid-cols-3 text-[10.5px] gap-1">
              <Lane color="bg-amber-500/70" label="Rascunho" value={posts.rascunho} />
              <Lane color="bg-blue-500/70" label="Aprovado" value={posts.aprovado} />
              <Lane color="bg-emerald-500/70" label="Publicado" value={posts.publicado} />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sem posts no mês ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Lane({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono">{value}</span>
    </div>
  );
}

function TarefasBreakdown({ abertas, concluidasMes }: { abertas: number; concluidasMes: number }) {
  const total = abertas + concluidasMes;
  const pctConcluidas = total > 0 ? (concluidasMes / total) * 100 : 0;
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 text-sal-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tarefas</h3>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-display font-semibold leading-none">{abertas}</span>
          <span className="text-[10.5px] text-muted-foreground">aberta{abertas === 1 ? "" : "s"}</span>
        </div>

        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-emerald-500/70" style={{ width: `${pctConcluidas}%` }} />
        </div>

        <div className="text-[10.5px] text-muted-foreground">
          <span className="font-mono text-emerald-400">{concluidasMes}</span> concluídas no mês
          {total > 0 && (
            <span className="ml-1 font-mono text-muted-foreground/60">
              ({Math.round(pctConcluidas)}% throughput)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AtividadeRecente({ items }: { items: AtividadeItem[] }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-sal-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atividade recente</h3>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem atividade recente.</p>
        ) : (
          <ul className="space-y-1 -mx-1">
            {items.map((a) => {
              const Icon = ICONES[a.tipo];
              return (
                <li key={`${a.tipo}-${a.id}`}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition"
                  >
                    <div className="h-6 w-6 rounded bg-secondary flex items-center justify-center shrink-0">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] truncate">{a.titulo}</div>
                      {a.subtitulo && <div className="text-[10px] text-muted-foreground truncate">{a.subtitulo}</div>}
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 font-mono whitespace-nowrap">
                      {relTimeShort(a.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function relTimeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
