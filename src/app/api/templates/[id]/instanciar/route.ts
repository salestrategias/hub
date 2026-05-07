import { apiHandler, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/db";
import { templateInstanciarSchema } from "@/lib/schemas";
import { expandTemplateVariables } from "@/lib/template-variables";
import { syncMentionsFromValue } from "@/lib/mentions";

/**
 * Cria uma nova entidade (nota, reunião, tarefa, projeto) a partir de um
 * template, expandindo variáveis tipo {{data}} e {{cliente.nome}}.
 *
 * Retorna `{ id, redirect }` apontando pra página da entidade criada.
 *
 * Nota: BRIEFING vira NOTA na pasta "Briefings". Não criamos uma tabela
 * separada pra briefing — é só um sub-tipo de nota com formato pré-pronto.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const user = await requireAuth();
    const body = templateInstanciarSchema.parse(await req.json().catch(() => ({})));

    const template = await prisma.template.findUniqueOrThrow({ where: { id: params.id } });

    // Carrega cliente quando informado pra preencher {{cliente.nome}}
    let cliente: { id: string; nome: string } | null = null;
    if (body.clienteId) {
      cliente = await prisma.cliente.findUnique({
        where: { id: body.clienteId },
        select: { id: true, nome: true },
      });
    }

    const ctx = {
      user: { nome: user.name ?? "", email: user.email ?? "" },
      cliente: cliente ? { nome: cliente.nome } : undefined,
      extra: body.overrides,
    };

    const conteudo = expandTemplateVariables(template.conteudo, ctx);
    const titulo = body.overrides?.titulo ?? expandTemplateVariables(template.nome, ctx);

    let resultado: { id: string; redirect: string };

    switch (template.tipo) {
      case "REUNIAO": {
        const reuniao = await prisma.reuniao.create({
          data: {
            titulo,
            data: new Date(),
            notasLivres: conteudo,
            clienteId: cliente?.id ?? null,
            // ReuniaoStatus = GRAVANDO | PROCESSANDO | TRANSCRITA | GRAVADA.
            // Reunião criada de template ainda não tem áudio nem transcrição,
            // então vai como GRAVADA (mesmo default da criação manual).
            status: "GRAVADA",
            participantes: [],
            tagsLivres: template.categoria ? [template.categoria] : [],
          },
        });
        void syncMentionsFromValue({ sourceType: "REUNIAO", sourceId: reuniao.id }, conteudo);
        resultado = { id: reuniao.id, redirect: `/reunioes/${reuniao.id}` };
        break;
      }
      case "TAREFA": {
        const tarefa = await prisma.tarefa.create({
          data: {
            titulo,
            descricao: conteudo,
            prioridade: "NORMAL",
            concluida: false,
            clienteId: cliente?.id ?? null,
          },
        });
        void syncMentionsFromValue({ sourceType: "TAREFA", sourceId: tarefa.id }, conteudo);
        resultado = { id: tarefa.id, redirect: `/tarefas?tarefa=${tarefa.id}` };
        break;
      }
      case "PROJETO": {
        const projeto = await prisma.projeto.create({
          data: {
            nome: titulo,
            descricao: conteudo,
            status: "BRIEFING",
            prioridade: "NORMAL",
            clienteId: cliente?.id ?? null,
          },
        });
        void syncMentionsFromValue({ sourceType: "PROJETO", sourceId: projeto.id }, conteudo);
        resultado = { id: projeto.id, redirect: `/projetos?projeto=${projeto.id}` };
        break;
      }
      case "BRIEFING":
      case "NOTA":
      default: {
        const pastaPadrao = template.tipo === "BRIEFING" ? "Briefings" : "Inbox";
        const nota = await prisma.nota.create({
          data: {
            titulo,
            pasta: body.overrides?.pasta ?? pastaPadrao,
            conteudo,
            tags: template.categoria ? [template.categoria] : [],
            favorita: false,
          },
        });
        void syncMentionsFromValue({ sourceType: "NOTA", sourceId: nota.id }, conteudo);
        resultado = { id: nota.id, redirect: `/notas?nota=${nota.id}` };
        break;
      }
    }

    // Atualiza stats — fire-and-forget
    void prisma.template
      .update({
        where: { id: template.id },
        data: {
          quantidadeUsos: { increment: 1 },
          ultimoUso: new Date(),
        },
      })
      .catch(() => undefined);

    return resultado;
  });
}
