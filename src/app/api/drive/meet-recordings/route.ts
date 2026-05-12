/**
 * GET /api/drive/meet-recordings?limit=30
 *
 * Lista Google Docs recentes do Drive que parecem ser transcrições do
 * Meet — pasta "Meet Recordings" + heurística por nome. Usado no modal
 * de import da reunião.
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { listMeetDocs } from "@/lib/google-docs";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "30", 10);
    return listMeetDocs({ limit });
  });
}
