"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

/**
 * Pílula de busca "Buscar em tudo… ⌘K" no topbar (desktop ≥lg).
 * Igual ao SidebarSearchTrigger, dispara o mesmo keydown ⌘K que o
 * CommandPalette já escuta — reusa o palette existente sem duplicar lógica.
 */
export function TopbarSearchTrigger() {
  const [shortcut, setShortcut] = useState("⌘K");

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    setShortcut(isMac ? "⌘K" : "Ctrl K");
  }, []);

  function open() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  }

  return (
    <button
      type="button"
      onClick={open}
      className="hidden lg:flex items-center gap-2 h-9 w-[280px] px-3 rounded-lg bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Buscar em tudo"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="text-[13px]">Buscar em tudo…</span>
      <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/60 border border-border text-muted-foreground">
        {shortcut}
      </kbd>
    </button>
  );
}
