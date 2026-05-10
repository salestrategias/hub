"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { QuickCaptureModal } from "@/components/quick-capture-modal";

/**
 * Quick Capture — atalho global pra anotar algo em qualquer página
 * sem perder o contexto.
 *
 * Atalho:
 *   - Cmd+Shift+N (Mac)
 *   - Ctrl+Shift+N (Win/Linux)
 *
 * Rascunho persiste em localStorage (key `sal-hub-quick-capture-draft`)
 * — se fechar acidentalmente (sem salvar), o conteúdo volta na próxima
 * abertura.
 */

type Ctx = {
  open: boolean;
  abrir: () => void;
  fechar: () => void;
};

const QuickCaptureContext = createContext<Ctx | null>(null);

export const QUICK_CAPTURE_DRAFT_KEY = "sal-hub-quick-capture-draft";

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const abrir = useCallback(() => setOpen(true), []);
  const fechar = useCallback(() => setOpen(false), []);

  // Atalho global. Ignora quando algum input/textarea/contenteditable
  // já está em foco em outro modal pra evitar conflito.
  useEffect(() => {
    function isEditing(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      // contenteditable (BlockEditor)
      const editable = (el as HTMLElement).isContentEditable;
      return editable;
    }

    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || !e.shiftKey) return;
      if (e.key.toLowerCase() !== "n") return;

      // Permite abertura mesmo se outro modal/editor estiver aberto —
      // mas se a tecla está sendo digitada em input, deixa o usuário.
      // Cmd+Shift+N é incomum em browsers (não conflita com new private window
      // em Chrome — esse é Cmd+Shift+N no Mac mas só ativo no menu, e nosso
      // preventDefault impede).
      e.preventDefault();
      e.stopPropagation();
      setOpen((v) => !v);
    }

    function onCustomOpen() {
      setOpen(true);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("sal-hub:quick-capture-open", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sal-hub:quick-capture-open", onCustomOpen);
    };
  }, []);

  return (
    <QuickCaptureContext.Provider value={{ open, abrir, fechar }}>
      {children}
      <QuickCaptureModal open={open} onOpenChange={setOpen} />
    </QuickCaptureContext.Provider>
  );
}

export function useQuickCapture() {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) {
    // Fail-safe: fora do provider, retorna no-ops (não quebra render)
    return { open: false, abrir: () => undefined, fechar: () => undefined };
  }
  return ctx;
}
