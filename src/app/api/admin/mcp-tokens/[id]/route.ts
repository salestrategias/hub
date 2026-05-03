import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ALL_SCOPES } from "@/lib/mcp/scopes";
import { logActivityFromRequest } from "@/lib/activity-log";
import { z } from "zod";

const patchSchema = z.object({
  escopos: z.array(z.enum(["*", ...ALL_SCOPES] as [string, ...string[]])).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new Error("Apenas admins podem editar tokens MCP");
    const data = patchSchema.parse(await req.json());
    const updated = await prisma.mcpToken.update({
      where: { id: params.id },
      data,
      select: { id: true, nome: true, escopos: true },
    });
    if (data.escopos) {
      await logActivityFromRequest(user.id, "TOKEN_MCP_ESCOPOS_ALTERADOS", {
        tokenId: updated.id, nome: updated.nome, escopos: updated.escopos,
      });
    }
    return updated;
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new Error("Apenas admins podem revogar tokens MCP");
    const tk = await prisma.mcpToken.update({
      where: { id: params.id },
      data: { revogadoEm: new Date() },
      select: { id: true, nome: true },
    });
    await logActivityFromRequest(user.id, "TOKEN_MCP_REVOGADO", { tokenId: tk.id, nome: tk.nome });
    return { ok: true };
  });
}
