"use client";
/**
 * Portal v2 — cliente ANEXA arte(s) num post EXISTENTE da SAL.
 *
 * Diferente do EnviarConteudoDialog (que cria um post NOVO do cliente): aqui
 * o cliente contribui com arquivos num post que a SAL já criou no calendário
 * dele. Reusa o mesmo uploader (compressão + paste de URL) via
 * <UploaderArquivos>. As artes anexadas marcam enviadoPorCliente=true no
 * servidor → o Hub mostra um selo "Enviado pelo cliente" nelas.
 *
 * Mobile-first: bottom-sheet, touch targets 44px. Sem <style jsx>.
 */
import { useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UploaderArquivos, type ArquivoLocal } from "@/components/portal-enviar-conteudo";

/** Botão discreto de anexar arte — usado no PostCard quando `podeEnviar`. */
export function BotaoAnexarArte({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="flex-1 h-11 sm:h-9 text-sm sm:text-xs touch-feedback"
    >
      <Paperclip className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Anexar arte
    </Button>
  );
}

export function AnexarArteDialog({
  token,
  postId,
  postTitulo,
  onClose,
  onSuccess,
}: {
  token: string;
  postId: string;
  postTitulo: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [arquivos, setArquivos] = useState<ArquivoLocal[]>([]);
  const [processando, setProcessando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (arquivos.length === 0) {
      toast.error("Anexe pelo menos uma arte");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/p/cliente/${token}/posts/${postId}/arquivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arquivos: arquivos.map((a, i) => ({ ...a, ordem: (i + 1) * 10 })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? "Falha ao anexar");
        return;
      }
      toast.success(arquivos.length === 1 ? "Arte anexada! SAL foi notificada." : "Artes anexadas! SAL foi notificada.");
      onSuccess();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="dialog-bottom-sheet max-h-[90dvh] overflow-y-auto">
        <div className="sm:hidden flex justify-center -mt-1 mb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-base">Anexar arte</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 truncate">{postTitulo}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Suas artes entram no carrossel deste post. A SAL é avisada e revisa.
          </p>
        </DialogHeader>

        <UploaderArquivos
          value={arquivos}
          onChange={setArquivos}
          onProcessandoChange={setProcessando}
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 sm:h-9 touch-feedback">
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={enviando || processando || arquivos.length === 0}
            className="h-11 sm:h-9 touch-feedback"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            Anexar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
