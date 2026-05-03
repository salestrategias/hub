import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { logActivityFromRequest } from "@/lib/activity-log";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(8, "Nova senha precisa de no mínimo 8 caracteres").max(120),
});

export async function POST(req: Request) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const { senhaAtual, novaSenha } = schema.parse(await req.json());

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });

    if (!dbUser.passwordHash) {
      throw new Error("Sua conta não possui senha local (entrou via Google). Defina uma senha primeiro pelo administrador.");
    }

    const ok = await bcrypt.compare(senhaAtual, dbUser.passwordHash);
    if (!ok) throw new Error("Senha atual incorreta");

    if (senhaAtual === novaSenha) {
      throw new Error("A nova senha precisa ser diferente da atual");
    }

    const novaHash = await bcrypt.hash(novaSenha, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: novaHash } });
    await logActivityFromRequest(user.id, "MUDANCA_SENHA");
    return { ok: true };
  });
}
