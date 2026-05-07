"use client";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHideValues } from "@/components/hide-values-provider";

/**
 * Botão "olho" no header. Click alterna entre mostrar/ocultar todos os
 * valores monetários do app. Estado persiste em localStorage.
 */
export function HideValuesToggle() {
  const { hidden, toggle } = useHideValues();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
      title={hidden ? "Mostrar valores" : "Ocultar valores (apresentação)"}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}
