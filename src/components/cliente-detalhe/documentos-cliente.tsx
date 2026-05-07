"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemplatePicker } from "@/components/template-picker";
import { FolderOpen, FileText, Star, Plus, ExternalLink, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentoNota } from "@/lib/cliente-documentos";

type Props = {
  clienteId: string;
  clienteNome: string;
  driveFolderUrl: string | null;
  briefings: DocumentoNota[];
  outrasNotas: DocumentoNota[];
};

export function DocumentosCliente({
  clienteId,
  clienteNome,
  driveFolderUrl,
  briefings,
  outrasNotas,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-sal-600/15 text-sal-400 flex items-center justify-center">
              <ClipboardList className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold">Documentos & briefing</h3>
          </div>
          <Button size="sm" variant="outline" className="text-[11px] h-7" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3 w-3" /> Novo briefing
          </Button>
        </div>

        {/* Drive em destaque */}
        {driveFolderUrl ? (
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-md border border-sal-600/30 bg-sal-600/5 hover:bg-sal-600/10 transition p-3 group"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-sal-600/20 text-sal-400 flex items-center justify-center shrink-0">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium">Pasta no Google Drive</div>
                <div className="text-[10.5px] text-muted-foreground">
                  Manual de marca, contratos, materiais brutos
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-sal-400 transition" />
            </div>
          </a>
        ) : (
          <div className="rounded-md border border-dashed border-border p-3 text-center">
            <FolderOpen className="h-5 w-5 mx-auto text-muted-foreground/40 mb-1" />
            <p className="text-[11px] text-muted-foreground">Nenhuma pasta vinculada no Drive.</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Use o botão "Drive" no header pra criar/vincular.
            </p>
          </div>
        )}

        {/* Briefings */}
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Briefings ({briefings.length})
          </div>
          {briefings.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-2">
              Sem briefings ainda. Use o botão acima pra criar o primeiro.
            </p>
          ) : (
            <ul className="space-y-1">
              {briefings.map((b) => (
                <NotaItem key={b.id} nota={b} />
              ))}
            </ul>
          )}
        </div>

        {/* Outras notas mencionando o cliente */}
        {outrasNotas.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Outras notas relacionadas ({outrasNotas.length})
            </div>
            <ul className="space-y-1">
              {outrasNotas.slice(0, 8).map((n) => (
                <NotaItem key={n.id} nota={n} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tipos={["BRIEFING", "NOTA"]}
        clienteId={clienteId}
        blankLabel={`Briefing em branco — ${clienteNome}`}
      />
    </Card>
  );
}

function NotaItem({ nota }: { nota: DocumentoNota }) {
  return (
    <li>
      <Link
        href={`/notas?nota=${nota.id}`}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 -mx-1 rounded-md transition",
          "hover:bg-secondary/60 group"
        )}
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-sal-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {nota.favorita && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 shrink-0" />}
            <span className="text-[12px] font-medium truncate">{nota.titulo}</span>
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <span>{nota.pasta}</span>
            {nota.tags.slice(0, 2).map((t) => (
              <Badge key={t} variant="outline" className="text-[9px] py-0 px-1">{t}</Badge>
            ))}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">
          {relTime(nota.updatedAt)}
        </span>
      </Link>
    </li>
  );
}

function relTime(iso: string): string {
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
