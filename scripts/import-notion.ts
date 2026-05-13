/**
 * Script de importação Notion → SAL Hub.
 *
 * Lê os dados estruturados em `prisma/notion-import-data.ts` (extraídos
 * via MCP do Notion em 2026-05-13) e popula o banco via Prisma.
 *
 * Idempotência:
 *  - Cliente: dedup por nome (normalizado)
 *  - Tarefa: dedup por titulo + clienteNome
 *  - Post: dedup por titulo + dataPublicacao
 *  - Lancamento: dedup por descricao + data
 *  - DocSecao: dedup por (tipo, slug) — já é @unique no schema
 *
 * Como rodar no VPS:
 *   docker compose exec app npx tsx scripts/import-notion.ts
 *
 * Pra dry-run (mostra o que vai fazer sem persistir):
 *   docker compose exec app npx tsx scripts/import-notion.ts --dry
 */
import { PrismaClient } from "@prisma/client";
import {
  CLIENTES,
  TAREFAS,
  POSTS,
  LANCAMENTOS,
  DOC_SECOES,
} from "../prisma/notion-import-data";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

function log(msg: string) {
  console.log(`${DRY ? "[DRY] " : ""}${msg}`);
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────
// 1. Tags — cria todas as tags únicas de categoria + serviços antes
// dos clientes, depois associa.
// ─────────────────────────────────────────────────────────────────────
async function importarTags(): Promise<Map<string, string>> {
  const tagsUnicas = new Set<string>();
  for (const c of CLIENTES) {
    if (c.categoria) tagsUnicas.add(c.categoria);
    for (const s of c.servicos) tagsUnicas.add(s);
  }

  const mapaTag = new Map<string, string>(); // nome → id
  for (const nome of tagsUnicas) {
    if (DRY) {
      log(`+ Tag "${nome}"`);
      mapaTag.set(nome, `dry-${nome}`);
      continue;
    }
    const tag = await prisma.tag.upsert({
      where: { nome },
      create: { nome, cor: "#7E30E1" },
      update: {},
    });
    mapaTag.set(nome, tag.id);
  }
  log(`Tags: ${tagsUnicas.size} processadas`);
  return mapaTag;
}

// ─────────────────────────────────────────────────────────────────────
// 2. Clientes — dedup por nome normalizado. Atualiza campos vazios
// se já existir (não destrutivo).
// ─────────────────────────────────────────────────────────────────────
async function importarClientes(mapaTag: Map<string, string>): Promise<Map<string, string>> {
  const mapaCliente = new Map<string, string>(); // nome normalizado → id

  for (const c of CLIENTES) {
    const nomeNorm = normalizar(c.nome);

    if (DRY) {
      log(`+ Cliente "${c.nome}" [${c.status}] — tags: ${[c.categoria, ...c.servicos].filter(Boolean).join(", ")}`);
      mapaCliente.set(nomeNorm, `dry-${c.nome}`);
      continue;
    }

    // Procura existente por nome (case-insensitive, normalizado)
    const todos = await prisma.cliente.findMany({ select: { id: true, nome: true } });
    const existente = todos.find((x) => normalizar(x.nome) === nomeNorm);

    const tagIds: string[] = [];
    if (c.categoria && mapaTag.has(c.categoria)) tagIds.push(mapaTag.get(c.categoria)!);
    for (const s of c.servicos) {
      if (mapaTag.has(s)) tagIds.push(mapaTag.get(s)!);
    }

    const data = {
      nome: c.nome,
      email: c.email,
      telefone: c.telefone,
      status: c.status,
      notas: c.observacoes,
      tags: { set: tagIds.map((id) => ({ id })) },
    };

    let id: string;
    if (existente) {
      const upd = await prisma.cliente.update({
        where: { id: existente.id },
        data: {
          // Não sobrescreve campos preenchidos com vazios
          email: c.email || undefined,
          telefone: c.telefone || undefined,
          status: c.status,
          notas: c.observacoes || undefined,
          tags: { set: tagIds.map((tid) => ({ id: tid })) },
        },
      });
      id = upd.id;
      log(`~ Cliente "${c.nome}" atualizado`);
    } else {
      const nv = await prisma.cliente.create({ data });
      id = nv.id;
      log(`+ Cliente "${c.nome}" criado`);
    }
    mapaCliente.set(nomeNorm, id);
  }

  log(`Clientes: ${CLIENTES.length} processados`);
  return mapaCliente;
}

// ─────────────────────────────────────────────────────────────────────
// 3. Tarefas — resolve cliente por nome. Dedup por titulo + clienteId.
// ─────────────────────────────────────────────────────────────────────
async function importarTarefas(mapaCliente: Map<string, string>) {
  let criadas = 0;
  let puladas = 0;

  for (const t of TAREFAS) {
    const clienteId = t.clienteNome ? mapaCliente.get(normalizar(t.clienteNome)) : null;

    if (DRY) {
      log(`+ Tarefa "${t.titulo}" [${t.prioridade}, ${t.concluida ? "feita" : "aberta"}] cliente=${t.clienteNome ?? "—"}`);
      criadas++;
      continue;
    }

    // Dedup por título + clienteId
    const existente = await prisma.tarefa.findFirst({
      where: { titulo: t.titulo, clienteId: clienteId ?? null },
    });
    if (existente) {
      puladas++;
      continue;
    }

    const descricao = [
      t.descricao,
      t.tipo ? `\n_Tipo Notion: ${t.tipo}_` : null,
    ].filter(Boolean).join("\n");

    await prisma.tarefa.create({
      data: {
        titulo: t.titulo,
        descricao: descricao || null,
        prioridade: t.prioridade,
        dataEntrega: t.dataEntrega ? new Date(t.dataEntrega) : null,
        concluida: t.concluida,
        clienteId,
      },
    });
    criadas++;
  }

  log(`Tarefas: ${criadas} criadas, ${puladas} já existiam`);
}

// ─────────────────────────────────────────────────────────────────────
// 4. Posts editoriais — resolve cliente por nome. Pula os sem cliente
// (não dá pra criar Post sem cliente no schema atual). Post da SAL
// ("Carrossel — Até 5 anos...") vai pra ConteudoSAL se for o caso —
// aqui pulamos.
// ─────────────────────────────────────────────────────────────────────
async function importarPosts(mapaCliente: Map<string, string>) {
  let criados = 0;
  let puladas = 0;
  let semCliente = 0;

  for (const p of POSTS) {
    if (!p.clienteNome) {
      semCliente++;
      // TODO: mover pra ConteudoSAL se for da própria SAL
      continue;
    }
    const clienteId = mapaCliente.get(normalizar(p.clienteNome));
    if (!clienteId) {
      log(`! Post "${p.titulo}" tem cliente "${p.clienteNome}" não encontrado — pulado`);
      puladas++;
      continue;
    }

    if (DRY) {
      log(`+ Post "${p.titulo}" [${p.status}, ${p.formato}] cliente=${p.clienteNome}`);
      criados++;
      continue;
    }

    // Dedup por titulo + dataPublicacao
    const existente = await prisma.post.findFirst({
      where: {
        titulo: p.titulo,
        dataPublicacao: new Date(p.dataPublicacao),
      },
    });
    if (existente) {
      puladas++;
      continue;
    }

    await prisma.post.create({
      data: {
        titulo: p.titulo,
        legenda: p.legenda || null,
        pilar: p.pilar,
        formato: p.formato,
        status: p.status,
        dataPublicacao: new Date(p.dataPublicacao),
        clienteId,
      },
    });
    criados++;
  }

  log(`Posts: ${criados} criados, ${puladas} já existiam, ${semCliente} sem cliente (skipados)`);
}

// ─────────────────────────────────────────────────────────────────────
// 5. Lançamentos financeiros (Controle Mensal)
// ─────────────────────────────────────────────────────────────────────
async function importarLancamentos() {
  let criados = 0;
  let puladas = 0;

  for (const l of LANCAMENTOS) {
    if (DRY) {
      log(`+ Lancamento "${l.descricao}" R$${l.valor} [${l.tipo}/${l.entidade}]`);
      criados++;
      continue;
    }

    const existente = await prisma.lancamento.findFirst({
      where: { descricao: l.descricao, data: new Date(l.data) },
    });
    if (existente) {
      puladas++;
      continue;
    }

    await prisma.lancamento.create({
      data: {
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo,
        categoria: l.categoria,
        data: new Date(l.data),
        recorrente: l.recorrente,
        entidade: l.entidade,
      },
    });
    criados++;
  }

  log(`Lançamentos: ${criados} criados, ${puladas} já existiam`);
}

// ─────────────────────────────────────────────────────────────────────
// 6. Manual SAL — Playbook + Marca
// Converte Markdown → BlockNote JSON (parser simples: parágrafos +
// headings ## + bullets -). Idempotente via @unique(tipo, slug).
// ─────────────────────────────────────────────────────────────────────
function markdownParaBlockNote(md: string): string {
  const blocos: unknown[] = [];
  const linhas = md.split("\n");
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i].trim();
    if (!linha) { i++; continue; }

    // Heading 2
    const h2 = linha.match(/^##\s+(.+)$/);
    if (h2) {
      blocos.push({
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: h2[1], styles: {} }],
      });
      i++;
      continue;
    }

    // Heading 3
    const h3 = linha.match(/^###\s+(.+)$/);
    if (h3) {
      blocos.push({
        type: "heading",
        props: { level: 3 },
        content: [{ type: "text", text: h3[1], styles: {} }],
      });
      i++;
      continue;
    }

    // Quote
    if (linha.startsWith("> ")) {
      blocos.push({
        type: "quote",
        content: [{ type: "text", text: linha.replace(/^>\s*/, ""), styles: {} }],
      });
      i++;
      continue;
    }

    // Bullet
    if (linha.startsWith("- ")) {
      blocos.push({
        type: "bulletListItem",
        content: parseInline(linha.replace(/^-\s*/, "")),
      });
      i++;
      continue;
    }

    // Numbered
    const num = linha.match(/^\d+\.\s+(.+)$/);
    if (num) {
      blocos.push({
        type: "numberedListItem",
        content: parseInline(num[1]),
      });
      i++;
      continue;
    }

    // Parágrafo (acumula linhas até próximo bloco/vazio)
    const para: string[] = [linha];
    i++;
    while (i < linhas.length && linhas[i].trim() && !linhas[i].trim().match(/^(#{1,6}\s|>\s|-\s|\d+\.\s)/)) {
      para.push(linhas[i].trim());
      i++;
    }
    blocos.push({
      type: "paragraph",
      content: parseInline(para.join(" ")),
    });
  }
  return JSON.stringify(blocos);
}

function parseInline(texto: string): unknown[] {
  // Suporte simples a **bold** e [text](url) e `inline code`
  const partes: unknown[] = [];
  let resto = texto;

  while (resto) {
    // Bold
    const bold = resto.match(/^\*\*([^*]+)\*\*/);
    if (bold) {
      partes.push({ type: "text", text: bold[1], styles: { bold: true } });
      resto = resto.slice(bold[0].length);
      continue;
    }
    // Link
    const link = resto.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      partes.push({
        type: "link",
        href: link[2],
        content: [{ type: "text", text: link[1], styles: {} }],
      });
      resto = resto.slice(link[0].length);
      continue;
    }
    // Inline code
    const code = resto.match(/^`([^`]+)`/);
    if (code) {
      partes.push({ type: "text", text: code[1], styles: { code: true } });
      resto = resto.slice(code[0].length);
      continue;
    }
    // Texto até próximo marcador
    const proxMarker = resto.search(/(\*\*|\[|`)/);
    if (proxMarker === -1) {
      partes.push({ type: "text", text: resto, styles: {} });
      resto = "";
    } else {
      partes.push({ type: "text", text: resto.slice(0, proxMarker), styles: {} });
      resto = resto.slice(proxMarker);
    }
  }

  return partes.length > 0 ? partes : [{ type: "text", text: "", styles: {} }];
}

