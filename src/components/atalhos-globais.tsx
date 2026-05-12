"use client";
/**
 * Atalhos globais de teclado — navegação rápida com tecla única.
 *
 * Convenção (mesma do Linear/Notion/GitHub): teclas únicas quando o
 * foco NÃO está em input/textarea/contenteditable. Quem está
 * digitando não é interrompido.
 *
 * Atalhos atuais:
 *   G → abre /calendario (Calendário unificado)
 *
 * (`C` é gerenciado separadamente pelo QuickCaptureProvider.)
 *
 * Pra adicionar mais (ex: L→/leads, T→/tarefas), só estender o map
 * abaixo.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ATALHOS: Record<string, string> = {
  g: "/calendario",
  // Convenções futuras (deixa documentado pra não conflitar):
  //   l → /leads
  //   t → /tarefas
  //   p → /projetos
  //   f → /financeiro
};

function isEditing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable;
}

export function AtalhosGlobais() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Sem modifiers — só tecla solta
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Ignora maiúsculas com Shift (Shift+G é cmd de bottom de página em alguns contextos)
      if (e.shiftKey) return;
      if (isEditing()) return;

      const k = e.key.toLowerCase();
      const destino = ATALHOS[k];
      if (!destino) return;

      e.preventDefault();
      router.push(destino);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
