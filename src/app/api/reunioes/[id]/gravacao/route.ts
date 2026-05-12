/**
 * PATCH /api/reunioes/[id]/gravacao
 *
 * Vincula manualmente uma gravação à reunião — usado quando a busca
 * automática (durante o import do Meet) não achou o MP4, ou quando
 * Marcelo quer trocar pra outra gravação.
 *
 * Body:
 *   { url: string }   — URL do Drive (qualquer formato aceito), ou
 *   { url: null }     — desvincula (remove gravação)
 */
import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { urlEmbedDrive } from "@/lib/google-docs";
import { z } from "zod";

const schema = z.object({
  url: z.string().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAuth();
    const { url } = schema.parse(await req.json());

    if (url === null || url.trim() === "") {
      await prisma.reuniao.update({
        where: { id: params.id },
        data: { audioUrl: null },
      });
      return { ok: true, audioUrl: null };
    }

    const embed = urlEmbedDrive(url);
    if (!embed) throw new Error("URL inválida — use link do Google Drive");

    await prisma.reuniao.update({
      where: { id: params.id },
      data: { audioUrl: embed },
    });
    return { ok: true, audioUrl: embed };
  });
}
