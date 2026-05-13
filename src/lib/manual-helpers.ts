/**
 * Helpers do módulo Manual (Playbook + Marca).
 */

/**
 * Converte título em slug URL-friendly.
 * "Atendimento ao Cliente" → "atendimento-ao-cliente"
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Garante slug único dentro do tipo. Se já existe, anexa -2, -3, etc.
 */
export async function slugUnico(
  prismaClient: { docSecao: { findUnique: (args: { where: { tipo_slug: { tipo: "PLAYBOOK" | "MARCA"; slug: string } } }) => Promise<{ id: string } | null> } },
  tipo: "PLAYBOOK" | "MARCA",
  base: string,
  excluirId?: string
): Promise<string> {
  let slug = base;
  let n = 2;
  while (true) {
    const exist = await prismaClient.docSecao.findUnique({
      where: { tipo_slug: { tipo, slug } },
    });
    if (!exist || exist.id === excluirId) return slug;
    slug = `${base}-${n}`;
    n++;
  }
}
