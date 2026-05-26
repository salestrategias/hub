/**
 * /api/leads/capture — endpoint público para o formulário do site institucional
 * (salestrategias.com.br).
 *
 * Autenticação: Bearer token via header `Authorization`. Token configurado em
 * SITE_FORM_TOKEN no .env. Falhas de auth retornam 401 sem detalhes.
 *
 * CORS: permite POST/OPTIONS de origens listadas em SITE_FORM_ALLOWED_ORIGINS
 * (CSV). Default: salestrategias.com.br e www.salestrategias.com.br.
 *
 * Responsável (owner) do lead: SITE_FORM_DEFAULT_OWNER_ID (cuid do User).
 * Se não existir, cai pro primeiro user ADMIN.
 *
 * Payload aceito (JSON):
 *   nome          string  obrigatório
 *   telefone      string  obrigatório
 *   email         string  obrigatório (formato email)
 *   tipoNegocio   string  opcional   ("E-commerce", "Varejo físico", etc)
 *   siteOuInsta   string  opcional
 *   mensagem      string  opcional
 *   origem        string  opcional   (default: "site-form")
 *
 * Resposta sucesso (201):
 *   { ok: true, id: string }
 *
 * Pipeline: cria Lead em status NOVO + prioridade NORMAL com origem
 * "site-form" (ou override). Score é calculado server-side.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { calcularLeadScore } from "@/lib/lead-score";

// ─── CORS ─────────────────────────────────────────────────────────────
const DEFAULT_ALLOWED_ORIGINS = [
  "https://salestrategias.com.br",
  "https://www.salestrategias.com.br",
];

function getAllowedOrigins(): string[] {
  const env = process.env.SITE_FORM_ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ALLOWED_ORIGINS;
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(originHeader: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const origin =
    originHeader && allowed.includes(originHeader) ? originHeader : allowed[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// ─── Validação ────────────────────────────────────────────────────────
const captureSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  telefone: z.string().trim().min(8, "Telefone obrigatório").max(40),
  email: z.string().trim().email("E-mail inválido").max(160),
  tipoNegocio: z.string().trim().max(80).optional().nullable().or(z.literal("")),
  siteOuInsta: z.string().trim().max(200).optional().nullable().or(z.literal("")),
  mensagem: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
  origem: z.string().trim().max(120).optional().nullable().or(z.literal("")),
});

// ─── Owner lookup ─────────────────────────────────────────────────────
async function getDefaultOwnerId(): Promise<string | null> {
  const fromEnv = process.env.SITE_FORM_DEFAULT_OWNER_ID;
  if (fromEnv) {
    const u = await prisma.user.findUnique({
      where: { id: fromEnv },
      select: { id: true },
    });
    if (u) return u.id;
  }
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

// ─── Handlers ─────────────────────────────────────────────────────────
export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));

  // ─── Bearer token ──────────────────────────────────────────────────
  const expectedToken = process.env.SITE_FORM_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "Endpoint não configurado (SITE_FORM_TOKEN ausente no servidor)" },
      { status: 503, headers },
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].trim() !== expectedToken) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers });
  }

  // ─── Parse + validate ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400, headers });
  }
  const parsed = captureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validação falhou", issues: parsed.error.issues },
      { status: 400, headers },
    );
  }
  const data = parsed.data;

  // ─── Owner ─────────────────────────────────────────────────────────
  const ownerId = await getDefaultOwnerId();
  if (!ownerId) {
    return NextResponse.json(
      { error: "Nenhum usuário responsável configurado no HUB" },
      { status: 500, headers },
    );
  }

  // ─── Anti-duplicação leve: se o mesmo email entrou há < 60s, devolve o
  //     existente em vez de criar duplicata. Protege contra double-submit. ─
  const since = new Date(Date.now() - 60_000);
  if (data.email) {
    const recent = await prisma.lead.findFirst({
      where: {
        contatoEmail: data.email,
        createdAt: { gte: since },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return NextResponse.json(
        { ok: true, id: recent.id, deduped: true },
        { status: 200, headers },
      );
    }
  }

  // ─── Notas estruturadas ────────────────────────────────────────────
  const notasParts: string[] = [];
  if (data.siteOuInsta) notasParts.push(`Site/Instagram: ${data.siteOuInsta}`);
  if (data.mensagem) notasParts.push(`\nMensagem do lead:\n${data.mensagem}`);
  const notas = notasParts.join("\n");

  // ─── Score ─────────────────────────────────────────────────────────
  const origem = data.origem || "site-form";
  const score = calcularLeadScore({
    contatoEmail: data.email,
    contatoTelefone: data.telefone,
    notas,
    valorEstimadoMensal: null,
    proximaAcaoEm: null,
    status: "NOVO",
    origem,
    updatedAt: new Date(),
  }).total;

  // ─── Create lead ───────────────────────────────────────────────────
  const created = await prisma.lead.create({
    data: {
      // Identidade
      empresa: data.nome, // fallback: cliente fornece só nome do contato
      contatoNome: data.nome,
      contatoEmail: data.email,
      contatoTelefone: data.telefone,
      segmento: data.tipoNegocio || null,
      origem,

      // Pipeline
      status: "NOVO",
      prioridade: "NORMAL",

      // Contexto
      notas,

      // Tags pra distinguir no kanban
      tags: ["site-form"],

      // Score auto
      score,

      // Responsável
      responsavel: ownerId,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201, headers });
}
