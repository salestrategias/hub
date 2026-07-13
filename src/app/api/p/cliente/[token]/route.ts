/**
 * GET  /api/p/cliente/[token]      → info inicial do portal + sessão
 * POST /api/p/cliente/[token]      → login com senha (cria cookie de sessão)
 *
 * GET sem cookie:
 *  - Sem senha → retorna info + cliente + permissões
 *  - Com senha → retorna { precisaSenha: true }
 *
 * GET com cookie válido:
 *  - Retorna info + RENOVA o cookie (sessão deslizante: cada visita
 *    estica a validade por mais 7 dias — cliente ativo nunca "cai")
 *
 * POST com { senha } → valida (com rate limit por token+IP), gera cookie,
 * retorna info
 */
import { apiHandler, ApiError } from "@/lib/api";
import {
  getAcessoPorToken,
  validarSenha,
  gerarCookieSessao,
  validarCookieSessao,
  registrarAcesso,
  COOKIE_PORTAL_CLIENTE,
} from "@/lib/cliente-acesso";
import { checarRateLimit, ipDoRequest } from "@/lib/rate-limit";
import { cookies } from "next/headers";

function criarSessao(token: string) {
  const cookie = gerarCookieSessao(token);
  cookies().set(COOKIE_PORTAL_CLIENTE, cookie.value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: cookie.maxAge,
    path: "/",
  });
}

async function montarInfo(token: string) {
  const r = await getAcessoPorToken(token);
  if (!r) throw new ApiError(404, "Acesso não encontrado ou desativado");
  registrarAcesso(r.acesso);
  return {
    cliente: {
      nome: r.cliente.nome,
      id: r.cliente.id,
      logoUrl: r.cliente.logoUrl,
      corPrimaria: r.cliente.corPrimaria,
    },
    permissoes: {
      verCalendario: r.acesso.verCalendario,
      verCriativos: r.acesso.verCriativos,
      verTarefas: r.acesso.verTarefas,
      verReunioes: r.acesso.verReunioes,
      verRelatorios: r.acesso.verRelatorios,
      podeAprovarPosts: r.acesso.podeAprovarPosts,
      podeAprovarCriativos: r.acesso.podeAprovarCriativos,
      podeComentar: r.acesso.podeComentar,
      podeEnviarConteudo: r.acesso.podeEnviarConteudo,
    },
  };
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const r = await getAcessoPorToken(params.token);
    if (!r) throw new ApiError(404, "Link inválido ou expirado");

    // Sessão válida? Renova (deslizante) e retorna info.
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const tokenSessao = validarCookieSessao(cookieValue);
    if (tokenSessao === params.token) {
      criarSessao(params.token);
      return montarInfo(params.token);
    }

    // Sem sessão e tem senha? Pede senha (com a marca do cliente na tela de login).
    if (r.acesso.senhaHash) {
      return {
        precisaSenha: true,
        clienteNome: r.cliente.nome,
        logoUrl: r.cliente.logoUrl,
        corPrimaria: r.cliente.corPrimaria,
      };
    }

    // Sem senha — cria sessão automática + retorna info
    criarSessao(params.token);
    return montarInfo(params.token);
  });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    // Freia brute-force de senha: 5 tentativas por token+IP a cada 15 min
    // (bcrypt já é caro, mas melhor nem chegar nele).
    checarRateLimit(`portal-senha:${params.token}:${ipDoRequest(req)}`, {
      max: 5,
      janelaMs: 15 * 60_000,
      mensagem: "Muitas tentativas de senha. Aguarde 15 minutos e tente de novo.",
    });

    const r = await getAcessoPorToken(params.token);
    if (!r) throw new ApiError(404, "Link inválido ou expirado");

    const body = (await req.json().catch(() => ({}))) as { senha?: string };
    const ok = await validarSenha(r.acesso, body.senha ?? null);
    if (!ok) throw new ApiError(401, "Senha incorreta");

    criarSessao(params.token);
    return montarInfo(params.token);
  });
}
