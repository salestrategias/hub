/**
 * GET /api/clientes/[id]/relatorio-mensal?ano=YYYY&mes=MM
 *
 * Gera PDF on-demand do relatório mensal do cliente. Sem persistência —
 * cada request renderiza do zero, garantindo dados sempre frescos.
 *
 * Query params:
 *   ano  — opcional, default mês corrente
 *   mes  — opcional (1-12), default mês corrente
 *   download — se "1", força attachment; senão inline (preview no navegador)
 *
 * Resposta: application/pdf stream
 */
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { requireAuth } from "@/lib/api";
import { montarRelatorioMensal } from "@/lib/relatorio-mensal-data";
import { RelatorioMensalPdf } from "@/lib/relatorio-mensal-pdf";

const MESES_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const ano = searchParams.get("ano") ? parseInt(searchParams.get("ano")!, 10) : undefined;
    const mes = searchParams.get("mes") ? parseInt(searchParams.get("mes")!, 10) : undefined;
    const download = searchParams.get("download") === "1";

    const data = await montarRelatorioMensal(params.id, { ano, mes });

    const stream = await renderToStream(<RelatorioMensalPdf data={data} />);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) chunks.push(chunk);

    // Nome amigável: relatorio-mensal-tavi-mai-2026.pdf
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
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[relatorio-mensal]", msg);
    return new Response(msg, { status: 500 });
  }
}
