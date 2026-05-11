/**
 * POST /api/drive/folder
 *
 * Cria pasta no Drive. Body:
 *   { name, parentId?, driveId? }
 *
 * Resolução do "onde criar":
 *  - parentId fornecido → cria dentro dessa pasta (Meu Drive ou Shared)
 *  - só driveId → cria na raiz do Shared Drive (Google aceita driveId
 *    como parentId válido)
 *  - nenhum → cria na raiz do "Meu Drive"
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { createFolder } from "@/lib/google-drive";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
  driveId: z.string().optional(),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { name, parentId, driveId } = schema.parse(await req.json());
    // parentId tem prioridade; se vier só driveId, usa ele como parent
    return createFolder(name, parentId ?? driveId);
  });
}
