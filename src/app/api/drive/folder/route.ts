import { apiHandler, requireAuth } from "@/lib/api";
import { createFolder } from "@/lib/google-drive";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1), parentId: z.string().optional() });

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { name, parentId } = schema.parse(await req.json());
    return createFolder(name, parentId);
  });
}
