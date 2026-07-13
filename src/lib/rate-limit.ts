/**
 * Rate limiter em memória (janela deslizante) — suficiente pro deploy
 * atual (1 container Node). Se um dia houver múltiplas réplicas, trocar
 * por algo compartilhado (Redis) atrás da mesma assinatura.
 *
 * Uso típico (rota de senha do portal):
 *   checarRateLimit(`portal-senha:${token}:${ip}`, { max: 5, janelaMs: 15 * 60_000 });
 * Lança ApiError(429) quando estoura — cai direto no apiHandler.
 */
import { ApiError } from "@/lib/api";

type Registro = { hits: number[]; };

const buckets = new Map<string, Registro>();

/** Evita crescer sem limite: faxina oportunista a cada chamada. */
const MAX_BUCKETS = 5_000;

export function checarRateLimit(
  chave: string,
  { max, janelaMs, mensagem }: { max: number; janelaMs: number; mensagem?: string }
): void {
  const agora = Date.now();
  const corte = agora - janelaMs;

  let reg = buckets.get(chave);
  if (!reg) {
    if (buckets.size >= MAX_BUCKETS) {
      // Faxina: derruba buckets sem hit dentro da janela.
      for (const [k, v] of buckets) {
        if (v.hits.length === 0 || v.hits[v.hits.length - 1] < corte) buckets.delete(k);
      }
    }
    reg = { hits: [] };
    buckets.set(chave, reg);
  }

  reg.hits = reg.hits.filter((t) => t >= corte);
  if (reg.hits.length >= max) {
    throw new ApiError(
      429,
      mensagem ?? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
    );
  }
  reg.hits.push(agora);
}

/** Extrai IP do request atrás do nginx/Cloudflare (fallback: "?"). */
export function ipDoRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "?";
}
