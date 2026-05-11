/**
 * GET /api/drive/list
 *
 * Lista conteúdo de uma pasta. Query params:
 *   parentId — ID de pasta específica (Meu Drive ou Shared Drive)
 *   driveId  — usado quando estamos na raiz de um Shared Drive
 *              (sem parentId, lista os itens raiz do drive)
 *
 * Sem nenhum dos dois: lista raiz do "Meu Drive".
 *
 * Retorna { files, parent } — `parent` é o file da pasta atual (pra
 * breadcrumb). Null quando está num root.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { listFiles, getParent } from "@/lib/google-drive";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentId") || undefined;
    const driveId = searchParams.get("driveId") || undefined;

    const [files, parent] = await Promise.all([
      listFiles({ parentId, driveId }),
      parentId ? getParent(parentId) : Promise.resolve(null),
    ]);
    return { files, parent };
  });
}
