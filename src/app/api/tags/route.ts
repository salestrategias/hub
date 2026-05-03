import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

const tagSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(40),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor hex inválida").default("#F59E0B"),
});

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.tag.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { clientes: true } } },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const data = tagSchema.parse(await req.json());
    return prisma.tag.create({ data });
  });
}
