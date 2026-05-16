"use client";
/**
 * Botão "?" no header global que abre modal com índice do Manual do Hub.
 *
 * O modal mostra a árvore de categorias + seções e permite busca rápida.
 * Click numa seção navega pra /manual/hub/{slug}.
 *
 * Atalho global: pressionar ? (Shift + /) ou F1 em qualquer lugar abre.
 */
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { HelpCircle, Search, X, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type SecaoHub = {
  id: string;
  titulo: string;
  slug: string;
  icone: string | null;
  parentId: string | null;
  ordem: number;
};

export function AjudaTrigger() {
  const [open, setOpen] = useState(false);
  const [secoes, setSecoes] = useState<SecaoHub[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");

  // Atalho global ? ou F1
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const ignoraInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (ignoraInput) return;

      if (e.key === "F1" || (e.key === "?" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Carrega seções HUB quando modal abre (lazy)
  useEffect(() => {
    if (!open || secoes.length > 0) return;
    setLoading(true);
    fetch("/api/manual/hub")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setSecoes(d);
      })
      .finally(() => setLoading(false));
  }, [open, secoes.length]);

  // Estrutura hierárquica (pai → filhos)
  const arvore = useMemo(() => {
    const pais = secoes.filter((s) => !s.parentId).sort((a, b) => a.ordem - b.ordem);
    return pais.map((pai) => ({
      ...pai,
      filhas: secoes
        .filter((s) => s.parentId === pai.id)
        .sort((a, b) => a.ordem - b.ordem),
    }));
  }, [secoes]);

  // Filtro de busca
  const filtroLower = busca.trim().toLowerCase();
  const arvoreFiltrada = useMemo(() => {
    if (!filtroLower) return arvore;
    return arvore
      .map((pai) => ({
        ...pai,
        filhas: pai.filhas.filter((f) => f.titulo.toLowerCase().includes(filtroLower)),
      }))
      .filter((p) => p.titulo.toLowerCase().includes(filtroLower) || p.filhas.length > 0);
  }, [arvore, filtroLower]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Ajuda — Manual do Hub"
        title="Ajuda (?)"
        className="hidden md:inline-flex"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl dialog-bottom-sheet p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Manual do Hub</DialogTitle>

          {/* Handle visual de bottom sheet em mobile */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header com busca */}
          <div className="px-4 sm:px-5 pt-3 sm:pt-5 pb-3 border-b border-border space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary shrink-0" />
              <h2 className="font-display text-base sm:text-lg font-semibold flex-1">
                Manual do Hub
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="touch-feedback h-8 w-8 rounded-md hover:bg-muted/60 flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no manual..."
                autoFocus
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {/* Conteúdo */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : arvoreFiltrada.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {busca ? `Nada encontrado pra "${busca}"` : "Manual ainda não foi populado"}
              </div>
            ) : (
              <div className="p-2 sm:p-3 space-y-3">
                {arvoreFiltrada.map((pai) => (
                  <section key={pai.id}>
                    <Link
                      href={`/manual/hub/${pai.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-2 py-1.5 text-[11.5px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition"
                    >
                      <span className="text-base leading-none">{pai.icone ?? "📘"}</span>
                      {pai.titulo}
                    </Link>
                    <div className="space-y-0.5 ml-0.5">
                      {pai.filhas.map((filha) => (
                        <Link
                          key={filha.id}
                          href={`/manual/hub/${filha.slug}`}
                          onClick={() => setOpen(false)}
                          className="touch-feedback flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-primary/10 active:bg-primary/15 transition group"
                        >
                          <span className="text-base leading-none shrink-0">{filha.icone ?? "📄"}</span>
                          <span className="flex-1 truncate">{filha.titulo}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-5 py-2.5 border-t border-border bg-muted/20 text-[10.5px] text-muted-foreground/70 flex items-center justify-between gap-2">
            <span>
              Atalho: <kbd className="kbd-key">?</kbd> ou <kbd className="kbd-key">F1</kbd>
            </span>
            <Link
              href="/manual/hub"
              onClick={() => setOpen(false)}
              className="hover:text-foreground transition"
            >
              Abrir manual completo →
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
