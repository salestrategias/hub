/**
 * GET  /api/p/cliente/[token]      → info inicial do portal + sessão
 * POST /api/p/cliente/[token]      → login com senha (cria cookie de sessão)
 *
 * GET sem cookie:
 *  - Sem senha → retorna info + cliente + permissões
 *  - Com senha → retorna { precisaSenha: true }
 *
 * GET com cookie válido:
 *  - Retorna info normalmente, ignora senha
 *
 * POST com { senha } → valida, gera cookie, retorna info
 */
import { apiHandler } from "@/lib/api";
import {
  getAcessoPorToken,
  validarSenha,
  gerarCookieSessao,
  validarCookieSessao,
  registrarAcesso,
  COOKIE_PORTAL_CLIENTE,
} from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

async function montarInfo(token: string) {
  const r = await getAcessoPorToken(token);
  if (!r) throw new Error("Acesso não encontrado ou desativado");
  registrarAcesso(r.acesso.id);
  return {
    cliente: { nome: r.cliente.nome, id: r.cliente.id },
    permissoes: {
      verCalendario: r.acesso.verCalendario,
      verCriativos: r.acesso.verCriativos,
      verTarefas: r.acesso.verTarefas,
      verReunioes: r.acesso.verReunioes,
      verRelatorios: r.acesso.verRelatorios,
      podeAprovarPosts: r.acesso.podeAprovarPosts,
      podeAprovarCriativos: r.acesso.podeAprovarCriativos,
      podeComentar: r.acesso.podeComentar,
    },
  };
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const r = await getAcessoPorToken(params.token);
    if (!r) throw new Error("Link inválido ou expirado");

    // Sessão válida?
    const cookieJar = cookies();
    const cookieValue = cookieJar.get(COOKIE_PORTAL_CLIENTE)?.value;
    const tokenSessao = validarCookieSessao(cookieValue);
    if (tokenSessao === params.token) {
      // Sessão OK → retorna info
      return montarInfo(params.token);
    }

    // Sem sessão e tem senha? Pede senha.
    if (r.acesso.senhaHash) {
      return { precisaSenha: true, clienteNome: r.cliente.nome };
    }

    // Sem senha — cria sessão automática + retorna info
    const cookie = gerarCookieSessao(params.token);
    cookieJar.set(COOKIE_PORTAL_CLIENTE, cookie.value, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: cookie.maxAge,
      path: "/",
    });
    return montarInfo(params.token);
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const r = await getAcessoPorToken(params.token);
    if (!r) throw new Error("Link inválido ou expirado");

    const body = (await req.json().catch(() => ({}))) as { senha?: string };
    const ok = await validarSenha(r.acesso, body.senha ?? null);
    if (!ok) throw new Error("Senha incorreta");

    // Cria sessão
    const cookie = gerarCookieSessao(params.token);
    cookies().set(COOKIE_PORTAL_CLIENTE, cookie.value, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: cookie.maxAge,
      path: "/",
    });
    return montarInfo(params.token);
  });
}
