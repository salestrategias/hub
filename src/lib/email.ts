/**
 * Wrapper de envio de email via Resend.
 *
 * Por que Resend e não SES/SendGrid/Postmark:
 *  - SDK leve (sem peso de AWS SDK)
 *  - Free tier 100 emails/dia (suficiente pra notificações de 1 user)
 *  - Validação de domínio simples (4 DNS records, sem warmup)
 *  - API previsível (fire-and-forget, retorna messageId)
 *
 * Configuração necessária (env vars):
 *   RESEND_API_KEY  — chave da conta Resend (re_xxx)
 *   MAIL_FROM       — remetente, ex: "SAL Hub <notificacoes@salestrategias.com.br>"
 *   NEXT_PUBLIC_HUB_URL — URL pública do Hub (usada em CTAs de email)
 *
 * Sem RESEND_API_KEY o módulo loga warning e retorna sem erro — pra
 * não quebrar dev local nem build no Docker quando env não tá setada.
 */

let resendClient: import("resend").Resend | null = null;

async function getClient(): Promise<import("resend").Resend | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (resendClient) return resendClient;
  // Import dinâmico — evita carregar o módulo no bundle do client por engano,
  // e tolera ambiente onde a dep ainda não foi instalada (warn → null).
  try {
    const { Resend } = await import("resend");
    resendClient = new Resend(key);
    return resendClient;
  } catch (err) {
    console.warn("[email] resend não disponível:", err instanceof Error ? err.message : err);
    return null;
  }
}

export type EmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  /** Versão texto puro (fallback pra clientes sem HTML). Opcional. */
  text?: string;
  /** Reply-to override. Default = MAIL_FROM. */
  replyTo?: string;
};

export type EmailResult =
  | { ok: true; messageId: string }
  | { ok: false; motivo: "sem_api_key" | "sem_from" | "erro_envio"; detalhe?: string };

/**
 * Envia um email. Idempotência/dedup é responsabilidade do caller —
 * aqui é fire-and-forget.
 */
export async function enviarEmail(input: EmailInput): Promise<EmailResult> {
  const from = process.env.MAIL_FROM;
  if (!from) {
    console.warn("[email] MAIL_FROM não configurado — pulando envio");
    return { ok: false, motivo: "sem_from" };
  }

  const client = await getClient();
  if (!client) return { ok: false, motivo: "sem_api_key" };

  try {
    const res = await client.emails.send({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
      replyTo: input.replyTo,
    });

    if (res.error) {
      console.error("[email] erro Resend:", res.error);
      return { ok: false, motivo: "erro_envio", detalhe: res.error.message };
    }

    return { ok: true, messageId: res.data?.id ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[email] exceção:", msg);
    return { ok: false, motivo: "erro_envio", detalhe: msg };
  }
}

/**
 * Fallback de texto puro pra clientes que não renderizam HTML.
 * Tira tags, normaliza whitespace, decode de entidades básicas.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * URL pública do Hub, com fallback razoável.
 */
export function hubUrl(): string {
  return process.env.NEXT_PUBLIC_HUB_URL?.replace(/\/$/, "") ?? "https://hub.salestrategias.com.br";
}
