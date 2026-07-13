/**
 * GET /api/p/cliente/[token]/relatorio-mensal?ano=YYYY&mes=MM
 *
 * Versão PORTAL do relatório mensal em PDF — autenticada pela SESSÃO DO
 * CLIENTE (cookie + token), não pelo NextAuth interno. Corrige o 401 que
 * o cliente tomava na aba Relatórios (o endpoint interno
 * /api/clientes/[id]/relatorio-mensal exige login do Hub).
 *
 * Mesmo gerador do endpoint interno (montarRelatorioMensal +
 * RelatorioMensalPdf), só muda a autenticação e o escopo: o clienteId sai
 * da sessão — o cliente só consegue o PRÓPRIO relatório.
 *
 * Como o link abre em nova aba (<a target=_blank>), erros respondem uma
 * página HTML curtinha e amigável em vez de JSON.
 */
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { cookies } from "next/headers";
import { requerSessaoCliente, COOKIE_PORTAL_CLIENTE } from "@/lib/cliente-acesso";
import { ApiError } from "@/lib/api";
import { montarRelatorioMensal } from "@/lib/relatorio-mensal-data";
import { RelatorioMensalPdf } from "@/lib/relatorio-mensal-pdf";

const MESES_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Página de erro amigável (o cliente vê isso numa aba nova, não num fetch). */
function paginaErro(titulo: string, corpo: string, status: number): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#fafafa;color:#1b1730}
main{max-width:420px;padding:32px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#5d5773;line-height:1.5;margin:0}</style>
</head><body><main><h1>${titulo}</h1><p>${corpo}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const cookieValue = cookies().get(COOKIE_PORTAL_CLIENTE)?.value;
    const r = await requerSessaoCliente(params.token, cookieValue);
    if (!r.acesso.verRelatorios) {
      return paginaErro(
        "Relatórios não habilitados",
        "Este acesso não tem a área de relatórios liberada. Fale com seu contato na SAL.",
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const ano = searchParams.get("ano") ? parseInt(searchParams.get("ano")!, 10) : undefined;
    const mes = searchParams.get("mes") ? parseInt(searchParams.get("mes")!, 10) : undefined;
    const download = searchParams.get("download") === "1";

    const data = await montarRelatorioMensal(r.cliente.id, { ano, mes });

    const stream = await renderToStream(<RelatorioMensalPdf data={data} />);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) chunks.push(chunk);

    const slug = data.cliente.nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const filename = `relatorio-mensal-${slug}-${MESES_SHORT[data.mes - 1]}-${data.ano}.pdf`;

    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      return paginaErro(
        "Sessão expirada",
        "Volte pra aba do portal, recarregue a página e entre de novo — aí o relatório abre normalmente.",
        401
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[portal relatorio-mensal]", msg);
    return paginaErro(
      "Relatório indisponível agora",
      "Não conseguimos gerar o PDF neste momento. Tente de novo em instantes ou avise seu contato na SAL.",
      500
    );
  }
}
