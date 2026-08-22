// Gera a capa de um post do blog em PNG.
// node gerar.mjs "Título do artigo" --grifo "trecho" --cat "Tráfego pago" --min 7 [--social] [--saida capa.png]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const titulo = args[0] && !args[0].startsWith('--') ? args[0] : 'Título do artigo';
const flag = (n, d) => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : d; };
const social = args.includes('--social');
const saida = flag('saida', social ? 'card-social.png' : 'capa.png');

const dir = path.dirname(fileURLToPath(import.meta.url));
const p = new URLSearchParams({ titulo, grifo: flag('grifo', ''), cat: flag('cat', 'Blog'), min: flag('min', '5') });
if (social) p.set('formato', 'social');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await b.newPage({ viewport: social ? { width: 1080, height: 1080 } : { width: 1200, height: 675 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(dir, 'capa.html') + '?' + p, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.locator('.capa').screenshot({ path: saida });
await b.close();
console.log('gerado: ' + saida);
