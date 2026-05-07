/**
 * Coleta documentos relacionados a um cliente:
 *   - Briefings: notas na pasta "Briefings" que mencionam o cliente
 *   - Outras notas que mencionam o cliente (não-briefings)
 *
 * Usa a tabela `Mention` (alimentada pelo sync no save de notas) pra
 * descobrir quais notas estão linkadas. Performance: ~2 queries.
 */
import { prisma } from "@/lib/db";

export type DocumentoNota = {
  id: string;
  titulo: string;
  pasta: string;
  tags: string[];
  favorita: boolean;
  updatedAt: string;
};

export type ClienteDocumentos = {
  briefings: DocumentoNota[];
  outrasNotas: DocumentoNota[];
};

export async function buildClienteDocumentos(clienteId: string): Promise<ClienteDocumentos> {
  // Mentions onde target = este cliente, source = NOTA
  const mentions = await prisma.mention.findMany({
    where: { targetType: "CLIENTE", targetId: clienteId, sourceType: "NOTA" },
    select: { sourceId: true },
  });

  if (mentions.length === 0) {
    return { briefings: [], outrasNotas: [] };
  }

  const ids = Array.from(new Set(mentions.map((m) => m.sourceId)));
  const notas = await prisma.nota.findMany({
    where: { id: { in: ids } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titulo: true,
      pasta: true,
      tags: true,
      favorita: true,
      updatedAt: true,
    },
  });

  const briefings: DocumentoNota[] = [];
  const outrasNotas: DocumentoNota[] = [];

  for (const n of notas) {
    const item: DocumentoNota = {
      id: n.id,
      titulo: n.titulo,
      pasta: n.pasta,
      tags: n.tags,
      favorita: n.favorita,
      updatedAt: n.updatedAt.toISOString(),
    };
    if (n.pasta === "Briefings") briefings.push(item);
    else outrasNotas.push(item);
  }

  return { briefings, outrasNotas };
}
