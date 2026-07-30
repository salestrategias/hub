// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Remove os comentários de HTML do build. O código-fonte segue comentado,
 * que é o que mantém o projeto legível, mas nada disso chega ao navegador.
 */
function limpaComentarios() {
  return {
    name: 'sal-limpa-comentarios',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }) => {
        const raiz = fileURLToPath(dir);
        let limpos = 0;
        for (const { pathname } of pages) {
          const arq = `${raiz}${pathname}${pathname === '' || pathname.endsWith('/') ? '' : '/'}index.html`;
          let html;
          try {
            html = readFileSync(arq, 'utf8');
          } catch {
            continue;
          }
          const novo = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
          if (novo !== html) {
            writeFileSync(arq, novo, 'utf8');
            limpos++;
          }
        }
        logger.info(`comentários de HTML removidos de ${limpos} página(s)`);
      },
    },
  };
}

export default defineConfig({
  site: 'https://salestrategias.com.br',
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
  integrations: [limpaComentarios()],
  vite: {
    // sem sourcemap em produção: ele publicaria o código-fonte inteiro
    build: { sourcemap: false, minify: 'esbuild' },
  },
});
