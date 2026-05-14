/**
 * Admin do Portal do Cliente.
 *
 *  GET    /api/clientes/[id]/acesso      → estado atual do acesso (ou null)
 *  POST   /api/clientes/[id]/acesso      → cria ou atualiza acesso
 *  DELETE /api/clientes/[id]/acesso      → desabilita (não deleta — preserva audit)
 *
 * Body do POST/PATCH:
 *   ativo, verCalendario, verTarefas, verReunioes, verRelatorios,
 *   podeAprovarPosts, podeComentar, senha (string ou null)
 *
 * Se senha vier preenchida → re-hashea. Se vier null → remove senha.
 * Se vier undefined → mantém senha atual.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

const acessoSchema = z.object({
  ativo: z.boolean().optional(),
  verCalendario: z.boolean().optional(),
  verTarefas: z.boolean().optional(),
  verReunioes: z.boolean().optional(),
  verRelatorios: z.boolean().optional(),
  podeAprovarPosts: z.boolean().optional(),
  podeComentar: z.boolean().optional(),
  senha: z.string().min(4).max(40).nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const acesso = await prisma.clienteAcesso.findUnique({
      where: { clienteId: params.id },
    });
    if (!acesso) return null;
    // NÃO retorna senhaHash, mas retorna `temSenha`
    return {
      id: acesso.id,
      token: acesso.token,
      ativo: acesso.ativo,
      temSenha: !!acesso.senhaHash,
      verCalendario: acesso.verCalendario,
      verTarefas: acesso.verTarefas,
      verReunioes: acesso.verReunioes,
      verRelatorios: acesso.verRelatorios,
      podeAprovarPosts: acesso.podeAprovarPosts,
      podeComentar: acesso.podeComentar,
      ultimoAcesso: acesso.ultimoAcesso?.toISOString() ?? null,
      totalAcessos: acesso.totalAcessos,
      createdAt: acesso.createdAt.toISOString(),
    };
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = acessoSchema.parse(await req.json());

    const existente = await prisma.clienteAcesso.findUnique({
      where: { clienteId: params.id },
    });

    // Resolve senha (3 modos)
    let senhaHashUpdate: string | null | undefined;
    if (body.senha === null) senhaHashUpdate = null; // remove
    else if (typeof body.senha === "string") senhaHashUpdate = await bcrypt.hash(body.senha, 10);
    // undefined → não muda

    if (existente) {
      const upd = await prisma.clienteAcesso.update({
        where: { id: existente.id },
        data: {
          ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
          ...(body.verCalendario !== undefined ? { verCalendario: body.verCalendario } : {}),
          ...(body.verTarefas !== undefined ? { verTarefas: body.verTarefas } : {}),
          ...(body.verReunioes !== undefined ? { verReunioes: body.verReunioes } : {}),
          ...(body.verRelatorios !== undefined ? { verRelatorios: body.verRelatorios } : {}),
          ...(body.podeAprovarPosts !== undefined ? { podeAprovarPosts: body.podeAprovarPosts } : {}),
          ...(body.podeComentar !== undefined ? { podeComentar: body.podeComentar } : {}),
          ...(senhaHashUpdate !== undefined ? { senhaHash: senhaHashUpdate } : {}),
        },
      });
      return { id: upd.id, token: upd.token, ativo: upd.ativo, temSenha: !!upd.senhaHash };
    }

    // Cria novo — gera token aleatório
    const token = randomBytes(16).toString("hex");
    const novo = await prisma.clienteAcesso.create({
      data: {
        clienteId: params.id,
        token,
        senhaHash: senhaHashUpdate ?? null,
        ativo: body.ativo ?? true,
        verCalendario: body.verCalendario ?? true,
        verTarefas: body.verTarefas ?? false,
        verReunioes: body.verReunioes ?? false,
        verRelatorios: body.verRelatorios ?? true,
        podeAprovarPosts: body.podeAprovarPosts ?? true,
        podeComentar: body.podeComentar ?? true,
        criadoPor: user.id,
      },
    });
    return { id: novo.id, token: novo.token, ativo: novo.ativo, temSenha: !!novo.senhaHash };
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    await prisma.clienteAcesso.updateMany({
      where: { clienteId: params.id },
      data: { ativo: false },
    });
    return { ok: true };
  });
}
