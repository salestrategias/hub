"use client";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickCapture } from "@/components/quick-capture-provider";

/**
 * Botão "raio" no header — atalho de descoberta pra Quick Capture.
 * O atalho de teclado (tecla `C` solta) é o jeito rápido, mas o botão
 * existe pra quem não memorizou.
 */
export function QuickCaptureTrigger() {
  const { abrir } = useQuickCapture();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={abrir}
      aria-label="Captura rápida (tecla C)"
      title="Captura rápida · tecla C"
    >
      <Zap className="h-4 w-4" />
    </Button>
  );
}
