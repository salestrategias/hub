import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { generateMcpToken } from "@/lib/mcp/auth";
import { ALL_SCOPES } from "@/lib/mcp/scopes";
import { logActivityFromRequest } from "@/lib/activity-log";
import { z } from "zod";

const escoposValidos = z.array(z.enum(["*", ...ALL_SCOPES] as [string, ...string[]]));

const createSchema = z.object({
  nome: z.string().min(1).max(100),
  expiraEm: z.coerce.date().optional().nullable(),
  escopos: escoposValidos.default(["*"]),
});

export async function GET() {
  return apiHandler(async () => {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new Error("Apenas admins podem gerenciar tokens MCP");
    return prisma.mcpToken.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, nome: true, prefixo: true, ultimoUso: true, expiraEm: true,
        revogadoEm: true, totalChamadas: true, createdAt: true, escopos: true,
      },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new Error("Apenas admins podem criar tokens MCP");
    const data = createSchema.parse(await req.json());
    const { token, hash, prefixo } = generateMcpToken();
    const created = await prisma.mcpToken.create({
      data: {
        nome: data.nome,
        hash,
        prefixo,
        expiraEm: data.expiraEm ?? null,
        escopos: data.escopos,
      },
      select: { id: true, nome: true, prefixo: true, expiraEm: true, escopos: true, createdAt: true },
    });
    await logActivityFromRequest(user.id, "TOKEN_MCP_CRIADO", {
      tokenId: created.id, nome: created.nome, escopos: created.escopos,
    });
    return { ...created, token };
  });
}
