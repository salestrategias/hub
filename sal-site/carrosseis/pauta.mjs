// Alimentador de pauta: puxa os posts do blog da SAL e monta o cardápio da semana.
// node pauta.mjs [n]  →  pauta.json (títulos, resumos, links, editorias, imagens de capa)
// As imagens de capa dos posts são baixadas para assets/ (nome: capa-<slug>.jpg).
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const n = Number(process.argv[2] || 12);
const dir = path.dirname(fileURLToPath(import.meta.url));
const api = `https://www.salestrategias.com.br/wp-json/wp/v2/posts?per_page=${n}&_embed=wp:featuredmedia,wp:term&cb=${Date.now()}`;
const posts = await (await fetch(api)).json();
const limpar = (s = '') => s.replace(/<[^>]*>/g, '').replace(/&hellip;|&#8230;/g, '…').replace(/&#8217;/g, '’').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();

const pauta = [];
for (const p of posts) {
  const termos = (p._embedded?.['wp:term'] || []).flat().filter((t) => t.taxonomy === 'category' && t.slug !== 'uncategorized');
  const midia = p._embedded?.['wp:featuredmedia']?.[0]?.source_url || null;
  let imagem = null;
  if (midia) {
    imagem = 'capa-' + p.slug.slice(0, 40) + path.extname(new URL(midia).pathname || '.jpg');
    try { execSync(`curl -sL "${midia}" -o "${path.join(dir, 'assets', imagem)}"`, { timeout: 30000 }); }
    catch { imagem = null; }
  }
  pauta.push({
    slug: p.slug, link: p.link, data: p.date?.slice(0, 10),
    titulo: limpar(p.title?.rendered), resumo: limpar(p.excerpt?.rendered).slice(0, 220),
    editoria: termos[0]?.name || 'Blog da SAL', imagem,
  });
}
writeFileSync(path.join(dir, 'pauta.json'), JSON.stringify(pauta, null, 2));
console.log(`pauta.json: ${pauta.length} posts (${pauta.filter((p) => p.imagem).length} com imagem de capa em assets/)`);
