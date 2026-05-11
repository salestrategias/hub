/**
 * Templates de email pra notificações.
 *
 * Por que HTML inline e não JSX/MJML/React Email:
 *  - Clientes de email (Gmail, Outlook, Apple Mail) suportam só CSS
 *    inline com subset limitado (sem flexbox, sem custom properties)
 *  - Volume baixo (1-10 emails/dia max) — não justifica complexidade
 *  - Build mais leve sem render React server-side adicional
 *
 * Paleta SAL: roxo primário #7E30E1, escuro #54199F, gray BG #F4F4F7.
 * Layout: header colorido + corpo branco + CTA + footer cinza.
 */
import type { TipoNotificacao } from "@prisma/client";
import { hubUrl } from "@/lib/email";

export type NotificacaoEmail = {
  tipo: TipoNotificacao;
  titulo: string;
  descricao: string | null;
  href: string | null;
};

export type TemplateRender = {
  subject: string;
  html: string;
  text: string;
};

const COR_PRIMARIA = "#7E30E1";
const COR_DARK = "#54199F";

/**
 * Tipos que disparam email. Outros (REUNIAO_HOJE, POST_HOJE) ficam só
 * no sininho pra não virar spam. Marcelo pode editar essa lista pra
 * personalizar — ou no futuro virar preferência por user.
 */
export const TIPOS_QUE_DISPARAM_EMAIL: TipoNotificacao[] = [
  "CONTRATO_VENCENDO",
  "TAREFA_ATRASADA",
  "PROPOSTA_VISTA",
  "PROPOSTA_ACEITA",
  "PROPOSTA_RECUSADA",
  "ACTION_ITEM_ATRASADO",
];

/**
 * Emoji prefixo por tipo — usado no subject pra Marcelo bater o olho
 * na inbox e saber a categoria sem abrir.
 */
const EMOJI: Record<TipoNotificacao, string> = {
  CONTRATO_VENCENDO: "📅",
  ACTION_ITEM_ATRASADO: "⚠️",
  TAREFA_ATRASADA: "🔴",
  REUNIAO_HOJE: "🎙️",
  POST_HOJE: "📣",
  PROPOSTA_VISTA: "👀",
  PROPOSTA_ACEITA: "🎉",
  PROPOSTA_RECUSADA: "💔",
  SISTEMA: "🔔",
};

const CTA_LABEL: Record<TipoNotificacao, string> = {
  CONTRATO_VENCENDO: "Ver contrato",
  ACTION_ITEM_ATRASADO: "Ver ação pendente",
  TAREFA_ATRASADA: "Abrir tarefa",
  REUNIAO_HOJE: "Ver reunião",
  POST_HOJE: "Abrir editorial",
  PROPOSTA_VISTA: "Ver proposta",
  PROPOSTA_ACEITA: "Ver proposta",
  PROPOSTA_RECUSADA: "Ver proposta",
  SISTEMA: "Abrir Hub",
};

export function renderNotificacaoEmail(n: NotificacaoEmail): TemplateRender {
  const url = n.href ? `${hubUrl()}${n.href}` : hubUrl();
  const subject = `${EMOJI[n.tipo]} ${n.titulo}`;
  const html = montarHtml({
    titulo: n.titulo,
    descricao: n.descricao,
    ctaLabel: CTA_LABEL[n.tipo],
    ctaUrl: url,
  });
  const text = [
    n.titulo,
    n.descricao ?? "",
    "",
    `Abrir no SAL Hub: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

function montarHtml(opts: {
  titulo: string;
  descricao: string | null;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  // Email-safe: tabela centralizada, inline styles, fontes web-safe.
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${COR_PRIMARIA} 0%,${COR_DARK} 100%);padding:24px 32px;">
              <div style="color:#ffffff;font-weight:600;font-size:14px;letter-spacing:0.5px;text-transform:uppercase;opacity:0.85;">
                SAL Hub · Notificação
              </div>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;line-height:1.4;color:#1a1a1a;">
                ${escapeHtml(opts.titulo)}
              </h1>
              ${
                opts.descricao
                  ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#52525b;">${escapeHtml(opts.descricao)}</p>`
                  : ""
              }

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:${COR_PRIMARIA};">
                    <a href="${escapeAttr(opts.ctaUrl)}"
                       style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${escapeHtml(opts.ctaLabel)} →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#FAFAFA;border-top:1px solid #E5E5E5;">
              <p style="margin:0;font-size:11px;color:#71717A;line-height:1.5;">
                Você recebeu este email porque tem uma conta no SAL Hub.<br>
                <a href="${escapeAttr(hubUrl())}" style="color:${COR_PRIMARIA};text-decoration:none;">${escapeHtml(hubUrl().replace(/^https?:\/\//, ""))}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
