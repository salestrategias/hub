import { apiHandler, requireAuth } from "@/lib/api";
import { listFiles, getParent } from "@/lib/google-drive";

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentId") || undefined;
    const [files, parent] = await Promise.all([
      listFiles({ parentId }),
      parentId ? getParent(parentId) : Promise.resolve(null),
    ]);
    return { files, parent };
  });
}
