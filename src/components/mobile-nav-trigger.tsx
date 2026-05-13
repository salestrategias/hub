"use client";
/**
 * Botão hamburger + drawer mobile da sidebar.
 *
 * Componente standalone (client) que encapsula o estado do drawer +
 * trigger. Inserido no <Header> (server component) — não precisa de
 * context global.
 *
 * Auto-fecha ao navegar (lógica no próprio MobileSidebar via useEffect).
 */
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileSidebar } from "@/components/sidebar";

export function MobileNavTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden -ml-1"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <MobileSidebar open={open} onOpenChange={setOpen} />
    </>
  );
}
