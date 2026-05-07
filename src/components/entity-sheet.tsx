"use client";
import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hook que gerencia abertura/fechamento de um sheet via search param da URL.
 *
 * Ex: useEntitySheet("cliente") observa `?cliente=xxx` na URL e devolve
 * o ID atual + funções pra abrir/fechar.
 *
 * Vantagens:
 *  - Deep linking: copiar URL com `?cliente=xxx` reabre o sheet
 *  - Browser back fecha o sheet (router.back)
 *  - Sem state global; URL é a única fonte de verdade
 */
export function useEntitySheet(paramName: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = params.get(paramName);

  const open = useCallback(
    (newId: string) => {
      const newParams = new URLSearchParams(params.toString());
      newParams.set(paramName, newId);
      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
    },
    [router, pathname, params, paramName]
  );

  const close = useCallback(() => {
    const newParams = new URLSearchParams(params.toString());
    newParams.delete(paramName);
    const query = newParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [router, pathname, params, paramName]);

  return { id, isOpen: id !== null, open, close };
}

type EntitySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Carregando o conteúdo (mostra spinner). */
  loading?: boolean;
  /** Erro ao carregar (mostra mensagem). */
  error?: string | null;

  /** Título exibido no header. Pode ser um nó React (ex: input editável). */
  titulo: React.ReactNode;
  /** Subtítulo opcional (ex: "Cliente · ATIVO"). */
  subtitulo?: React.ReactNode;
  /** Ícone à esquerda do título. */
  icone?: React.ComponentType<{ className?: string }>;
  /** Cor do ícone (hex ou classe). Default: roxo SAL. */
  iconeCor?: string;

  /** Link pra "página completa" da entidade. Default: oculto. */
  linkPaginaCompleta?: string;
  /** Conteúdo principal scrollable. */
  children: React.ReactNode;
  /** Footer (botões de ação). Opcional. */
  footer?: React.ReactNode;

  /** Largura customizada (sm:max-w-XXX). Default sm:max-w-[640px]. */
  className?: string;
};

/**
 * Wrapper padrão pra todos os sheets do Hub. Padroniza:
 *  - Header com ícone + título + subtítulo + botão "↗ Página completa"
 *  - Body scrollable
 *  - Loading/error states
 *  - Footer opcional pra ações
 */
export function EntitySheet({
  open,
  onOpenChange,
  loading,
  error,
  titulo,
  subtitulo,
  icone: Icon,
  iconeCor = "#7E30E1",
  linkPaginaCompleta,
  children,
  footer,
  className,
}: EntitySheetProps) {
  // ESC fecha. Por default já vem do Radix; aqui ficamos só observando edge cases.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // Atalhos avançados podem ser plugados aqui (e=editar, del=excluir)
      // Por agora só docs.
      void e;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn(className)}>
        <SheetHeader>
          <div className="flex items-start gap-3 pr-8">
            {Icon && (
              <div
                className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${iconeCor}1F`, color: iconeCor }}
              >
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate">{titulo}</SheetTitle>
              {subtitulo && <SheetDescription>{subtitulo}</SheetDescription>}
            </div>
            {linkPaginaCompleta && (
              <Button asChild variant="ghost" size="icon" className="shrink-0" title="Abrir página completa">
                <Link href={linkPaginaCompleta} aria-label="Abrir página completa">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </SheetHeader>

        {loading ? (
          <SheetBody>
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Carregando...</span>
            </div>
          </SheetBody>
        ) : error ? (
          <SheetBody>
            <div className="py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </SheetBody>
        ) : (
          <SheetBody>{children}</SheetBody>
        )}

        {footer && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
