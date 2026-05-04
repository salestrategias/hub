"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

/**
 * Botão visualmente parecido com input, mas é trigger pra abrir Command Palette.
 * O Palette em si vive em `command-palette.tsx`. Este componente apenas dispara
 * o evento `keydown` ⌘K no document, que o palette já escuta.
 */
export function SidebarSearchTrigger() {
  const [shortcut, setShortcut] = useState("⌘K");

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    setShortcut(isMac ? "⌘K" : "Ctrl+K");
  }, []);

  function open() {
    // Dispara o mesmo evento que o usuário daria com ⌘K — assim Command Palette abre
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  }

  return (
    <button
      type="button"
      onClick={open}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors text-[12px]"
      aria-label="Abrir busca global"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left">Buscar...</span>
      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
        {shortcut}
      </kbd>
    </button>
  );
}
