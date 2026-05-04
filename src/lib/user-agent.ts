/**
 * Funções puras de parsing — seguras para importar tanto em Server quanto Client Components.
 * Não depende de `next/headers` nem de prisma.
 */

/**
 * Extrai IP do cliente respeitando proxies (Nginx/Traefik → app).
 * Aceita X-Forwarded-For (primeiro IP da lista), X-Real-IP, ou fallback.
 */
export function ipFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? null;
}

/**
 * Parser leve de User-Agent — sem dependência externa.
 * Retorna { dispositivo, navegador, os } no formato curto pra exibição.
 */
export function parseUserAgent(ua: string | null | undefined): { dispositivo: string; navegador: string; os: string } {
  if (!ua) return { dispositivo: "Desconhecido", navegador: "—", os: "—" };

  // OS
  let os = "Outro";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua) && !/Mobile/.test(ua)) os = "macOS";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  // Navegador (ordem importa: Edge antes de Chrome, Chrome antes de Safari)
  let navegador = "Outro";
  if (/Edg\//.test(ua)) navegador = "Edge";
  else if (/OPR\//.test(ua)) navegador = "Opera";
  else if (/Firefox\//.test(ua)) navegador = "Firefox";
  else if (/Chrome\//.test(ua)) navegador = "Chrome";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) navegador = "Safari";
  else if (/Claude/i.test(ua)) navegador = "Claude";

  // Tipo de dispositivo
  let dispositivo = "Desktop";
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) dispositivo = "Celular";
  else if (/iPad|Tablet/i.test(ua)) dispositivo = "Tablet";

  return { dispositivo, navegador, os };
}
