"use client";
/**
 * Dialog de importação de transcrição do Google Meet.
 *
 * 2 caminhos:
 *  1. Lista — fetch /api/drive/meet-recordings, mostra docs recentes,
 *     click escolhe
 *  2. URL manual — cola URL/ID do Doc específico (fallback se a
 *     listagem não encontrar)
 *
 * Após escolher → confirma → POST /importar-meet → toast + refresh.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Mic, Loader2, ExternalLink, Search, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";

type MeetDoc = {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink: string;
  daPastaMeet: boolean;
};

export function ImportarMeetDialog({
  open,
  onOpenChange,
  reuniaoId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reuniaoId: string;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<MeetDoc[]>([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [busca, setBusca] = useState("");
  const [urlManual, setUrlManual] = useState("");
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingLista(true);
    fetch("/api/drive/meet-recordings")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDocs(data);
        else if (data?.error) setErro(data.error);
      })
      .catch((e) => setErro(String(e)))
      .finally(() => setLoadingLista(false));
  }, [open]);

  async function importar(payload: { docId?: string; docUrl?: string }) {
    setImportando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/reunioes/${reuniaoId}/importar-meet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data?.error ?? "Falha ao importar");
        return;
      }
      const partes: string[] = [];
      if (data.blocos > 0) partes.push(`${data.blocos} bloco(s) de transcrição`);
      if (data.actions > 0) partes.push(`${data.actions} action item(s)`);
      if (data.resumoImportado) partes.push("resumo");
      toast.success(`Importado: ${partes.join(" · ")}`);
      onOpenChange(false);
      router.refresh();
    } finally {
      setImportando(false);
    }
  }

  const filtrados = busca.trim()
    ? docs.filter((d) => d.name.toLowerCase().includes(busca.toLowerCase()))
    : docs;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            Importar transcrição do Google Meet
          </DialogTitle>
          <DialogDescription>
            Sistema lê o Doc de transcrição gerado automaticamente pelo Meet
            e cria os blocos da reunião, action items e capítulos (quando disponíveis).
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="lista">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lista">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Docs recentes
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link2 className="h-3.5 w-3.5 mr-1.5" /> URL manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar..."
                className="pl-8 h-8"
              />
            </div>

            <div className="rounded-md border border-border max-h-[400px] overflow-y-auto">
              {loadingLista ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Buscando docs no Drive...
                </div>
              ) : filtrados.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {busca
                    ? `Nada bate com "${busca}".`
                    : "Nenhum Doc de transcrição encontrado. Confira se a transcrição foi habilitada no Meet."}
                </div>
              ) : (
                filtrados.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-0 hover:bg-muted/50 group"
                  >
                    <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate flex items-center gap-1.5">
                        {d.name}
                        {d.daPastaMeet && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1">
                            Meet
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {new Date(d.modifiedTime).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <a
                      href={d.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition"
                      title="Abrir no Drive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <Button
                      size="sm"
                      onClick={() => importar({ docId: d.id })}
                      disabled={importando}
                    >
                      Importar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">URL do Google Doc da transcrição</Label>
              <Input
                value={urlManual}
                onChange={(e) => setUrlManual(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
              />
              <p className="text-[11px] text-muted-foreground">
                Cola o link compartilhável do Doc. O Doc precisa estar acessível
                pela sua conta Google (não precisa ser público).
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => importar({ docUrl: urlManual })}
                disabled={!urlManual.trim() || importando}
              >
                {importando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Importar"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {erro && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {erro}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
