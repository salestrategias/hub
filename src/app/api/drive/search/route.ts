import { apiHandler, requireAuth } from "@/lib/api";
import { searchFiles } from "@/lib/google-drive";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    if (!q) return [];
    return searchFiles(q);
  });
}