async function importarManual() {
  let criadas = 0;
  let atualizadas = 0;

  for (const s of DOC_SECOES) {
    const conteudoBlockNote = markdownParaBlockNote(s.conteudoMarkdown);

    if (DRY) {
      log(`+ DocSecao "${s.titulo}" [${s.tipo}, ordem=${s.ordem}]`);
      criadas++;
      continue;
    }

    const existente = await prisma.docSecao.findUnique({
      where: { tipo_slug: { tipo: s.tipo, slug: s.slug } },
    });

    if (existente) {
      await prisma.docSecao.update({
        where: { id: existente.id },
        data: {
          titulo: s.titulo,
          icone: s.icone,
          ordem: s.ordem,
          // NÃO atualiza conteúdo se Marcelo já editou no Hub
          // (preserva trabalho manual). Se quiser forçar update,
          // descomente a linha abaixo:
          // conteudo: conteudoBlockNote,
        },
      });
      atualizadas++;
    } else {
      await prisma.docSecao.create({
        data: {
          tipo: s.tipo,
          titulo: s.titulo,
          slug: s.slug,
          icone: s.icone,
          ordem: s.ordem,
          conteudo: conteudoBlockNote,
          publicada: true,
        },
      });
      criadas++;
    }
  }

  log(`Manual: ${criadas} seções criadas, ${atualizadas} já existiam (conteúdo preservado)`);
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧂 Importando dados do Notion ${DRY ? "(DRY RUN)" : ""}\n`);

  try {
    const mapaTag = await importarTags();
    const mapaCliente = await importarClientes(mapaTag);
    await importarTarefas(mapaCliente);
    await importarPosts(mapaCliente);
    await importarLancamentos();
    await importarManual();

    console.log(`\n✅ Importação concluída${DRY ? " (modo dry-run — nada foi persistido)" : ""}\n`);
  } catch (err) {
    console.error("\n❌ Erro na importação:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
