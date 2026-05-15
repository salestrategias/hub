/**
 * GET /api/p/cliente/[token]/criativos
 *
 * Criativos de tráfego pago visíveis pro cliente. Filtra:
 *  - Só do cliente do token
 *  - Só status que faz sentido pro cliente ver (RASCUNHO fica interno)
 */
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { cookies } from "next/headers";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  return apiHandler(async () => {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.verCriativos) throw new Error("Sem permissão pra criativos");

    const criativos = await prisma.criativo.findMany({
      where: {
        clienteId: r.cliente.id,
        // Cliente vê de EM_APROVACAO em diante (rascunhos não escapam)
        status: { in: ["EM_APROVACAO", "APROVADO", "RECUSADO", "NO_AR", "PAUSADO", "ENCERRADO"] },
      },
      include: {
        comentarios: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, tipo: true, texto: true, createdAt: true },
        },
        arquivos: {
          orderBy: { ordem: "asc" },
          select: { id: true, tipo: true, url: true, nome: true, legenda: true, ordem: true },
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    return criativos.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      status: c.status,
      plataforma: c.plataforma,
      formato: c.formato,
      textoPrincipal: c.textoPrincipal,
      headline: c.headline,
      descricao: c.descricao,
      ctaBotao: c.ctaBotao,
      urlDestino: c.urlDestino,
      publicoAlvo: c.publicoAlvo,
      // orçamento e datas: ficam INTERNOS — não expõe pro cliente
      inicio: c.inicio?.toISOString() ?? null,
      fim: c.fim?.toISOString() ?? null,
      // observacoesProducao é interno — NÃO expõe pro cliente
      arquivos: c.arquivos,
      comentarios: c.comentarios.map((co) => ({
        ...co,
        createdAt: co.createdAt.toISOString(),
      })),
    }));
  });
}
