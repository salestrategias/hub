/**
 * Sitemap gerado no build a partir das páginas reais do site.
 * Feito à mão de propósito: são poucas páginas e assim não entra dependência
 * nova só para montar dez URLs. O blog fica no WordPress e tem o sitemap dele.
 */
import type { APIRoute } from 'astro';

const site = 'https://www.salestrategias.com.br';

const paginas: { url: string; prioridade: string; freq: string }[] = [
  { url: '/', prioridade: '1.0', freq: 'weekly' },
  { url: '/servicos/', prioridade: '0.9', freq: 'monthly' },
  { url: '/servicos/agencia-de-producao-de-conteudo/', prioridade: '0.8', freq: 'monthly' },
  { url: '/seo-local/', prioridade: '0.9', freq: 'monthly' },
  { url: '/seo-para-ecommerce/', prioridade: '0.9', freq: 'monthly' },
  { url: '/trafego-pago/', prioridade: '0.9', freq: 'monthly' },
  { url: '/diagnostico-de-site/', prioridade: '0.8', freq: 'monthly' },
  { url: '/varejo-local/', prioridade: '0.8', freq: 'monthly' },
  { url: '/e-commerce/', prioridade: '0.8', freq: 'monthly' },
  { url: '/quem-somos/', prioridade: '0.7', freq: 'monthly' },
  { url: '/marcelo-freitas/', prioridade: '0.7', freq: 'monthly' },
  { url: '/agenda/', prioridade: '0.9', freq: 'monthly' },
  { url: '/politica-de-privacidade/', prioridade: '0.2', freq: 'yearly' },
];

export const GET: APIRoute = () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const corpo =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paginas
      .map(
        (p) =>
          `  <url>\n    <loc>${site}${p.url}</loc>\n    <lastmod>${hoje}</lastmod>\n` +
          `    <changefreq>${p.freq}</changefreq>\n    <priority>${p.prioridade}</priority>\n  </url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(corpo, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
