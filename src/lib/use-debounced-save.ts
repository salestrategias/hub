"use client";
import { useCallback, useEffect, useRef } from "react";

/**
 * Hook pra agrupar várias chamadas síncronas (ex: BlockEditor.onChange
 * disparando a cada keystroke) numa única chamada `save` após `delayMs`
 * sem atividade.
 *
 * Diferente do `setTimeout` cru, o hook:
 *  - Cancela o timer pendente no unmount (evita "save fantasma" após
 *    a sheet fechar)
 *  - Mantém apenas o ÚLTIMO payload — chamadas sucessivas substituem o
 *    anterior, garantindo que o save final tem o conteúdo mais recente
 *  - `flush()` força o save imediato (útil ao fechar dialog/sheet ou
 *    desmontar pra não perder edição em andamento)
 *
 * Resolve race condition do padrão "fire-and-forget per keystroke" que
 * causava PATCHes sobrepostos e perda de conteúdo quando respostas
 * fora de ordem sobrescreviam o estado local.
 *
 * @example
 * const debouncedSave = useDebouncedSave(
 *   async (legenda: string) => patchPost({ legenda }),
 *   700
 * );
 * <BlockEditor onChange={(blocks) => debouncedSave(JSON.stringify(blocks))} />
 */
export function useDebouncedSave<T>(
  save: (value: T) => Promise<unknown> | unknown,
  delayMs = 700
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  const saveRef = useRef(save);

  // Mantém ref atual do save sem invalidar callbacks (evita render loop
  // quando o caller cria novo callback a cada render)
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const { value } = pending.current;
      pending.current = null;
      void saveRef.current(value);
    }
  }, []);

  const trigger = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (pending.current) {
          const v = pending.current.value;
          pending.current = null;
          void saveRef.current(v);
        }
      }, delayMs);
    },
    [delayMs]
  );

  // Flush no unmount pra não perder edição pendente quando user fecha
  // sheet/dialog antes do debounce expirar
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return { trigger, flush };
}
