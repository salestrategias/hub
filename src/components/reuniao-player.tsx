"use client";
/**
 * Player de gravação embedado do Google Drive.
 *
 * Usa iframe com `/preview` do Drive — player nativo com controles
 * (play/pause/seek/volume/fullscreen). Funciona porque Marcelo está
 * logado no Google no navegador, então o Drive autoriza o embed.
 *
 * Salto pra timestamp:
 *  - O Drive aceita `#t={seg}s` na URL pra começar em momento X
 *  - Mas mudar isso depois do iframe carregar exige re-mount
 *  - Solução: usar `key` no iframe que muda quando `seekToSeg` muda →
 *    React re-monta o iframe com nova URL
 *  - Trade-off: re-mount tem ~1s de delay mas é aceitável (cliques
 *    em blocos da transcrição são esporádicos, não contínuos)
 *
 * Sem gravação vinculada:
 *  - Mostra empty state com botão pra colar URL manualmente
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Link2, Loader2, X, ExternalLink, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

export function ReuniaoPlayer({
  reuniaoId,
  audioUrl,
  seekToSeg,
  onSeekConsumed,
}: {
  reuniaoId: string;
  audioUrl: string | null;
  /** Timestamp em segundos pra saltar. Quando muda, iframe re-monta. */
  seekToSeg: number | null;
  /** Callback opcional após o seek (limpa state no pai pra evitar re-mount em renders inúteis) */
  onSeekConsumed?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!audioUrl) {
    return (
      <Card>
        <CardContent className="p-5 flex items-center justify-center gap-3 min-h-[180px]">
          <Video className="h-8 w-8 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Sem gravação vinculada
            </p>
            <p className="text-[11px] text-muted-foreground/70 mb-3">
              Importe a transcrição do Meet (busca automática), ou cole URL manual abaixo.
            </p>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Link2 className="h-3.5 w-3.5" /> Vincular gravação
            </Button>
          </div>
        </CardContent>
        <VincularGravacaoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          reuniaoId={reuniaoId}
          atual={null}
        />
      </Card>
    );
  }

  // URL final com timestamp opcional
  const srcFinal = seekToSeg !== null && seekToSeg > 0 ? `${audioUrl}#t=${seekToSeg}s` : audioUrl;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black">
          <iframe
            key={seekToSeg ?? "inicial"}
            src={srcFinal}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="w-full h-full border-0"
            onLoad={() => onSeekConsumed?.()}
          />
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[11px] text-muted-foreground">
            Gravação do Google Drive · clique em qualquer bloco da transcrição pra saltar
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setDialogOpen(true)}
              title="Trocar gravação"
            >
              <Link2 className="h-3 w-3" />
            </Button>
            <a
              href={audioUrl.replace("/preview", "/view")}
              target="_blank"
              rel="noreferrer"
              title="Abrir no Drive"
              className="text-muted-foreground hover:text-primary p-1"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardContent>
      <VincularGravacaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        reuniaoId={reuniaoId}
        atual={audioUrl}
      />
    </Card>
  );
}

function VincularGravacaoDialog({
  open,
  onOpenChange,
  reuniaoId,
  atual,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reuniaoId: string;
  atual: string | null;
}) {
  const [url, setUrl] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(novaUrl: string | null) {
    setSalvando(true);
    try {
      const res = await fetch(`/api/reunioes/${reuniaoId}/gravacao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: novaUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao vincular");
        return;
      }
      toast.success(novaUrl ? "Gravação vinculada" : "Gravação removida");
      onOpenChange(false);
      // Hard reload pra refletir audioUrl novo no server component pai
      window.location.reload();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{atual ? "Trocar gravação" : "Vincular gravação"}</DialogTitle>
          <DialogDescription>
            Cole a URL do arquivo no Google Drive. Aceita qualquer formato (`/file/d/...`, `/preview`, `?id=`).
            O Drive precisa estar acessível pela sua conta Google.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">URL do Drive</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/..."
          />
          <p className="text-[10.5px] text-muted-foreground">
            Pro Meet: vai em Drive → Meet Recordings → encontra o arquivo `.mp4` da reunião → "Compartilhar" → "Copiar link".
          </p>
        </div>

        <DialogFooter className="gap-2">
          {atual && (
            <Button
              variant="outline"
              onClick={() => salvar(null)}
              disabled={salvando}
              className="text-destructive hover:text-destructive mr-auto"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
          <Button onClick={() => salvar(url)} disabled={!url.trim() || salvando}>
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
