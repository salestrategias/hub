"use client";
/**
 * Header de versionamento da proposta — exibido no editor.
 *
 * Mostra:
 *  - Badge "v2" (se versao > 1)
 *  - Dropdown listando todas as versões da thread (click navega entre elas)
 *  - Botão "Nova revisão" → modal pede motivo → cria v(N+1) e redireciona
 *  - Aviso se a versão atual sendo editada NÃO é a vigente
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { GitBranch, Plus, ChevronDown, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type VersaoMini = {
  id: string;
  numero: string;
  versao: number;
  versaoAtual: boolean;
  status: string;
  createdAt: string;
  motivoRevisao: string | null;
};

const STATUS_COR: Record<string, string> = {
  RASCUNHO: "#9696A8",
  ENVIADA: "#3B82F6",
  VISTA: "#F59E0B",
  ACEITA: "#10B981",
  RECUSADA: "#EF4444",
  EXPIRADA: "#6B7280",
};

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  VISTA: "Vista",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
};

export function PropostaVersoesHeader({
  propostaId,
  versao,
  versaoAtual,
  motivoRevisao,
}: {
  propostaId: string;
  versao: number;
  versaoAtual: boolean;
  motivoRevisao: string | null;
}) {
  const router = useRouter();
  const [versoes, setVersoes] = useState<VersaoMini[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [novaRevisaoOpen, setNovaRevisaoOpen] = useState(false);

  useEffect(() => {
    setCarregando(true);
    fetch(`/api/propostas/${propostaId}/versoes`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setVersoes(d);
      })
      .finally(() => setCarregando(false));
  }, [propostaId]);

  const temMultiplasVersoes = versoes.length > 1;

  return (
    <>
      {!versaoAtual && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 flex items-center gap-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-amber-500">Versão não-atual</span>
            <span className="text-muted-foreground">
              {" "}— esta é uma revisão antiga, somente leitura recomendada. A versão atual é a mais recente.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const atual = versoes.find((v) => v.versaoAtual);
              if (atual) router.push(`/propostas/${atual.id}`);
            }}
            disabled={!versoes.some((v) => v.versaoAtual)}
          >
            Ir pra versão atual
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {/* Badge versão */}
        {versao > 1 ? (
          <Badge variant="outline" className="text-[11px] gap-1.5" style={{ color: "#7E30E1", borderColor: "#7E30E155" }}>
            <GitBranch className="h-3 w-3" />
            Revisão {versao}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[11px]" style={{ color: "#9696A8" }}>
            Versão original
          </Badge>
        )}

        {/* Dropdown de versões */}
        {temMultiplasVersoes && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px]">
                <ChevronDown className="h-3 w-3" />
                {versoes.length} versões
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>Histórico de revisões</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {versoes
                .sort((a, b) => b.versao - a.versao)
                .map((v) => {
                  const cor = STATUS_COR[v.status] ?? "#9696A8";
                  const ativa = v.id === propostaId;
                  return (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => router.push(`/propostas/${v.id}`)}
                      className={cn(
                        "flex flex-col items-start gap-1 py-2",
                        ativa && "bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="font-mono text-[11px]">{v.numero}</span>
                        {v.versaoAtual && (
                          <Badge
                            variant="outline"
                            className="text-[9px] gap-1"
                            style={{ color: "#10B981", borderColor: "#10B98155" }}
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" /> Atual
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[9px] ml-auto"
                          style={{ color: cor, borderColor: `${cor}55` }}
                        >
                          {STATUS_LABEL[v.status]}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {v.versao === 1 ? "Original" : `Revisão ${v.versao}`} ·{" "}
                        {new Date(v.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                      {v.motivoRevisao && (
                        <div className="text-[10px] text-muted-foreground italic line-clamp-2">
                          &ldquo;{v.motivoRevisao}&rdquo;
                        </div>
                      )}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Botão Nova revisão — só na versão atual */}
        {versaoAtual && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNovaRevisaoOpen(true)}
            className="ml-auto h-7 text-[11px]"
            disabled={carregando}
          >
            <Plus className="h-3 w-3" />
            Nova revisão
          </Button>
        )}
      </div>

      {/* Motivo da revisão (se for >v1) */}
      {motivoRevisao && versao > 1 && (
        <div className="rounded-md border border-border bg-card/40 px-3 py-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">Motivo desta revisão:</span>{" "}
          <span className="text-foreground italic">&ldquo;{motivoRevisao}&rdquo;</span>
        </div>
      )}

      {novaRevisaoOpen && (
        <NovaRevisaoDialog
          propostaId={propostaId}
          versaoAtual={versao}
          onClose={() => setNovaRevisaoOpen(false)}
        />
      )}
    </>
  );
}

function NovaRevisaoDialog({
  propostaId,
  versaoAtual,
  onClose,
}: {
  propostaId: string;
  versaoAtual: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [criando, setCriando] = useState(false);

  async function criar() {
    setCriando(true);
    try {
      const res = await fetch(`/api/propostas/${propostaId}/nova-versao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Falha");
      }
      const nova = await res.json();
      toast.success(`Revisão ${versaoAtual + 1} criada — você foi redirecionado`);
      router.push(`/propostas/${nova.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setCriando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Criar revisão {versaoAtual + 1}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">
            Vai criar uma cópia desta proposta como nova versão. A versão atual fica como histórico
            (somente leitura), e você passa a editar a v{versaoAtual + 1}.
          </p>
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5 text-[11px] text-muted-foreground">
            <div>📄 Todo o conteúdo é copiado (textos, blocos, valores, identidade visual).</div>
            <div>🔄 Status volta pra <strong>Rascunho</strong> — precisa reenviar pra cliente.</div>
            <div>🔗 Novo shareToken é gerado quando você enviar de novo.</div>
            <div>📋 Aceites/recusas/views da versão antiga ficam preservados no histórico.</div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo da revisão (opcional)</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Cliente pediu ajuste no escopo + reduzir valor mensal pra R$ 4.500. Adicionei garantia de ROI."
              rows={4}
              autoFocus
              className="text-xs resize-none"
            />
            <p className="text-[10px] text-muted-foreground/70">
              Anotação interna pra você lembrar depois. Cliente não vê.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={criando}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={criar} disabled={criando}>
            {criando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando...
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Criar revisão {versaoAtual + 1}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
