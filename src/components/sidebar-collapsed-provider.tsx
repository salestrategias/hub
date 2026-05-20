"use client";
/**
 * Estado global "sidebar colapsada" — preferência por usuário, persistida
 * em localStorage pra sobreviver entre sessões.
 *
 * Por que localStorage e não DB: é puramente preferência visual, não vale
 * a viagem ao server + complicar SSR. Aceita-se um flash mínimo na 1ª
 * carga (sidebar começa expandida, useEffect lê localStorage e ajusta).
 *
 * Atalho: tecla `[` (sem modifier) toggle, igual ao padrão do Hub
 * (G→/calendario, C→quick-capture, etc).
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "sal-hub-sidebar-collapsed";

type Ctx = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

const SidebarCollapsedCtx = createContext<Ctx | null>(null);

function isEditing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable;
}

export function SidebarCollapsedProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  // Restaura preferência ao montar (1x)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsedState(true);
    } catch {
      // localStorage indisponível — segue com default
    }
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Atalho global: `[` toggle quando não está digitando
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "[") return;
      if (isEditing()) return;
      e.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <SidebarCollapsedCtx.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarCollapsedCtx.Provider>
  );
}

export function useSidebarCollapsed() {
  const ctx = useContext(SidebarCollapsedCtx);
  if (!ctx) {
    return { collapsed: false, toggle: () => undefined, setCollapsed: () => undefined };
  }
  return ctx;
}
