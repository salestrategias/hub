/**
 * Constantes compartilhadas do Quick Capture.
 *
 * Vive numa lib neutra pra quebrar ciclo de import entre o Provider
 * (que renderiza o Modal) e o Modal (que precisa da chave do
 * localStorage). Importar de um dos dois geraria ciclo, com o
 * webpack/Next.js avaliando exports como `undefined` em prerender.
 */
export const QUICK_CAPTURE_DRAFT_KEY = "sal-hub-quick-capture-draft";

export const QUICK_CAPTURE_OPEN_EVENT = "sal-hub:quick-capture-open";
