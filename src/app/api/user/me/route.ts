import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { logActivityFromRequest } from "@/lib/activity-log";
import { z } from "zod";

// Validação do dataURL: aceita só image/jpeg, image/png, image/webp.
// Limite de ~150 KB pós base64 (após redimensionamento client-side ficamos bem abaixo).
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_LEN = 200_000;

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  image: z.string().max(MAX_LEN).optional().nullable().refine(
    (v) => v === null || v === undefined || v === "" || DATA_URL_RE.test(v),
    "Imagem deve ser um dataURL JPEG, PNG ou WebP"
  ),
});

export async function GET() {
  return apiHandler(async () => {
    const user = await requireAuth();
    return prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
    });
  });
}

export async function PATCH(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const data = schema.parse(await req.json());
    const result = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.image !== undefined ? { image: data.image || null } : {}),
      },
      select: { id: true, name: true, email: true, image: true, role: true },
    });
    await logActivityFromRequest(user.id, "MUDANCA_PERFIL", {
      campos: Object.keys(data),
      fotoAtualizada: data.image !== undefined,
    });
    return result;
  });
}
