import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createFolder } from "@/lib/google-drive";

/** Cria uma pasta no Drive do usuário e vincula ao cliente */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: params.id } });
    if (cliente.googleDriveFolderId) {
      return { ok: true, folderId: cliente.googleDriveFolderId, url: cliente.googleDriveFolderUrl };
    }
    const folder = await createFolder(cliente.nome);
    const updated = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        googleDriveFolderId: folder.id,
        googleDriveFolderUrl: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`,
      },
    });
    return { ok: true, folderId: updated.googleDriveFolderId, url: updated.googleDriveFolderUrl };
  });
}
