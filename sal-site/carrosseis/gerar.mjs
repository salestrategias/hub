// Gera um carrossel completo em PNGs a partir de uma espec JSON.
// node gerar.mjs especs/meu-carrossel.json  →  saida/<nome>/01.png … + legenda.txt
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const arq = process.argv[2];
if (!arq) { console.error('uso: node gerar.mjs especs/<carrossel>.json'); process.exit(1); }
const espec = JSON.parse(readFileSync(arq, 'utf8'));
const dir = path.dirname(fileURLToPath(import.meta.url));
const destino = path.join(dir, 'saida', espec.nome);
mkdirSync(destino, { recursive: true });

const b64url = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
const total = espec.slides.length;
for (let i = 0; i < total; i++) {
  const dados = { ...espec.slides[i], editoria: espec.slides[i].editoria ?? espec.editoria, pag: i + 1, total };
  await page.goto('file://' + path.join(dir, 'slide.html') + '?s=' + b64url(dados), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  await page.locator('.slide').screenshot({ path: path.join(destino, String(i + 1).padStart(2, '0') + '.png') });
}
await b.close();
if (espec.legenda) writeFileSync(path.join(destino, 'legenda.txt'), espec.legenda);
console.log(`gerado: ${destino} (${total} slides${espec.legenda ? ' + legenda' : ''})`);
