import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { seoKeywordSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = seoKeywordSchema.parse(await req.json());
    return prisma.seoKeyword.create({ data });
  });
}
