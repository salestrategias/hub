// @ts-check
import { defineConfig } from 'astro/config';

// Site estático puro: sem JS de framework no cliente, HTML pré-renderizado.
// O blog segue no WordPress em /blog/ (fora deste build).
export default defineConfig({
  site: 'https://salestrategias.com.br',
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
