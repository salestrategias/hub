"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Toggle "olho" inspirado em apps de banco (Nubank, Inter): com 1 click
 * todos os valores monetários viram `R$ ••••••`. Útil pra screenshare,
 * apresentações com cliente, etc.
 *
 * Estado persistido em localStorage. SSR-safe (default `false` antes do
 * mount, evita flash + mismatch hydration).
 */
type Ctx = {
  hidden: boolean;
  toggle: () => void;
  setHidden: (v: boolean) => void;
};

const HideValuesContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "sal-hub-hide-values";

export function HideValuesProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hidrata do localStorage uma vez no mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setHiddenState(true);
    } catch {
      // SSR safe / privacy mode
    }
    setHydrated(true);
  }, []);

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => setHidden(!hidden), [hidden, setHidden]);

  // Antes da hidratação: força `false` pra evitar flash/mismatch
  const value = hydrated ? { hidden, toggle, setHidden } : { hidden: false, toggle, setHidden };

  return <HideValuesContext.Provider value={value}>{children}</HideValuesContext.Provider>;
}

export function useHideValues() {
  const ctx = useContext(HideValuesContext);
  if (!ctx) {
    // Fallback fora do provider — sempre visível, nunca quebra render
    return { hidden: false, toggle: () => undefined, setHidden: () => undefined };
  }
  return ctx;
}
