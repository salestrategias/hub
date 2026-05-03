import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  clienteId: z.string(),
  fileId: z.string(),
  nome: z.string(),
  mimeType: z.string().optional(),
  webViewLink: z.string().optional().nullable(),
  iconLink: z.string().optional().nullable(),
  isFolder: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = schema.parse(await req.json());
    return prisma.driveArquivo.create({ data });
  });
}

export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId");
    return prisma.driveArquivo.findMany({
      where: clienteId ? { clienteId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  });
}
