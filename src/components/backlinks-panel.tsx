"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Users, Mic, FileText, FolderKanban, ListChecks, FileSignature, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BacklinkItem } from "@/app/api/mentions/backlinks/route";
import type { MentionEntity } from "@prisma/client";

type BacklinksPanelProps = {
  /** Tipo do target (entidade que está sendo visualizada) */
  type: MentionEntity;
  /** ID do target */
  id: string;
  /** Título do card. Default: "Referências" */
  title?: string;
  /** Esconde o card se não houver backlinks. Default: false (mostra estado vazio) */
  hideWhenEmpty?: boolean;
  className?: string;
};

const ICONS: Record<MentionEntity, React.ComponentType<{ className?: string }>> = {
  CLIENTE: Users,
  REUNIAO: Mic,
  POST: FileText,
  PROJETO: FolderKanban,
  TAREFA: ListChecks,
  CONTRATO: FileSignature,
  NOTA: StickyNote,
};

/**
 * Painel que lista todos os documentos que mencionam a entidade atual.
 *
 * Exemplo de uso (página de cliente):
 *   <BacklinksPanel type="CLIENTE" id={cliente.id} />
 *
 * Faz fetch client-side em /api/mentions/backlinks. Como o número de backlinks
 * costuma ser pequeno (dezenas), uma única request basta. Se virar gargalo,
 * dá pra mover pro RSC.
 */
export function BacklinksPanel({ type, id, title = "Referências", hideWhenEmpty = false, className }: BacklinksPanelProps) {
  const [items, setItems] = useState<BacklinkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    fetch(`/api/mentions/backlinks?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setItems(json.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  if (items === null && !error) {
    return (
      <Card className={className}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-3.5 w-3.5 text-sal-400" />
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <div className="text-xs text-muted-foreground/70">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <div className="text-xs text-destructive">Erro ao carregar referências.</div>
        </CardContent>
      </Card>
    );
  }

  if ((items ?? []).length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <Card className={className}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <div className="text-xs text-muted-foreground/70">
            Nenhum documento referencia este item ainda. Use <span className="font-mono bg-secondary px-1 rounded">@</span> em uma nota, reunião ou descrição para criar uma referência.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-sal-400" />
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/70 font-mono">{items!.length}</span>
        </div>
        <ul className="space-y-1">
          {items!.map((b) => {
            const Icon = ICONS[b.sourceType] ?? Link2;
            return (
              <li key={`${b.sourceType}:${b.sourceId}`}>
                <Link
                  href={b.href}
                  className={cn(
                    "flex items-start gap-2 px-2 py-1.5 -mx-2 rounded-md transition",
                    "hover:bg-secondary/60 group"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-sal-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">{b.label}</div>
                    {b.subtitle && (
                      <div className="text-[10.5px] text-muted-foreground truncate">{b.subtitle}</div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
