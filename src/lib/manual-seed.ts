/**
 * Seed inicial do Manual SAL — esqueleto de seções padrão pra agência
 * de marketing digital. Idempotente: roda só se a categoria estiver
 * 100% vazia (não duplica se Marcelo já criou seções).
 *
 * Cada seção começa publicada=true com conteúdo vazio (Marcelo preenche
 * via editor). Ordem definida aqui = ordem inicial na sidebar.
 */
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/manual-helpers";

type SeedItem = { icone: string; titulo: string };

const PLAYBOOK_INICIAL: SeedItem[] = [
  { icone: "🏢", titulo: "Sobre a SAL" },
  { icone: "🤝", titulo: "Atendimento ao cliente" },
  { icone: "🚀", titulo: "Onboarding de cliente" },
  { icone: "✍️", titulo: "Workflow editorial" },
  { icone: "📣", titulo: "Tráfego pago" },
  { icone: "🔍", titulo: "SEO" },
  { icone: "📊", titulo: "Relatórios mensais" },
  { icone: "💼", titulo: "Comercial — leads e propostas" },
  { icone: "🎙️", titulo: "Reuniões padrão" },
  { icone: "💬", titulo: "Comunicação interna" },
];

const MARCA_INICIAL: SeedItem[] = [
  { icone: "🎨", titulo: "Logo e uso" },
  { icone: "🌈", titulo: "Paleta de cores" },
  { icone: "✏️", titulo: "Tipografia" },
  { icone: "🗣️", titulo: "Tom de voz" },
  { icone: "🌟", titulo: "Manifesto, missão e valores" },
  { icone: "🎯", titulo: "Personas SAL" },
  { icone: "📐", titulo: "Pilares editoriais" },
  { icone: "🖼️", titulo: "Exemplos de aplicação" },
];

/**
 * Roda seed apenas se a categoria está vazia. Use no Server Component
 * de cada página (lazy seeding).
 */
export async function seedManualSeNecessario(tipo: "PLAYBOOK" | "MARCA"): Promise<void> {
  const count = await prisma.docSecao.count({ where: { tipo } });
  if (count > 0) return;

  const items = tipo === "PLAYBOOK" ? PLAYBOOK_INICIAL : MARCA_INICIAL;
  // Cria em ordem (Promise.all não preserva ordem de insert se houver
  // race em ordem — preferimos sequencial)
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    await prisma.docSecao
      .create({
        data: {
          tipo,
          titulo: item.titulo,
          slug: slugify(item.titulo),
          icone: item.icone,
          ordem: (i + 1) * 10, // múltiplos de 10 deixa espaço pra inserir entre
          conteudo: "",
          publicada: true,
        },
      })
      .catch(() => undefined); // ignora se slug colidir
  }
}
