"use client";
import { Component, type ReactNode } from "react";

/**
 * Error boundary específico pro BlockEditor/BlockRenderer.
 *
 * Por que: BlockNote + ProseMirror podem crashar ao renderizar
 * conteúdo malformado (mention com props inválidas, blocos legados, etc).
 * Quando isso acontece sem boundary, o React desmonta a árvore inteira
 * e o user perde o resto do form/sheet.
 *
 * Com boundary: o BlockEditor crashado é substituído por um fallback
 * (renderizado pelo prop `fallback`), e o resto da UI continua usável.
 *
 * Uso:
 *   <EditorBoundary fallback={(err) => <Textarea ... />}>
 *     <BlockEditor ... />
 *   </EditorBoundary>
 */
type Props = {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Logging opcional pra telemetria */
  onError?: (error: Error) => void;
};

type State = { error: Error | null };

export class EditorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Loga no console pra debug — fallback assume controle visual
    // eslint-disable-next-line no-console
    console.error("[EditorBoundary] Editor crashou, usando fallback:", error);
    this.props.onError?.(error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
