"use client";
/**
 * Botão "Gerar copy com IA" pro post-sheet.
 * Abre o wizard que monta prompt → cola no Claude → preenche legenda + hashtags + cta + obs.
 *
 * Recebe `onApplied` pro post-sheet poder refetchar a state local após sucesso.
 */
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IaWizard } from "@/components/ia-wizard";

export function PostCopyIaButton({
  postId,
  onApplied,
}: {
  postId: string;
  /** Chamado após aplicar com sucesso. Sheet refetcha o post. */
  onApplied: () => void;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setWizardOpen(true)}
        className="text-amber-500 border-amber-500/40 hover:bg-amber-500/10 gap-1.5"
      >
        <Sparkles className="h-3.5 w-3.5" /> Gerar copy com IA
      </Button>

      <IaWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        prepararEndpoint={`/api/posts/${postId}/preparar-copy-ia`}
        aplicarEndpoint={`/api/posts/${postId}/aplicar-copy-ia`}
        title="Gerar copy com IA"
        description="Claude vai escrever legenda + hashtags + CTA + observações pro designer, respeitando o tom de voz do cliente."
        preReqMessage={
          <>
            <p>
              <strong>O que entra no prompt:</strong> brief atual do post (título, pilar, formato),
              notas internas do cliente (tom de voz) e até 3 posts publicados anteriormente do mesmo
              cliente como referência de estilo.
            </p>
            <p className="text-muted-foreground mt-1">
              Vai sobrescrever a copy atual. Pode regerar quantas vezes quiser.
            </p>
          </>
        }
        exemploResposta='{"legenda": "...", "hashtags": [...], "cta": "...", "observacoesProducao": "..."}'
        onSuccess={onApplied}
        refreshOnSuccess={false}
        renderResultado={() => (
          <span>
            Copy aplicada — legenda, hashtags, CTA e notas de produção foram atualizados. Verifique
            as abas do post pra ver tudo.
          </span>
        )}
      />
    </>
  );
}
