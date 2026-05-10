"use client";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickCapture } from "@/components/quick-capture-provider";

/**
 * Botão "raio" no header — atalho de descoberta pra Quick Capture.
 * O atalho de teclado é o jeito rápido (Cmd+Shift+N), mas o botão
 * existe pra quem não memorizou.
 */
export function QuickCaptureTrigger() {
  const { abrir } = useQuickCapture();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={abrir}
      aria-label="Captura rápida (Cmd+Shift+N)"
      title="Captura rápida · Cmd+Shift+N"
    >
      <Zap className="h-4 w-4" />
    </Button>
  );
}
