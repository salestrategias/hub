/**
 * GET /api/drive/drives
 *
 * Lista os Shared Drives (Drives Compartilhados) acessíveis pelo
 * usuário autenticado. Vazio = só tem Meu Drive pessoal.
 *
 * Usado pelo DriveBrowser pra montar o seletor "Meu Drive | Drive
 * X | Drive Y" no topo do navegador.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { listSharedDrives } from "@/lib/google-drive";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return listSharedDrives();
  });
}
