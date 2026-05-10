"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { QUICK_CAPTURE_OPEN_EVENT } from "@/lib/quick-capture";

/**
 * Modal carregado dinamicamente sem SSR.
 *
 * Por quê: o modal usa BlockEditor (BlockNote), que tem deps com hooks
 * de browser e quebra durante prerender estático de páginas que herdam
 * deste root layout (`/login`, `/_not-found`). Como o modal só é
 * relevante depois que o usuário aperta o atalho, lazy load é seguro
 * e melhora também o initial bundle do app.
 */
const QuickCaptureModal = dynamic(
  () => import("@/components/quick-capture-modal").then((m) => ({ default: m.QuickCaptureModal })),
  { ssr: false }
);

/**
 * Quick Capture — atalho global pra anotar algo em qualquer página
 * sem perder o contexto.
 *
 * Atalho:
 *   - `C` (sozinho, quando foco não está em input/textarea/contenteditable)
 *   - Botão ⚡ no header (sempre)
 *   - Command Palette → "Captura rápida" (sempre)
 *
 * Por que `C` e não `Ctrl+Shift+N`: Edge/Chrome/Firefox usam Ctrl+Shift+N
 * pra janela anônima — atalho reservado, não interceptável de forma
 * confiável. `C` (de "capture") segue convenção Linear/Notion/GitHub:
 * tecla única quando o usuário NÃO está digitando.
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

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const abrir = useCallback(() => setOpen(true), []);
  const fechar = useCallback(() => setOpen(false), []);

  // Atalho global: `C` sozinho quando o foco NÃO está em texto.
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
      // Ignora qualquer combinação com modifier — só queremos tecla solta
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Só dispara em `c` minúsculo. Shift+C aciona o navegador em alguns
      // contextos, e maiúscula geralmente vem com Shift, então filtra.
      if (e.key !== "c" && e.key !== "C") return;
      if (e.key === "C" && e.shiftKey) return;

      // Se está digitando algo, deixa passar.
      if (isEditing()) return;

      e.preventDefault();
      e.stopPropagation();
      setOpen((v) => !v);
    }

    function onCustomOpen() {
      setOpen(true);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener(QUICK_CAPTURE_OPEN_EVENT, onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(QUICK_CAPTURE_OPEN_EVENT, onCustomOpen);
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
