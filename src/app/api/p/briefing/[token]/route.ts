/**
 * Endpoint PÚBLICO de submissão do briefing (cliente responde sem login).
 *
 * POST /api/p/briefing/[token]
 *   - Autenticação implícita pelo token (16 bytes hex) — o token é o acesso.
 *   - Valida: briefing existe + não expirado (shareExpiraEm).
 *   - Valida que TODAS as perguntas obrigatórias vieram preenchidas.
 *   - Grava `respostas` = { [perguntaId]: valor }, status=RESPONDIDO,
 *     respondidoEm=now (idempotente: reenvio sobrescreve as respostas).
 *   - Notifica o criador do briefing (sem email — evento inbound).
 *
 * Sem auth (igual aos outros /api/p/*). Erros com status explícito.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizarPerguntas } from "@/lib/briefing";

function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

/** Saneia o valor cru de uma resposta → string | string[] (ou descarta). */
function sanearValor(v: unknown): string | string[] | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const arr = v.filter((x): x is string => typeof x === "string");
    return arr;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function vazio(v: string | string[] | undefined): boolean {
  if (v == null) return true;
  return Array.isArray(v) ? v.length === 0 : v.trim() === "";
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const briefing = await prisma.briefing.findUnique({
      where: { shareToken: params.token },
      select: {
        id: true,
        titulo: true,
        perguntas: true,
        clienteNome: true,
        shareExpiraEm: true,
        criadoPor: true,
      },
    });

    if (!briefing) return erro("Briefing não encontrado", 404);
    if (briefing.shareExpiraEm && briefing.shareExpiraEm < new Date()) {
      return erro("Este link expirou.", 410);
    }

    const body = (await req.json().catch(() => ({}))) as { respostas?: Record<string, unknown> };
    const brutas = body.respostas && typeof body.respostas === "object" ? body.respostas : {};

    const perguntas = normalizarPerguntas(briefing.perguntas);
    const idsValidos = new Set(perguntas.map((p) => p.id));

    // Só persiste respostas de perguntas que existem no snapshot atual.
    const respostas: Record<string, string | string[]> = {};
    for (const [pid, raw] of Object.entries(brutas)) {
      if (!idsValidos.has(pid)) continue;
      const v = sanearValor(raw);
      if (v === undefined || vazio(v)) continue;
      respostas[pid] = v;
    }

    // Valida obrigatórias no servidor (defesa — o client já valida pra UX).
    const faltando = perguntas.filter((p) => p.obrigatoria && vazio(respostas[p.id]));
    if (faltando.length > 0) {
      return NextResponse.json(
        {
          error: `Faltam ${faltando.length} ${faltando.length === 1 ? "pergunta obrigatória" : "perguntas obrigatórias"}.`,
          faltando: faltando.map((p) => p.id),
        },
        { status: 422 }
      );
    }

    const respondidoEm = new Date();
    await prisma.briefing.update({
      where: { id: briefing.id },
      data: {
        respostas: respostas as unknown as Prisma.InputJsonValue,
        status: "RESPONDIDO",
        respondidoEm,
      },
    });

    // Notifica o criador (Marcelo). Reusa o tipo inbound CLIENTE_SUBMETEU_CONTEUDO
    // (não dispara email). Só cria se houver um criador associado.
    if (briefing.criadoPor) {
      const quem = briefing.clienteNome ?? "Cliente";
      await prisma.notificacao
        .create({
          data: {
            userId: briefing.criadoPor,
            tipo: "CLIENTE_SUBMETEU_CONTEUDO",
            titulo: `📝 ${quem} respondeu o briefing`,
            descricao: `"${briefing.titulo}" — respostas disponíveis pra revisar`,
            href: `/briefings/${briefing.id}`,
            entidadeTipo: "BRIEFING",
            entidadeId: briefing.id,
            chave: `BRIEFING_RESPONDIDO:${briefing.id}:${respondidoEm.toISOString().slice(0, 10)}`,
          },
        })
        .catch(() => undefined);
    }

    return NextResponse.json({ ok: true, respondidoEm: respondidoEm.toISOString() });
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Erro", 500);
  }
}
