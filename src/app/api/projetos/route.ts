import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { projetoSchema } from "@/lib/schemas";
import { createFolder } from "@/lib/google-drive";
import { tryCreateEvent } from "@/lib/google-calendar";
import { syncMentionsFromValue } from "@/lib/mentions";

export async function GET() {
  return apiHandler(async () => {
    await requireAuth();
    return prisma.projeto.findMany({
      include: { cliente: true, tarefas: true },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireAuth();
    const body = await req.json();
    const parsed = projetoSchema.parse(body);
    const { criarPastaDrive, ...data } = parsed;

    let driveData: { googleDriveFolderId?: string; googleDriveFolderUrl?: string } = {};
    if (criarPastaDrive) {
      const cliente = data.clienteId
        ? await prisma.cliente.findUnique({ where: { id: data.clienteId }, select: { nome: true, googleDriveFolderId: true } })
        : null;
      const nome = cliente ? `${cliente.nome} - ${data.nome}` : data.nome;
      try {
        const folder = await createFolder(nome, cliente?.googleDriveFolderId ?? undefined);
        driveData = {
          googleDriveFolderId: folder.id,
          googleDriveFolderUrl: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`,
        };
      } catch (e) {
        console.warn("Falha criando pasta no Drive:", e);
      }
    }

    let googleEventId: string | null = null;
    if (data.dataEntrega) {
      const fim = new Date(data.dataEntrega);
      fim.setHours(fim.getHours() + 1);
      const ev = await tryCreateEvent({
        titulo: `[Projeto] ${data.nome}`,
        descricao: data.descricao ?? undefined,
        inicio: data.dataEntrega,
        fim,
      });
      googleEventId = ev?.id ?? null;
    }

    const projeto = await prisma.projeto.create({ data: { ...data, ...driveData, googleEventId } });
    void syncMentionsFromValue({ sourceType: "PROJETO", sourceId: projeto.id }, projeto.descricao);
    return projeto;
  });
}
